"""業者見積版 CRUD・import・顧客見積反映・業者マスタからの版作成ルーター。"""
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
from app.models.enums import QuoteStatus, UserRole
from app.models.quote import Quote, QuoteItem, QuoteSection, QuoteVersion
from app.models.user import User
from app.schemas.quote import (
    QuoteVersionCreate,
    QuoteVersionRead,
    QuoteVersionUpdate,
)
from app.modules.estimate.routers._helpers import (
    _get_project_or_404,
    _get_quote_or_404,
    _build_version_read,
    _calc_totals,
    _build_detail,
)

router = APIRouter(tags=["quotes"])
logger = structlog.get_logger(__name__)


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

    await db.delete(v)
    await db.commit()


# ---------------------------------------------------------------------------
# 版への明細一括インポート（スキャン結果から）
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/quotes/{quote_id}/versions/{version_id}/import-items",
    response_model=QuoteVersionRead,
    status_code=status.HTTP_200_OK,
)
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
# Phase 1-A': 業者見積版からの反映エンドポイント
# ---------------------------------------------------------------------------

class ReflectToQuoteRequest(BaseModel):
    """顧客見積への反映リクエスト。"""
    version_id: uuid.UUID
    markup_rate: float = 1.0
    section_type: str  # "new" | "existing"
    section_name: str | None = None
    section_id: uuid.UUID | None = None


class ReflectToQuoteResponse(BaseModel):
    """顧客見積への反映レスポンス。"""
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
    """業者見積版の明細を顧客見積に掛率適用でコピーする。"""
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
            source_vendor_id=version.vendor_id, source_version_id=version.id, source_type="scan",
        ))

    await db.flush()
    all_items = (await db.execute(
        select(QuoteItem).where(QuoteItem.quote_id == quote_id, QuoteItem.version_id.is_(None))
    )).scalars().all()
    s, t, tot = _calc_totals(list(all_items))
    quote.subtotal = s
    quote.tax_amount = t
    quote.total_amount = tot
    await db.commit()
    logger.info("version_reflected_to_quote", version_id=str(body.version_id), count=len(items_sorted))
    return ReflectToQuoteResponse(
        quote_id=quote_id, section_id=target_section_id, added_item_count=len(items_sorted)
    )


class CreateVersionFromVendorRequest(BaseModel):
    """業者マスタからの版作成リクエスト。"""
    vendor_id: uuid.UUID
    source_project_id: uuid.UUID


class CreateVersionFromVendorResponse(BaseModel):
    """業者マスタからの版作成レスポンス。"""
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
    """業者マスタの過去案件から版をコピーして新版を作成する。"""
    from sqlalchemy import func as sa_func

    await _get_project_or_404(project_id, db)
    quotes = (await db.execute(select(Quote).where(Quote.project_id == project_id))).scalars().all()
    if not quotes:
        quote = Quote(project_id=project_id)
        db.add(quote)
        await db.flush()
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

    new_ver = QuoteVersion(
        id=uuid.uuid4(), quote_id=quote.id, version_no=max_vno + 1,
        vendor_id=body.vendor_id, vendor_name_snapshot=vendor_name,
        markup_rate=src_ver.markup_rate,
    )
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


# ---------------------------------------------------------------------------
# 掛け率変更 → 顧客見積再反映
# ---------------------------------------------------------------------------

class MarkupApplyRequest(BaseModel):
    """掛け率変更・顧客見積再反映リクエスト。"""
    new_markup_rate: float
    apply_to_customer_quote: bool = True
    force_reset_approval: bool = False


class MarkupApplyResponse(BaseModel):
    """掛け率変更・顧客見積再反映レスポンス。"""
    vendor_quote: QuoteVersionRead
    customer_quote_updated: bool
    affected_items_count: int
    approval_reset: bool
    change_set_id: str


@router.patch(
    "/projects/{project_id}/quotes/{quote_id}/versions/{version_id}/markup-apply",
    response_model=MarkupApplyResponse,
)
async def apply_markup_rate(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    version_id: uuid.UUID,
    body: MarkupApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarkupApplyResponse:
    """業者見積版の掛け率を更新し、オプションで顧客見積明細を版単位で再計算する。

    source_version_id が設定された顧客明細（reflect-from-version で作成）のみが対象。
    source_version_id が NULL のレガシー明細には触れない。
    """
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    quote = (await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

    version = (await db.execute(
        select(QuoteVersion).where(QuoteVersion.id == version_id, QuoteVersion.quote_id == quote_id)
    )).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版が見つかりません")

    old_markup_rate = float(version.markup_rate)
    version.markup_rate = body.new_markup_rate

    # 顧客見積明細の再計算（source_version_id で版単位に絞る）
    affected_count = 0
    if body.apply_to_customer_quote:
        customer_items = (await db.execute(
            select(QuoteItem).where(
                QuoteItem.quote_id == quote_id,
                QuoteItem.version_id.is_(None),
                QuoteItem.source_version_id == version_id,
            )
        )).scalars().all()
        for item in customer_items:
            if item.cost_price is not None:
                new_up = round(float(item.cost_price) * body.new_markup_rate)
                item.unit_price = new_up
                if item.quantity is not None:
                    item.amount = round(new_up * float(item.quantity))
        affected_count = len(customer_items)

        # 顧客見積の合計再計算
        all_customer = (await db.execute(
            select(QuoteItem).where(
                QuoteItem.quote_id == quote_id,
                QuoteItem.version_id.is_(None),
            )
        )).scalars().all()
        s, t, tot = _calc_totals(list(all_customer))
        quote.subtotal = s
        quote.tax_amount = t
        quote.total_amount = tot

    # 承認リセット（アクティブな承認依頼を取り下げ + Quoteスタンプをクリア）
    approval_reset = False
    if body.force_reset_approval:
        from app.models.approval import ApprovalRequest
        active_req = (await db.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.quote_id == quote_id,
                ApprovalRequest.status.in_(["pending", "approved"]),
            )
        )).scalars().first()
        if active_req:
            active_req.status = "withdrawn"
            quote.approver_id = None
            quote.approved_at = None
            quote.reviewer_id = None
            quote.reviewed_at = None
            quote.person_in_charge_id = None
            quote.person_in_charge_confirmed_at = None
            quote.status = QuoteStatus.draft
            approval_reset = True

    # 編集履歴に記録
    change_set_id = str(uuid.uuid4())
    from app.shared.models.history import EditHistory
    from app.shared.models.enums import EditHistoryChangeType
    db.add(EditHistory(
        entity_type="quote_version",
        entity_id=version_id,
        project_id=project.id,
        changed_by=current_user.id,
        change_type=EditHistoryChangeType.update,
        field_changes={
            "change_set_id": change_set_id,
            "markup_rate": {"before": old_markup_rate, "after": body.new_markup_rate},
            "vendor_name": version.vendor_name_snapshot,
            "affected_items_count": affected_count,
            "apply_to_customer_quote": body.apply_to_customer_quote,
            "approval_reset": approval_reset,
        },
    ))

    await db.commit()
    await db.refresh(version)
    logger.info(
        "markup_rate_applied",
        version_id=str(version_id),
        old_rate=old_markup_rate,
        new_rate=body.new_markup_rate,
        affected_count=affected_count,
    )
    return MarkupApplyResponse(
        vendor_quote=_build_version_read(version),
        customer_quote_updated=body.apply_to_customer_quote and affected_count > 0,
        affected_items_count=affected_count,
        approval_reset=approval_reset,
        change_set_id=change_set_id,
    )


# ---------------------------------------------------------------------------
# 業者名変更エンドポイント
# ---------------------------------------------------------------------------

class VendorNameUpdateRequest(BaseModel):
    """業者名変更リクエスト。vendor_id=null は業者マスタ未登録の業者を許容。"""
    vendor_id: uuid.UUID | None = None
    vendor_name_snapshot: str


class VendorNameUpdateResponse(BaseModel):
    """業者名変更レスポンス。"""
    version: QuoteVersionRead


@router.patch(
    "/projects/{project_id}/quotes/{quote_id}/versions/{version_id}/vendor-name",
    response_model=VendorNameUpdateResponse,
)
async def update_vendor_name(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    version_id: uuid.UUID,
    body: VendorNameUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorNameUpdateResponse:
    """業者見積版の業者名（vendor_name_snapshot / vendor_id）を更新する。

    PDFスキャン誤読の訂正用途。顧客見積明細の source_vendor_id は変更しない。
    """
    project = await _get_project_or_404(project_id, db)
    quote = await _get_quote_or_404(quote_id, project_id, db)
    version = next((v for v in quote.versions if v.id == version_id), None)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版が見つかりません")

    old_vendor_id = version.vendor_id
    old_vendor_name = version.vendor_name_snapshot

    version.vendor_id = body.vendor_id
    version.vendor_name_snapshot = body.vendor_name_snapshot

    from app.shared.models.history import EditHistory
    from app.shared.models.enums import EditHistoryChangeType
    db.add(EditHistory(
        entity_type="quote_version",
        entity_id=version_id,
        project_id=project.id,
        changed_by=current_user.id,
        change_type=EditHistoryChangeType.update,
        field_changes={
            "change_kind": "vendor_name_change",
            "old_vendor_id": str(old_vendor_id) if old_vendor_id else None,
            "new_vendor_id": str(body.vendor_id) if body.vendor_id else None,
            "old_vendor_name": old_vendor_name,
            "new_vendor_name": body.vendor_name_snapshot,
            "version_id": str(version_id),
        },
    ))

    await db.commit()
    await db.refresh(version)
    logger.info(
        "vendor_name_updated",
        version_id=str(version_id),
        old_name=old_vendor_name,
        new_name=body.vendor_name_snapshot,
    )
    return VendorNameUpdateResponse(version=_build_version_read(version))
