"""大項目 CRUD・明細単発 CRUD・テンプレート適用ルーター。"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import UserRole
from app.models.quote import Quote, QuoteItem, QuoteSection
from app.models.section_template import SectionTemplate
from app.models.user import User
from app.schemas.quote import (
    QuoteDetail,
    QuoteItemInput,
    QuoteItemRead,
    QuoteSectionCreate,
    QuoteSectionRead,
    QuoteSectionUpdate,
)
from app.modules.estimate.routers._helpers import (
    _get_project_or_404,
    _get_quote_or_404,
    _calc_totals,
    _build_detail,
    _build_section_read,
    _build_item_read,
)

router = APIRouter(tags=["quotes"])
logger = structlog.get_logger(__name__)


class _ApplyTemplateBody(BaseModel):
    """テンプレート適用リクエスト。"""
    template_id: uuid.UUID


# ---------------------------------------------------------------------------
# QuoteSection CRUD
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/quotes/{quote_id}/sections", response_model=list[QuoteSectionRead])
async def list_sections(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuoteSectionRead]:
    """大項目一覧を返す。"""
    await _get_project_or_404(project_id, db)
    await _get_quote_or_404(quote_id, project_id, db)
    rows = (await db.execute(
        select(QuoteSection).where(QuoteSection.quote_id == quote_id).order_by(QuoteSection.row_no)
    )).scalars().all()
    return [_build_section_read(s) for s in rows]


@router.post("/projects/{project_id}/quotes/{quote_id}/sections", response_model=QuoteSectionRead, status_code=status.HTTP_201_CREATED)
async def create_section(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteSectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteSectionRead:
    """大項目を追加する。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")
    await _get_quote_or_404(quote_id, project_id, db)

    s = QuoteSection(
        id=uuid.uuid4(),
        quote_id=quote_id,
        section_letter=body.section_letter,
        section_name=body.section_name,
        row_no=body.row_no,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _build_section_read(s)


@router.patch("/projects/{project_id}/quotes/{quote_id}/sections/{section_id}", response_model=QuoteSectionRead)
async def update_section(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    section_id: uuid.UUID,
    body: QuoteSectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteSectionRead:
    """大項目を更新する。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    s = (await db.execute(
        select(QuoteSection).where(QuoteSection.id == section_id, QuoteSection.quote_id == quote_id)
    )).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="大項目が見つかりません")

    for field in ["section_letter", "section_name", "row_no"]:
        val = getattr(body, field)
        if val is not None:
            setattr(s, field, val)

    await db.commit()
    await db.refresh(s)
    return _build_section_read(s)


@router.delete("/projects/{project_id}/quotes/{quote_id}/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    section_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """大項目を削除する（所属明細の section_id は NULL になる）。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    s = (await db.execute(
        select(QuoteSection).where(QuoteSection.id == section_id, QuoteSection.quote_id == quote_id)
    )).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="大項目が見つかりません")

    await db.delete(s)
    await db.commit()


# ---------------------------------------------------------------------------
# テンプレート適用
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/quotes/{quote_id}/apply-template",
    response_model=QuoteDetail,
)
async def apply_template(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: _ApplyTemplateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """テンプレートから大項目を一括追加する。既存大項目は保持し、テンプレート分を末尾に追加。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    quote = await _get_quote_or_404(quote_id, project_id, db)

    template = (await db.execute(
        select(SectionTemplate)
        .options(selectinload(SectionTemplate.items))
        .where(SectionTemplate.id == body.template_id)
    )).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="テンプレートが見つかりません")

    current_max_row = max((s.row_no for s in quote.sections), default=0)

    for tmpl_item in sorted(template.items, key=lambda x: x.display_order):
        current_max_row += 1
        section = QuoteSection(
            id=uuid.uuid4(),
            quote_id=quote_id,
            section_letter=tmpl_item.section_code,
            section_name=tmpl_item.section_name,
            row_no=current_max_row,
        )
        db.add(section)
        await db.flush()

        if tmpl_item.default_items:
            existing_max = (await db.execute(
                select(func.max(QuoteItem.row_no)).where(QuoteItem.quote_id == quote_id)
            )).scalar_one_or_none() or 0
            for idx, di in enumerate(tmpl_item.default_items):
                db.add(QuoteItem(
                    id=uuid.uuid4(),
                    quote_id=quote_id,
                    section_id=section.id,
                    row_no=existing_max + idx + 1,
                    item_name=di.get("item_name"),
                    spec=di.get("spec"),
                    unit=di.get("unit"),
                ))

    await db.commit()
    db.expunge_all()
    result = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.versions), selectinload(Quote.sections), selectinload(Quote.items))
        .where(Quote.id == quote_id)
    )).scalar_one()
    logger.info("template_applied", quote_id=str(quote_id), template_id=str(body.template_id))
    return _build_detail(result)


# ---------------------------------------------------------------------------
# 単発明細 CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/quotes/{quote_id}/items",
    response_model=QuoteItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_item(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteItemInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteItemRead:
    """見積書に明細行を1件追加する。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")
    await _get_quote_or_404(quote_id, project_id, db)

    unit_price = body.unit_price
    if unit_price is None and body.cost_price is not None:
        unit_price = body.cost_price
    amount = None
    if body.quantity is not None and unit_price is not None:
        amount = round(body.quantity * unit_price)

    item = QuoteItem(
        id=uuid.uuid4(),
        quote_id=quote_id,
        row_no=body.row_no,
        item_name=body.item_name,
        spec=body.spec,
        unit=body.unit,
        quantity=body.quantity,
        cost_price=body.cost_price,
        item_markup_rate=body.item_markup_rate,
        unit_price=unit_price,
        amount=amount,
        remarks=body.remarks,
        version_id=body.version_id,
        section_id=body.section_id,
    )
    db.add(item)
    await db.flush()

    all_items = (await db.execute(
        select(QuoteItem).where(QuoteItem.quote_id == quote_id)
    )).scalars().all()
    subtotal, tax_amount, total_amount = _calc_totals(list(all_items))
    quote_row = (await db.execute(
        select(Quote).where(Quote.id == quote_id)
    )).scalar_one()
    quote_row.subtotal = subtotal
    quote_row.tax_amount = tax_amount
    quote_row.total_amount = total_amount

    await db.commit()
    await db.refresh(item)
    return _build_item_read(item)


@router.patch(
    "/projects/{project_id}/quotes/{quote_id}/items/{item_id}",
    response_model=QuoteItemRead,
)
async def update_item(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    item_id: uuid.UUID,
    body: QuoteItemInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteItemRead:
    """見積書の明細行を1件更新する。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    item = (await db.execute(
        select(QuoteItem).where(QuoteItem.id == item_id, QuoteItem.quote_id == quote_id)
    )).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="明細が見つかりません")

    unit_price = body.unit_price
    if unit_price is None and body.cost_price is not None:
        unit_price = body.cost_price
    amount = None
    if body.quantity is not None and unit_price is not None:
        amount = round(body.quantity * unit_price)

    item.row_no = body.row_no
    item.item_name = body.item_name
    item.spec = body.spec
    item.unit = body.unit
    item.quantity = body.quantity
    item.cost_price = body.cost_price
    item.item_markup_rate = body.item_markup_rate
    item.unit_price = unit_price
    item.amount = amount
    item.remarks = body.remarks
    item.version_id = body.version_id
    item.section_id = body.section_id

    await db.flush()

    all_items = (await db.execute(
        select(QuoteItem).where(QuoteItem.quote_id == quote_id)
    )).scalars().all()
    subtotal, tax_amount, total_amount = _calc_totals(list(all_items))
    quote_row = (await db.execute(
        select(Quote).where(Quote.id == quote_id)
    )).scalar_one()
    quote_row.subtotal = subtotal
    quote_row.tax_amount = tax_amount
    quote_row.total_amount = total_amount

    await db.commit()
    await db.refresh(item)
    return _build_item_read(item)


@router.delete(
    "/projects/{project_id}/quotes/{quote_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_item(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """見積書の明細行を1件削除する。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    item = (await db.execute(
        select(QuoteItem).where(QuoteItem.id == item_id, QuoteItem.quote_id == quote_id)
    )).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="明細が見つかりません")

    await db.delete(item)
    await db.flush()

    remaining_items = (await db.execute(
        select(QuoteItem).where(QuoteItem.quote_id == quote_id)
    )).scalars().all()
    subtotal, tax_amount, total_amount = _calc_totals(list(remaining_items))
    quote_row = (await db.execute(
        select(Quote).where(Quote.id == quote_id)
    )).scalar_one()
    quote_row.subtotal = subtotal
    quote_row.tax_amount = tax_amount
    quote_row.total_amount = total_amount

    await db.commit()
