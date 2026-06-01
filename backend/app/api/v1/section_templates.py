"""大項目テンプレート CRUD エンドポイント。"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import UserRole
from app.models.section_template import SectionTemplate, SectionTemplateItem
from app.models.user import User
from app.schemas.section_template import (
    SectionTemplateCreate,
    SectionTemplateRead,
    SectionTemplateUpdate,
    SectionTemplateItemRead,
)

router = APIRouter(tags=["section-templates"])
logger = structlog.get_logger(__name__)


def _build_read(t: SectionTemplate) -> SectionTemplateRead:
    return SectionTemplateRead(
        id=t.id,
        template_name=t.template_name,
        description=t.description,
        is_active=t.is_active,
        created_at=t.created_at,
        updated_at=t.updated_at,
        items=[
            SectionTemplateItemRead(
                id=i.id,
                section_code=i.section_code,
                section_name=i.section_name,
                display_order=i.display_order,
                default_items=i.default_items,
            )
            for i in sorted(t.items, key=lambda x: x.display_order)
        ],
    )


async def _get_or_404(template_id: uuid.UUID, db: AsyncSession) -> SectionTemplate:
    t = (await db.execute(
        select(SectionTemplate)
        .options(selectinload(SectionTemplate.items))
        .where(SectionTemplate.id == template_id)
    )).scalar_one_or_none()
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="テンプレートが見つかりません")
    return t


@router.get("/section-templates", response_model=list[SectionTemplateRead])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SectionTemplateRead]:
    """大項目テンプレート一覧を返す。is_active=true のもののみ。"""
    rows = (await db.execute(
        select(SectionTemplate)
        .options(selectinload(SectionTemplate.items))
        .where(SectionTemplate.is_active.is_(True))
        .order_by(SectionTemplate.template_name)
    )).scalars().all()
    return [_build_read(t) for t in rows]


@router.get("/section-templates/all", response_model=list[SectionTemplateRead])
async def list_all_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SectionTemplateRead]:
    """大項目テンプレート一覧を全件返す（管理画面用）。"""
    rows = (await db.execute(
        select(SectionTemplate)
        .options(selectinload(SectionTemplate.items))
        .order_by(SectionTemplate.template_name)
    )).scalars().all()
    return [_build_read(t) for t in rows]


@router.post("/section-templates", response_model=SectionTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: SectionTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SectionTemplateRead:
    """大項目テンプレートを新規作成する。"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ操作できます")

    t = SectionTemplate(
        id=uuid.uuid4(),
        template_name=body.template_name,
        description=body.description,
    )
    db.add(t)
    await db.flush()

    for item_in in body.items:
        db.add(SectionTemplateItem(
            id=uuid.uuid4(),
            section_template_id=t.id,
            section_code=item_in.section_code,
            section_name=item_in.section_name,
            display_order=item_in.display_order,
            default_items=item_in.default_items,
        ))

    await db.commit()
    result = await _get_or_404(t.id, db)
    logger.info("section_template_created", template_id=str(t.id), name=body.template_name)
    return _build_read(result)


@router.patch("/section-templates/{template_id}", response_model=SectionTemplateRead)
async def update_template(
    template_id: uuid.UUID,
    body: SectionTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SectionTemplateRead:
    """大項目テンプレートを更新する。items が含まれる場合は全置換。"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ操作できます")

    t = await _get_or_404(template_id, db)

    if body.template_name is not None:
        t.template_name = body.template_name
    if body.description is not None:
        t.description = body.description
    if body.is_active is not None:
        t.is_active = body.is_active

    if body.items is not None:
        for old_item in list(t.items):
            await db.delete(old_item)
        await db.flush()
        for item_in in body.items:
            db.add(SectionTemplateItem(
                id=uuid.uuid4(),
                section_template_id=t.id,
                section_code=item_in.section_code,
                section_name=item_in.section_name,
                display_order=item_in.display_order,
                default_items=item_in.default_items,
            ))

    await db.commit()
    result = await _get_or_404(template_id, db)
    logger.info("section_template_updated", template_id=str(template_id))
    return _build_read(result)


@router.delete("/section-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """大項目テンプレートを削除する。"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ操作できます")

    t = await _get_or_404(template_id, db)
    await db.delete(t)
    await db.commit()
    logger.info("section_template_deleted", template_id=str(template_id))
