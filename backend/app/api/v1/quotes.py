"""見積書エンドポイント。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from math import floor

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.acknowledgment import Acknowledgment
from app.models.enums import AcknowledgmentStatus, OrderStatus, UserRole
from app.models.invoice import Invoice
from app.models.order import Order
from app.models.project import Project
from app.models.quote import Quote, QuoteItem, QuoteSection, QuoteVersion
from app.models.section_template import SectionTemplate
from app.models.user import User
from app.services.document_sync_service import sync_dependent_documents_on_quote_change
from app.schemas.quote import (
    TAX_RATE,
    QuoteApproveStamp,
    QuoteCreate,
    QuoteDetail,
    QuoteItemInput,
    QuoteItemRead,
    QuoteListItem,
    QuoteSectionCreate,
    QuoteSectionRead,
    QuoteSectionUpdate,
    QuoteUpdate,
    QuoteVersionCreate,
    QuoteVersionRead,
    QuoteVersionUpdate,
)


class _ApplyTemplateBody(BaseModel):
    """テンプレート適用リクエスト。"""

    template_id: uuid.UUID

router = APIRouter(tags=["quotes"])
logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    p = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")
    return p


async def _get_quote_or_404(quote_id: uuid.UUID, project_id: uuid.UUID, db: AsyncSession) -> Quote:
    q = (await db.execute(
        select(Quote)
        .options(
            selectinload(Quote.versions),
            selectinload(Quote.sections),
            selectinload(Quote.items),
        )
        .where(Quote.id == quote_id, Quote.project_id == project_id)
    )).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")
    return q


def _calc_item_unit_price(cost_price: float | None, item_markup: float | None, version_markup: float) -> float | None:
    """顧客向け単価 = 原価 × markup_rate（item > version 優先）。"""
    if cost_price is None:
        return None
    effective_markup = item_markup if item_markup is not None else version_markup
    return round(cost_price * effective_markup)


def _calc_totals(items: list[QuoteItem]) -> tuple[float, float, float]:
    """subtotal, tax_amount, total_amount を返す。"""
    subtotal = sum(float(i.amount or 0) for i in items)
    tax_amount = floor(subtotal * TAX_RATE)
    return subtotal, tax_amount, subtotal + tax_amount


def _build_version_read(v: QuoteVersion) -> QuoteVersionRead:
    return QuoteVersionRead(
        id=v.id,
        version_no=v.version_no,
        vendor_id=v.vendor_id,
        vendor_name_snapshot=v.vendor_name_snapshot,
        markup_rate=float(v.markup_rate),
        is_active=v.is_active,
        notes=v.notes,
        created_at=v.created_at,
        updated_at=v.updated_at,
    )


def _build_section_read(s: QuoteSection) -> QuoteSectionRead:
    return QuoteSectionRead(
        id=s.id,
        section_letter=s.section_letter,
        section_name=s.section_name,
        row_no=s.row_no,
        amount=float(s.amount) if s.amount is not None else None,
    )


def _build_item_read(item: QuoteItem) -> QuoteItemRead:
    return QuoteItemRead(
        id=item.id,
        row_no=item.row_no,
        item_name=item.item_name,
        spec=item.spec,
        unit=item.unit,
        quantity=float(item.quantity) if item.quantity is not None else None,
        cost_price=float(item.cost_price) if item.cost_price is not None else None,
        item_markup_rate=float(item.item_markup_rate) if item.item_markup_rate is not None else None,
        unit_price=float(item.unit_price) if item.unit_price is not None else None,
        amount=float(item.amount) if item.amount is not None else None,
        remarks=item.remarks,
        version_id=item.version_id,
        section_id=item.section_id,
    )


def _build_detail(quote: Quote) -> QuoteDetail:
    return QuoteDetail(
        id=quote.id,
        project_id=quote.project_id,
        quote_number=quote.quote_number,
        issue_date=quote.issue_date,
        validity_days=quote.validity_days,
        project_name_snapshot=quote.project_name_snapshot,
        project_location_snapshot=quote.project_location_snapshot,
        period_start=quote.period_start,
        period_end=quote.period_end,
        payment_condition=quote.payment_condition,
        remarks=quote.remarks,
        conditions_text=quote.conditions_text,
        subtotal=float(quote.subtotal) if quote.subtotal is not None else None,
        tax_amount=float(quote.tax_amount) if quote.tax_amount is not None else None,
        total_amount=float(quote.total_amount) if quote.total_amount is not None else None,
        discount_amount=float(quote.discount_amount) if quote.discount_amount is not None else None,
        approver_id=quote.approver_id,
        approved_at=quote.approved_at,
        reviewer_id=quote.reviewer_id,
        reviewed_at=quote.reviewed_at,
        person_in_charge_id=quote.person_in_charge_id,
        person_in_charge_confirmed_at=quote.person_in_charge_confirmed_at,
        status=quote.status,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
        versions=[_build_version_read(v) for v in sorted(quote.versions, key=lambda x: x.version_no)],
        sections=[_build_section_read(s) for s in sorted(quote.sections, key=lambda x: x.row_no)],
        items=[_build_item_read(i) for i in sorted(quote.items, key=lambda x: x.row_no)],
    )


# ---------------------------------------------------------------------------
# Quote CRUD
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/quotes", response_model=list[QuoteListItem])
async def list_quotes(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuoteListItem]:
    """案件の見積書一覧を返す。"""
    await _get_project_or_404(project_id, db)
    rows = (await db.execute(
        select(Quote).where(Quote.project_id == project_id).order_by(Quote.created_at.desc())
    )).scalars().all()
    return [
        QuoteListItem(
            id=q.id,
            quote_number=q.quote_number,
            issue_date=q.issue_date,
            status=q.status,
            subtotal=float(q.subtotal) if q.subtotal is not None else None,
            tax_amount=float(q.tax_amount) if q.tax_amount is not None else None,
            total_amount=float(q.total_amount) if q.total_amount is not None else None,
            created_at=q.created_at,
        )
        for q in rows
    ]


@router.post("/projects/{project_id}/quotes", response_model=QuoteDetail, status_code=status.HTTP_201_CREATED)
async def create_quote(
    project_id: uuid.UUID,
    body: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """見積書を新規作成する。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    # 枝番自動採番: {project_number}-{N}（手動指定がない場合）
    quote_number = body.quote_number
    if not quote_number:
        existing_count = (await db.execute(
            select(func.count(Quote.id)).where(Quote.project_id == project_id)
        )).scalar_one()
        quote_number = f"{project.project_number}-{existing_count + 1}"

    quote = Quote(
        id=uuid.uuid4(),
        project_id=project_id,
        quote_number=quote_number,
        issue_date=body.issue_date,
        validity_days=body.validity_days,
        project_name_snapshot=body.project_name_snapshot or project.project_name,
        project_location_snapshot=body.project_location_snapshot or project.project_location,
        period_start=body.period_start,
        period_end=body.period_end,
        payment_condition=body.payment_condition,
        remarks=body.remarks,
        conditions_text=body.conditions_text,
        discount_amount=body.discount_amount,
        approver_id=body.approver_id,
        reviewer_id=body.reviewer_id,
        person_in_charge_id=body.person_in_charge_id,
    )
    db.add(quote)
    await db.flush()

    new_items: list[QuoteItem] = []
    for item_in in body.items:
        unit_price = item_in.unit_price
        if unit_price is None and item_in.cost_price is not None:
            unit_price = item_in.cost_price  # markup は後で版経由で計算
        amount = None
        if item_in.quantity is not None and unit_price is not None:
            amount = round(item_in.quantity * unit_price)
        item = QuoteItem(
            id=uuid.uuid4(),
            quote_id=quote.id,
            row_no=item_in.row_no,
            item_name=item_in.item_name,
            spec=item_in.spec,
            unit=item_in.unit,
            quantity=item_in.quantity,
            cost_price=item_in.cost_price,
            item_markup_rate=item_in.item_markup_rate,
            unit_price=unit_price,
            amount=amount,
            remarks=item_in.remarks,
            version_id=item_in.version_id,
            section_id=item_in.section_id,
        )
        db.add(item)
        new_items.append(item)

    subtotal, tax_amount, total_amount = _calc_totals(new_items)
    quote.subtotal = subtotal
    quote.tax_amount = tax_amount
    quote.total_amount = total_amount

    await db.commit()
    result = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.versions), selectinload(Quote.sections), selectinload(Quote.items))
        .where(Quote.id == quote.id)
    )).scalar_one()
    logger.info("quote_created", project_id=str(project_id), quote_id=str(quote.id))
    return _build_detail(result)


@router.get("/projects/{project_id}/quotes/{quote_id}", response_model=QuoteDetail)
async def get_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """見積書の詳細を返す。"""
    await _get_project_or_404(project_id, db)
    quote = await _get_quote_or_404(quote_id, project_id, db)
    return _build_detail(quote)


@router.patch("/projects/{project_id}/quotes/{quote_id}", response_model=QuoteDetail)
async def update_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """見積書ヘッダを更新する。items が含まれる場合は全置換。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    quote = await _get_quote_or_404(quote_id, project_id, db)

    for field_name in [
        "quote_number", "issue_date", "validity_days",
        "project_name_snapshot", "project_location_snapshot",
        "period_start", "period_end", "payment_condition",
        "remarks", "conditions_text", "discount_amount",
        "approver_id", "reviewer_id", "person_in_charge_id",
    ]:
        value = getattr(body, field_name)
        if value is not None:
            setattr(quote, field_name, value)

    if body.items is not None:
        existing_map: dict[int, QuoteItem] = {item.row_no: item for item in quote.items}
        incoming_row_nos = {item_in.row_no for item_in in body.items}
        for row_no, item in existing_map.items():
            if row_no not in incoming_row_nos:
                await db.delete(item)

        updated_items: list[QuoteItem] = []
        for item_in in body.items:
            unit_price = item_in.unit_price
            if unit_price is None and item_in.cost_price is not None:
                unit_price = item_in.cost_price
            amount = None
            if item_in.quantity is not None and unit_price is not None:
                amount = round(item_in.quantity * unit_price)

            if item_in.row_no in existing_map:
                item = existing_map[item_in.row_no]
            else:
                item = QuoteItem(id=uuid.uuid4(), quote_id=quote.id, row_no=item_in.row_no)
                db.add(item)

            item.item_name = item_in.item_name
            item.spec = item_in.spec
            item.unit = item_in.unit
            item.quantity = item_in.quantity
            item.cost_price = item_in.cost_price
            item.item_markup_rate = item_in.item_markup_rate
            item.unit_price = unit_price
            item.amount = amount
            item.remarks = item_in.remarks
            item.version_id = item_in.version_id
            item.section_id = item_in.section_id
            updated_items.append(item)

        subtotal, tax_amount, total_amount = _calc_totals(updated_items)
        quote.subtotal = subtotal
        quote.tax_amount = tax_amount
        quote.total_amount = total_amount

    await db.commit()
    await sync_dependent_documents_on_quote_change(quote_id, db)
    await db.commit()
    db.expunge_all()
    result = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.versions), selectinload(Quote.sections), selectinload(Quote.items))
        .where(Quote.id == quote_id)
    )).scalar_one()
    logger.info("quote_updated", project_id=str(project_id), quote_id=str(quote_id))
    return _build_detail(result)


@router.post("/projects/{project_id}/quotes/{quote_id}/approve", response_model=QuoteDetail)
async def stamp_approval(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteApproveStamp,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """稟議承認スタンプを押す／取り消す。権限ロールによる制限あり。

    担当（person_in_charge）: staff / manager / admin / super_admin
    確認（reviewer）: manager / admin / super_admin
    承認（approver）: admin / super_admin のみ
    """
    from app.models.enums import UserRole
    role = current_user.role

    _PERSON_IN_CHARGE_ROLES = {UserRole.staff, UserRole.manager, UserRole.admin, UserRole.super_admin, UserRole.member}
    _REVIEWER_ROLES = {UserRole.manager, UserRole.admin, UserRole.super_admin}
    _APPROVER_ROLES = {UserRole.admin, UserRole.super_admin}

    if body.stamp_type == "person_in_charge" and role not in _PERSON_IN_CHARGE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="担当確認の権限がありません")
    if body.stamp_type == "reviewer" and role not in _REVIEWER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="確認押印は上長・管理者のみ可能です")
    if body.stamp_type == "approver" and role not in _APPROVER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="承認押印は管理者のみ可能です")

    await _get_project_or_404(project_id, db)
    quote = await _get_quote_or_404(quote_id, project_id, db)

    now = datetime.now(timezone.utc) if body.stamp else None

    if body.stamp_type == "person_in_charge":
        quote.person_in_charge_id = body.user_id
        quote.person_in_charge_confirmed_at = now
    elif body.stamp_type == "reviewer":
        quote.reviewer_id = body.user_id
        quote.reviewed_at = now
    elif body.stamp_type == "approver":
        quote.approver_id = body.user_id
        quote.approved_at = now

    await db.commit()
    db.expunge_all()
    result = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.versions), selectinload(Quote.sections), selectinload(Quote.items))
        .where(Quote.id == quote_id)
    )).scalar_one()
    logger.info("quote_stamped", quote_id=str(quote_id), stamp_type=body.stamp_type, stamp=body.stamp)
    return _build_detail(result)


# ---------------------------------------------------------------------------
# QuoteVersion CRUD
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/quotes/{quote_id}/versions", response_model=list[QuoteVersionRead])
async def list_versions(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuoteVersionRead]:
    """業者見積版の一覧を返す。"""
    await _get_project_or_404(project_id, db)
    await _get_quote_or_404(quote_id, project_id, db)
    rows = (await db.execute(
        select(QuoteVersion).where(QuoteVersion.quote_id == quote_id).order_by(QuoteVersion.version_no)
    )).scalars().all()
    return [_build_version_read(v) for v in rows]


@router.post("/projects/{project_id}/quotes/{quote_id}/versions", response_model=QuoteVersionRead, status_code=status.HTTP_201_CREATED)
async def create_version(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteVersionRead:
    """業者見積版を追加する。version_no は自動採番。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")
    await _get_quote_or_404(quote_id, project_id, db)

    max_no_row = (await db.execute(
        select(QuoteVersion.version_no).where(QuoteVersion.quote_id == quote_id).order_by(QuoteVersion.version_no.desc()).limit(1)
    )).scalar_one_or_none()
    next_no = (max_no_row or 0) + 1

    v = QuoteVersion(
        id=uuid.uuid4(),
        quote_id=quote_id,
        version_no=next_no,
        vendor_id=body.vendor_id,
        vendor_name_snapshot=body.vendor_name_snapshot,
        markup_rate=body.markup_rate,
        notes=body.notes,
    )
    db.add(v)
    await db.commit()
    await db.refresh(v)
    logger.info("quote_version_created", quote_id=str(quote_id), version_no=next_no)
    return _build_version_read(v)


@router.patch("/projects/{project_id}/quotes/{quote_id}/versions/{version_id}", response_model=QuoteVersionRead)
async def update_version(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    version_id: uuid.UUID,
    body: QuoteVersionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteVersionRead:
    """業者見積版を更新する（markup_rate・is_active 等）。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    v = (await db.execute(
        select(QuoteVersion).where(QuoteVersion.id == version_id, QuoteVersion.quote_id == quote_id)
    )).scalar_one_or_none()
    if v is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版が見つかりません")

    for field in ["vendor_id", "vendor_name_snapshot", "markup_rate", "is_active", "notes"]:
        val = getattr(body, field)
        if val is not None:
            setattr(v, field, val)

    await db.commit()
    await db.refresh(v)
    return _build_version_read(v)


@router.delete("/projects/{project_id}/quotes/{quote_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """業者見積版を削除する（明細も CASCADE 削除）。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    v = (await db.execute(
        select(QuoteVersion).where(QuoteVersion.id == version_id, QuoteVersion.quote_id == quote_id)
    )).scalar_one_or_none()
    if v is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版が見つかりません")

    # 版削除時: この版に紐づく QCDS 直接工事費行も削除（最新リビジョンのみ対象）
    from app.models.qcds import QCDS, QCDSDirectWork
    qcds = (await db.execute(
        select(QCDS).where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc()).limit(1)
    )).scalar_one_or_none()
    if qcds and v.vendor_id is not None:
        # vendor_id が一致する行 + vendor_name_snapshot が一致する行を削除
        qcds_works = (await db.execute(
            select(QCDSDirectWork).where(
                QCDSDirectWork.qcds_id == qcds.id,
                QCDSDirectWork.vendor_id == v.vendor_id,
            )
        )).scalars().all()
        for w in qcds_works:
            await db.delete(w)

    await db.delete(v)
    await db.commit()


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
# 版への明細一括インポート（スキャン結果から）
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/quotes/{quote_id}/versions/{version_id}/import-items", response_model=QuoteVersionRead, status_code=status.HTTP_200_OK)
async def import_items_to_version(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    version_id: uuid.UUID,
    items: list[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteVersionRead:
    """スキャン結果などから版に明細行を一括追加する。既存行は保持。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    v = (await db.execute(
        select(QuoteVersion).where(QuoteVersion.id == version_id, QuoteVersion.quote_id == quote_id)
    )).scalar_one_or_none()
    if v is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版が見つかりません")

    max_row_no_row = (await db.execute(
        select(QuoteItem.row_no)
        .where(QuoteItem.version_id == version_id)
        .order_by(QuoteItem.row_no.desc())
        .limit(1)
    )).scalar_one_or_none()
    next_row = (max_row_no_row or 0) + 1

    for idx, raw in enumerate(items):
        cost_price = raw.get("unit_price") or raw.get("cost_price")
        quantity = raw.get("quantity")
        markup = float(v.markup_rate)
        unit_price = round(cost_price * markup) if cost_price else None
        amount = round(quantity * unit_price) if quantity and unit_price else None

        item = QuoteItem(
            id=uuid.uuid4(),
            quote_id=quote_id,
            version_id=version_id,
            row_no=next_row + idx,
            item_name=raw.get("item_name"),
            spec=raw.get("spec"),
            unit=raw.get("unit"),
            quantity=quantity,
            cost_price=cost_price,
            unit_price=unit_price,
            amount=amount,
            remarks=raw.get("remarks"),
            source_scan_result_id=raw.get("source_scan_result_id"),
        )
        db.add(item)

    await db.commit()
    await db.refresh(v)
    return _build_version_read(v)


# ---------------------------------------------------------------------------
# 関連帳票一括生成
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/quotes/{quote_id}/generate-related-documents",
    status_code=status.HTTP_201_CREATED,
)
async def generate_related_documents(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """見積書から注文書・注文請書・請求書のドラフトを一括生成する。

    既存のドラフトがある場合は新規作成せず、既存のIDを返す。
    """
    project = await _get_project_or_404(project_id, db)
    quote = await _get_quote_or_404(quote_id, project_id, db)

    # 既存チェック
    existing_order = (await db.execute(
        select(Order).where(Order.project_id == project_id, Order.quote_id == quote_id)
    )).scalar_one_or_none()

    existing_invoice = (await db.execute(
        select(Invoice).where(Invoice.project_id == project_id, Invoice.quote_id == quote_id)
    )).scalar_one_or_none()

    order_id: uuid.UUID
    invoice_id: uuid.UUID
    ack_id: uuid.UUID | None = None

    if existing_order is not None:
        order_id = existing_order.id
    else:
        order_count = len((await db.execute(
            select(Order).where(Order.project_id == project_id)
        )).scalars().all())
        order = Order(
            project_id=project_id,
            order_number=f"ORD-{order_count + 1:03d}",
            client_company=project.client_name,
            amount_excl_tax=quote.subtotal,
            tax_amount=quote.tax_amount,
            total_amount=quote.total_amount,
            construction_period_start=quote.period_start,
            construction_period_end=quote.period_end,
            payment_condition=quote.payment_condition,
            quote_id=quote_id,
            linked_to_quote=True,
            status=OrderStatus.draft,
        )
        db.add(order)
        await db.flush()
        order_id = order.id

    if existing_invoice is not None:
        invoice_id = existing_invoice.id
    else:
        inv_count = len((await db.execute(
            select(Invoice).where(Invoice.project_id == project_id)
        )).scalars().all())
        invoice = Invoice(
            project_id=project_id,
            invoice_number=f"INV-{inv_count + 1:03d}",
            current_purchase=quote.subtotal,
            tax_amount=quote.tax_amount,
            total_amount=quote.total_amount,
            quote_id=quote_id,
            linked_to_quote=True,
        )
        db.add(invoice)
        await db.flush()
        invoice_id = invoice.id

    existing_ack = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.project_id == project_id, Acknowledgment.order_id == order_id)
    )).scalar_one_or_none()

    if existing_ack is not None:
        ack_id = existing_ack.id
    else:
        ack_count = len((await db.execute(
            select(Acknowledgment).where(Acknowledgment.project_id == project_id)
        )).scalars().all())
        ack = Acknowledgment(
            order_id=order_id,
            project_id=project_id,
            acknowledgment_number=f"ACK-{ack_count + 1:03d}",
            client_company=project.client_name,
            amount_excl_tax=quote.subtotal,
            tax_amount=quote.tax_amount,
            total_amount=quote.total_amount,
            construction_period_start=quote.period_start,
            construction_period_end=quote.period_end,
            payment_condition=quote.payment_condition,
            status=AcknowledgmentStatus.draft,
        )
        db.add(ack)
        await db.flush()
        ack_id = ack.id

    await db.commit()
    logger.info(
        "generated_related_documents",
        project_id=str(project_id),
        quote_id=str(quote_id),
        order_id=str(order_id),
        invoice_id=str(invoice_id),
    )
    return {
        "order_id": str(order_id),
        "acknowledgment_id": str(ack_id),
        "invoice_id": str(invoice_id),
    }


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

        # default_items があれば明細行も作成
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

    # 追加後も見積合計を再計算
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

    # 見積合計を再計算（PATCH 単体更新でも subtotal/total を常に最新に保つ）
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

    # 削除後も見積合計を再計算
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

# ---------------------------------------------------------------------------
# Phase 1-A': 業者見積版からの反映エンドポイント
# ---------------------------------------------------------------------------

class ReflectToQcdsRequest(BaseModel):
    version_id: uuid.UUID
    category: str  # "subcontract" | "material" | "other"

class ReflectToQcdsResponse(BaseModel):
    qcds_id: uuid.UUID
    row_no: int
    vendor_name: str | None
    budget_amount: float
    category: str

@router.post("/projects/{project_id}/qcds/reflect-from-version", response_model=ReflectToQcdsResponse)
async def reflect_version_to_qcds(
    project_id: uuid.UUID,
    body: ReflectToQcdsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReflectToQcdsResponse:
    from sqlalchemy import func as sa_func
    from app.models.enums import QCDSCategory
    from app.models.qcds import QCDS, QCDSDirectWork

    await _get_project_or_404(project_id, db)
    version = (await db.execute(
        select(QuoteVersion).options(selectinload(QuoteVersion.items))
        .where(QuoteVersion.id == body.version_id)
    )).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="版が見つかりません")
    qcds = (await db.execute(
        select(QCDS).where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc()).limit(1)
    )).scalar_one_or_none()
    if qcds is None:
        raise HTTPException(status_code=404, detail="QCDSが見つかりません")
    try:
        cat = QCDSCategory(body.category)
    except ValueError:
        raise HTTPException(status_code=400, detail="category は subcontract / material / other のいずれか")
    total = sum(float(i.amount or 0) for i in version.items)
    max_row = (await db.execute(
        select(sa_func.coalesce(sa_func.max(QCDSDirectWork.row_no), 0))
        .where(QCDSDirectWork.qcds_id == qcds.id)
    )).scalar_one()
    db.add(QCDSDirectWork(
        qcds_id=qcds.id, row_no=max_row + 1,
        work_type=version.vendor_name_snapshot or "スキャン取込",
        vendor_id=version.vendor_id, vendor_name_snapshot=version.vendor_name_snapshot,
        budget_amount=total, category=cat,
    ))
    await db.commit()
    logger.info("version_reflected_to_qcds", version_id=str(body.version_id), total=total)
    return ReflectToQcdsResponse(qcds_id=qcds.id, row_no=max_row + 1,
        vendor_name=version.vendor_name_snapshot, budget_amount=total, category=body.category)


class ReflectToQuoteRequest(BaseModel):
    version_id: uuid.UUID
    markup_rate: float = 1.0
    section_type: str  # "new" | "existing"
    section_name: str | None = None
    section_id: uuid.UUID | None = None

class ReflectToQuoteResponse(BaseModel):
    quote_id: uuid.UUID
    section_id: uuid.UUID
    added_item_count: int

@router.post("/projects/{project_id}/quotes/{quote_id}/reflect-from-version", response_model=ReflectToQuoteResponse)
async def reflect_version_to_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: ReflectToQuoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReflectToQuoteResponse:
    await _get_project_or_404(project_id, db)
    quote = (await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=404, detail="見積書が見つかりません")
    version = (await db.execute(
        select(QuoteVersion).options(selectinload(QuoteVersion.items))
        .where(QuoteVersion.id == body.version_id)
    )).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="版が見つかりません")

    if body.section_type == "new":
        if not body.section_name:
            raise HTTPException(status_code=400, detail="新規大項目の名前を入力してください")
        max_row = (await db.execute(
            select(func.coalesce(func.max(QuoteSection.row_no), 0)).where(QuoteSection.quote_id == quote_id)
        )).scalar_one()
        used = {s.section_letter for s in (await db.execute(
            select(QuoteSection).where(QuoteSection.quote_id == quote_id)
        )).scalars().all()}
        letter = next((chr(ord("A") + i) for i in range(26) if chr(ord("A") + i) not in used), "Z")
        sec = QuoteSection(quote_id=quote_id, section_letter=letter,
                           section_name=body.section_name, row_no=max_row + 1)
        db.add(sec)
        await db.flush()
        target_section_id = sec.id
    else:
        if body.section_id is None:
            raise HTTPException(status_code=400, detail="既存大項目のIDを指定してください")
        ex = (await db.execute(select(QuoteSection).where(
            QuoteSection.id == body.section_id, QuoteSection.quote_id == quote_id
        ))).scalar_one_or_none()
        if ex is None:
            raise HTTPException(status_code=404, detail="指定した大項目が見つかりません")
        target_section_id = body.section_id

    max_item_row = (await db.execute(
        select(func.coalesce(func.max(QuoteItem.row_no), 0))
        .where(QuoteItem.quote_id == quote_id, QuoteItem.version_id.is_(None))
    )).scalar_one()

    items_sorted = sorted(version.items, key=lambda x: x.row_no)
    markup = body.markup_rate
    for i, vi in enumerate(items_sorted):
        cost = float(vi.unit_price or 0)
        up = round(cost * markup) if cost else None
        qty = float(vi.quantity) if vi.quantity is not None else None
        amt = round(up * qty) if (up and qty) else None
        db.add(QuoteItem(
            quote_id=quote_id, section_id=target_section_id,
            row_no=max_item_row + i + 1,
            item_name=vi.item_name, spec=vi.spec, unit=vi.unit, quantity=vi.quantity,
            cost_price=vi.unit_price, unit_price=up, amount=amt,
            source_vendor_id=version.vendor_id, source_type="scan",
        ))

    await db.flush()
    all_items = (await db.execute(
        select(QuoteItem).where(QuoteItem.quote_id == quote_id, QuoteItem.version_id.is_(None))
    )).scalars().all()
    s, t, tot = _calc_totals(list(all_items))
    quote.subtotal = s; quote.tax_amount = t; quote.total_amount = tot
    await db.commit()
    logger.info("version_reflected_to_quote", version_id=str(body.version_id), count=len(items_sorted))
    return ReflectToQuoteResponse(quote_id=quote_id, section_id=target_section_id, added_item_count=len(items_sorted))


class CreateVersionFromVendorRequest(BaseModel):
    vendor_id: uuid.UUID
    source_project_id: uuid.UUID

class CreateVersionFromVendorResponse(BaseModel):
    version_id: uuid.UUID
    version_no: int
    vendor_name_snapshot: str | None
    item_count: int

@router.post("/projects/{project_id}/quote-versions/create-from-vendor", response_model=CreateVersionFromVendorResponse)
async def create_version_from_vendor(
    project_id: uuid.UUID,
    body: CreateVersionFromVendorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreateVersionFromVendorResponse:
    from sqlalchemy import func as sa_func

    await _get_project_or_404(project_id, db)
    quotes = (await db.execute(select(Quote).where(Quote.project_id == project_id))).scalars().all()
    if not quotes:
        quote = Quote(project_id=project_id); db.add(quote); await db.flush()
    else:
        quote = quotes[0]

    src_quotes = (await db.execute(
        select(Quote).where(Quote.project_id == body.source_project_id)
    )).scalars().all()
    if not src_quotes:
        raise HTTPException(status_code=404, detail="参照元案件に見積書がありません")

    src_ver = (await db.execute(
        select(QuoteVersion).options(selectinload(QuoteVersion.items))
        .where(QuoteVersion.quote_id.in_([q.id for q in src_quotes]),
               QuoteVersion.vendor_id == body.vendor_id)
        .order_by(QuoteVersion.version_no.desc())
    )).scalars().first()
    if src_ver is None:
        raise HTTPException(status_code=404, detail="参照元案件にその業者の版がありません")

    from app.models.vendor import Vendor
    vendor = await db.get(Vendor, body.vendor_id)
    vendor_name = vendor.vendor_name if vendor else src_ver.vendor_name_snapshot

    max_vno = (await db.execute(
        select(sa_func.coalesce(sa_func.max(QuoteVersion.version_no), 0))
        .where(QuoteVersion.quote_id == quote.id)
    )).scalar_one()

    new_ver = QuoteVersion(id=uuid.uuid4(), quote_id=quote.id, version_no=max_vno + 1,
                           vendor_id=body.vendor_id, vendor_name_snapshot=vendor_name,
                           markup_rate=src_ver.markup_rate)
    db.add(new_ver)
    await db.flush()

    for item in sorted(src_ver.items, key=lambda x: x.row_no):
        db.add(QuoteItem(
            quote_id=quote.id, version_id=new_ver.id, row_no=item.row_no,
            item_name=item.item_name, spec=item.spec, unit=item.unit,
            quantity=item.quantity, unit_price=item.unit_price,
            cost_price=item.cost_price, amount=item.amount,
            source_vendor_id=body.vendor_id, source_type="import",
        ))

    await db.commit()
    logger.info("version_created_from_vendor", vendor_id=str(body.vendor_id), version_id=str(new_ver.id))
    return CreateVersionFromVendorResponse(
        version_id=new_ver.id, version_no=new_ver.version_no,
        vendor_name_snapshot=new_ver.vendor_name_snapshot, item_count=len(src_ver.items),
    )
