"""見積条件書エンドポイント。"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.condition import ConditionTemplate, QuoteConditionItem
from app.models.quote import Quote
from app.models.user import User

router = APIRouter(tags=["conditions"])


class ConditionItemRead(BaseModel):
    id: uuid.UUID
    quote_id: uuid.UUID
    display_order: int
    content: str

    class Config:
        from_attributes = True


class ConditionItemCreate(BaseModel):
    content: str
    display_order: int | None = None


class ConditionItemUpdate(BaseModel):
    content: str | None = None
    display_order: int | None = None


class ConditionTemplateRead(BaseModel):
    id: uuid.UUID
    section_name: str | None
    display_order: int
    content: str
    is_default: bool

    class Config:
        from_attributes = True


def _to_read(item: QuoteConditionItem) -> ConditionItemRead:
    return ConditionItemRead(
        id=item.id,
        quote_id=item.quote_id,
        display_order=item.display_order,
        content=item.content,
    )


@router.get("/projects/{project_id}/quotes/{quote_id}/condition-items", response_model=list[ConditionItemRead])
async def list_condition_items(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConditionItemRead]:
    """見積条件書の項目一覧を返す。"""
    items = (await db.execute(
        select(QuoteConditionItem)
        .where(QuoteConditionItem.quote_id == quote_id)
        .order_by(QuoteConditionItem.display_order)
    )).scalars().all()
    return [_to_read(i) for i in items]


@router.post("/projects/{project_id}/quotes/{quote_id}/condition-items", response_model=ConditionItemRead, status_code=status.HTTP_201_CREATED)
async def create_condition_item(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: ConditionItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionItemRead:
    """見積条件書に項目を追加する。"""
    quote = (await db.execute(select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id))).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

    max_order = (await db.execute(
        select(QuoteConditionItem.display_order)
        .where(QuoteConditionItem.quote_id == quote_id)
        .order_by(QuoteConditionItem.display_order.desc())
        .limit(1)
    )).scalar_one_or_none() or 0

    item = QuoteConditionItem(
        quote_id=quote_id,
        display_order=body.display_order if body.display_order is not None else max_order + 1,
        content=body.content,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _to_read(item)


@router.patch("/projects/{project_id}/quotes/{quote_id}/condition-items/{item_id}", response_model=ConditionItemRead)
async def update_condition_item(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    item_id: uuid.UUID,
    body: ConditionItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionItemRead:
    """見積条件書の項目を更新する。"""
    item = (await db.execute(
        select(QuoteConditionItem).where(QuoteConditionItem.id == item_id, QuoteConditionItem.quote_id == quote_id)
    )).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="項目が見つかりません")
    if body.content is not None:
        item.content = body.content
    if body.display_order is not None:
        item.display_order = body.display_order
    await db.commit()
    await db.refresh(item)
    return _to_read(item)


@router.delete("/projects/{project_id}/quotes/{quote_id}/condition-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_condition_item(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """見積条件書の項目を削除する。"""
    item = (await db.execute(
        select(QuoteConditionItem).where(QuoteConditionItem.id == item_id, QuoteConditionItem.quote_id == quote_id)
    )).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="項目が見つかりません")
    await db.delete(item)
    await db.commit()


@router.post("/projects/{project_id}/quotes/{quote_id}/condition-items/reorder", response_model=list[ConditionItemRead])
async def reorder_condition_items(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConditionItemRead]:
    """見積条件書の表示順を一括更新する。"""
    item_ids: list[str] = body.get("item_ids", [])
    items = (await db.execute(
        select(QuoteConditionItem).where(QuoteConditionItem.quote_id == quote_id)
    )).scalars().all()
    item_map = {str(i.id): i for i in items}
    for idx, iid in enumerate(item_ids, start=1):
        if iid in item_map:
            item_map[iid].display_order = idx
    await db.commit()
    updated = (await db.execute(
        select(QuoteConditionItem).where(QuoteConditionItem.quote_id == quote_id).order_by(QuoteConditionItem.display_order)
    )).scalars().all()
    return [_to_read(i) for i in updated]


# ── テンプレート管理 ──

@router.get("/condition-templates", response_model=list[ConditionTemplateRead])
async def list_condition_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConditionTemplateRead]:
    """見積条件書テンプレート一覧。"""
    rows = (await db.execute(
        select(ConditionTemplate).order_by(ConditionTemplate.display_order)
    )).scalars().all()
    return [ConditionTemplateRead.model_validate(r) for r in rows]
