"""帳票出力エンドポイント（Excel）。"""
from __future__ import annotations

import uuid
from io import BytesIO
from urllib.parse import quote as urlquote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.acknowledgment import Acknowledgment
from app.models.invoice import Invoice
from app.models.order import Order
from app.models.project import Project
from app.models.qcds import QCDS
from app.models.quote import Quote
from app.models.user import User
from app.models.company_settings import CompanySettings
from app.models.invoice import Payment
from app.services import excel_export
from app.modules.report.services import pdf_export, excel_export as new_excel_export

router = APIRouter(tags=["exports"])

PDF_MEDIA_TYPE = "application/pdf"


def _pdf_response(data: bytes, filename: str) -> StreamingResponse:
    encoded = urlquote(filename, safe="")
    return StreamingResponse(
        BytesIO(data),
        media_type=PDF_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


async def _get_company(db: AsyncSession) -> pdf_export.CompanyInfo:
    settings = await db.scalar(select(CompanySettings).where(CompanySettings.id == "default"))
    if settings:
        return pdf_export.company_info_from_db(settings)
    return pdf_export.CompanyInfo()

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(data: bytes, filename: str) -> StreamingResponse:
    """XLSXファイルをストリームレスポンスとして返す。ファイル名はRFC5987形式でURLエンコードする。"""
    encoded = urlquote(filename, safe="")
    return StreamingResponse(
        BytesIO(data),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


async def _get_project(project_id: uuid.UUID, db: AsyncSession) -> Project:
    proj = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")
    return proj


@router.get("/projects/{project_id}/quotes/{quote_id}/export")
async def export_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """見積書をExcelで出力する。"""
    project = await _get_project(project_id, db)
    quote = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.items), selectinload(Quote.sections))
        .where(Quote.id == quote_id, Quote.project_id == project_id)
    )).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

    items = sorted(quote.items, key=lambda x: x.row_no)
    sections = sorted(quote.sections, key=lambda x: x.row_no)
    data = excel_export.export_quote_excel(quote, project, items, sections)
    filename = f"見積書_{quote.quote_number or quote_id}.xlsx"
    return _xlsx_response(data, filename)


@router.get("/projects/{project_id}/orders/{order_id}/export")
async def export_order(
    project_id: uuid.UUID,
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """注文書をExcelで出力する。"""
    project = await _get_project(project_id, db)
    order = (await db.execute(
        select(Order).where(Order.id == order_id, Order.project_id == project_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文書が見つかりません")

    data = excel_export.export_order_excel(order, project)
    filename = f"注文書_{order.order_number or order_id}.xlsx"
    return _xlsx_response(data, filename)


@router.get("/acknowledgments/{acknowledgment_id}/export")
async def export_acknowledgment(
    acknowledgment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """注文請書をExcelで出力する。"""
    ack = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.id == acknowledgment_id)
    )).scalar_one_or_none()
    if ack is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文請書が見つかりません")

    project = (await db.execute(
        select(Project).where(Project.id == ack.project_id)
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    data = excel_export.export_acknowledgment_excel(ack, project)
    filename = f"注文請書_{ack.acknowledgment_number or acknowledgment_id}.xlsx"
    return _xlsx_response(data, filename)


@router.get("/projects/{project_id}/export")
async def export_project_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """案件の全データ（案件情報・QCDS・見積・注文・請求）を一括でExcel出力する。"""
    project = await _get_project(project_id, db)

    qcds = (await db.execute(
        select(QCDS)
        .options(selectinload(QCDS.direct_works))
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
    )).scalars().first()
    qcds_rows = qcds.direct_works if qcds else []

    quotes = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.items))
        .where(Quote.project_id == project_id)
        .order_by(Quote.created_at)
    )).scalars().all()

    orders = (await db.execute(
        select(Order).where(Order.project_id == project_id).order_by(Order.created_at)
    )).scalars().all()

    invoices = (await db.execute(
        select(Invoice).where(Invoice.project_id == project_id).order_by(Invoice.created_at)
    )).scalars().all()

    data = excel_export.export_project_all_excel(project, qcds_rows, list(quotes), list(orders), list(invoices))
    client = getattr(project, "client_name", "") or ""
    pname  = getattr(project, "project_name", "") or ""
    filename = f"工事台帳_{project.project_number}_{pname}_{client}.xlsx".replace("/", "_").replace("\\", "_")
    return _xlsx_response(data, filename)


@router.get("/projects/{project_id}/invoices/{invoice_id}/export")
async def export_invoice(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """請求書をExcelで出力する。"""
    project = await _get_project(project_id, db)
    invoice = (await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")

    data = excel_export.export_invoice_excel(invoice, project)
    filename = f"請求書_{invoice.invoice_number or invoice_id}.xlsx"
    return _xlsx_response(data, filename)


# ── PDF エンドポイント ─────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/quotes/{quote_id}/export-pdf")
async def export_quote_pdf(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """見積書をPDFで出力する。"""
    from app.models.user import User as UserModel
    project = await _get_project(project_id, db)
    quote = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.items), selectinload(Quote.sections))
        .where(Quote.id == quote_id, Quote.project_id == project_id)
    )).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

    # 承認押印ユーザー名マップ（phone も含める: key = "{id}_phone"）
    user_ids = [uid for uid in [
        quote.person_in_charge_id, quote.reviewer_id, quote.approver_id
    ] if uid]
    stamp_users: dict[str, str] = {}
    if user_ids:
        rows = (await db.execute(
            select(UserModel.id, UserModel.full_name, UserModel.phone).where(UserModel.id.in_(user_ids))
        )).all()
        for r in rows:
            stamp_users[str(r.id)] = r.full_name
            if r.phone:
                stamp_users[f"{r.id}_phone"] = r.phone

    co = await _get_company(db)
    items = sorted(quote.items, key=lambda x: x.row_no)
    sections = sorted(quote.sections, key=lambda x: x.row_no)
    data = pdf_export.generate_quote_pdf(quote, project, items, sections, co, stamp_users)
    filename = f"見積書_{quote.quote_number or quote_id}.pdf"
    return _pdf_response(data, filename)


@router.get("/projects/{project_id}/invoices/{invoice_id}/export-pdf")
async def export_invoice_pdf(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """請求書をPDFで出力する。"""
    project = await _get_project(project_id, db)
    invoice = (await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items), selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")

    payments = list(invoice.payments)

    co = await _get_company(db)
    data = pdf_export.generate_invoice_pdf(invoice, project, co, list(payments))
    filename = f"請求書_{invoice.invoice_number or invoice_id}.pdf"
    return _pdf_response(data, filename)


@router.get("/projects/{project_id}/orders/{order_id}/export-pdf")
async def export_order_pdf(
    project_id: uuid.UUID,
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """注文書をPDFで出力する。"""
    project = await _get_project(project_id, db)
    order = (await db.execute(
        select(Order).where(Order.id == order_id, Order.project_id == project_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文書が見つかりません")

    co = await _get_company(db)
    data = pdf_export.generate_order_pdf(order, project, co)
    filename = f"注文書_{order.order_number or order_id}.pdf"
    return _pdf_response(data, filename)


@router.get("/acknowledgments/{acknowledgment_id}/export-pdf")
async def export_acknowledgment_pdf(
    acknowledgment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """注文請書をPDFで出力する。"""
    ack = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.id == acknowledgment_id)
    )).scalar_one_or_none()
    if ack is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文請書が見つかりません")

    project = (await db.execute(
        select(Project).where(Project.id == ack.project_id)
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    co = await _get_company(db)
    data = pdf_export.generate_acknowledgment_pdf(ack, project, co)
    filename = f"注文請書_{ack.acknowledgment_number or acknowledgment_id}.pdf"
    return _pdf_response(data, filename)


# ── 写真台帳 PDF ──────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/photo-album/export-pdf")
async def export_photo_album(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """写真台帳を PDF で出力する。"""
    import base64 as b64mod
    from pathlib import Path as _Path

    from app.models.progress import ProgressLog, ProgressAttachment

    project = await _get_project(project_id, db)

    logs = (await db.execute(
        select(ProgressLog)
        .options(selectinload(ProgressLog.attachments))
        .where(ProgressLog.project_id == project_id)
        .order_by(ProgressLog.logged_at)
    )).scalars().all()

    _TYPE_ORDER = ["before", "during", "after", "issue", "drawing"]
    _TYPE_LABEL = {
        "before": "施工前", "during": "施工中", "after": "施工後",
        "issue": "問題箇所", "drawing": "図面",
    }

    # 工種別グループ化（photo_type 優先）
    by_type: dict[str, list[dict]] = {t: [] for t in _TYPE_ORDER}
    by_type["other"] = []

    for log in logs:
        for att in log.attachments:
            if not (att.mime_type or "").startswith("image/"):
                continue
            fp = _Path(att.file_path)
            if not fp.exists():
                continue
            try:
                raw = fp.read_bytes()
                encoded = b64mod.b64encode(raw).decode()
            except Exception:
                continue

            taken_str = ""
            if att.taken_at:
                taken_str = att.taken_at.strftime("%Y/%m/%d")
            elif log.logged_at:
                taken_str = log.logged_at.strftime("%Y/%m/%d")

            photo = {
                "b64":       encoded,
                "mime_type": att.mime_type or "image/jpeg",
                "caption":   att.caption or "",
                "work_type": att.work_type or "",
                "taken_at":  taken_str,
            }
            pt = att.photo_type.value if att.photo_type else None
            if pt in by_type:
                by_type[pt].append(photo)
            else:
                by_type["other"].append(photo)

    photo_groups = []
    for t in _TYPE_ORDER:
        if by_type[t]:
            photo_groups.append({"label": _TYPE_LABEL[t], "photos": by_type[t]})
    if by_type["other"]:
        photo_groups.append({"label": "その他", "photos": by_type["other"]})

    co = await _get_company(db)
    period_start = str(project.period_actual_start or project.period_contract_start or "") or None
    period_end   = str(project.period_actual_end   or project.period_contract_end   or "") or None

    pdf_bytes = pdf_export.generate_photo_album_pdf(
        project_name=project.project_name,
        project_number=project.project_number,
        client_name=project.client_name,
        period_start=period_start,
        period_end=period_end,
        photo_groups=photo_groups,
        company=co,
    )
    filename = f"写真台帳_{project.project_number}.pdf"
    return _pdf_response(pdf_bytes, filename)


# ── 見積条件書 PDF ──────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/quotes/{quote_id}/condition-pdf")
async def export_condition_pdf(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """見積条件書を PDF で出力する。"""
    from app.models.condition import QuoteConditionItem

    project = await _get_project(project_id, db)
    quote = (await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=404, detail="見積書が見つかりません")

    items = (await db.execute(
        select(QuoteConditionItem)
        .where(QuoteConditionItem.quote_id == quote_id)
        .order_by(QuoteConditionItem.display_order)
    )).scalars().all()

    condition_text = "\n\n".join(item.content for item in items)
    period_start = str(getattr(quote, "period_start", None) or project.period_contract_start or "") or None
    period_end   = str(getattr(quote, "period_end",   None) or project.period_contract_end   or "") or None

    co = await _get_company(db)
    data = pdf_export.generate_condition_pdf(
        project_name=getattr(quote, "project_name_snapshot", None) or project.project_name or "",
        period_start=period_start,
        period_end=period_end,
        payment_condition=getattr(quote, "payment_condition", None) or project.payment_condition,
        condition_text=condition_text,
        company=co,
    )
    filename = f"見積条件書_{project.project_number or project_id}.pdf"
    return _pdf_response(data, filename)


@router.get("/purchase-orders/{order_id}/export-pdf")
async def export_purchase_order_pdf(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """発注書をPDFで出力する。"""
    from app.models.purchase import PurchaseOrder, PurchaseOrderItem
    from app.models.vendor import Vendor
    order = (await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == order_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")

    project = await _get_project(order.project_id, db)

    # vendor_name をモデルに注入（read-only 参照用）
    if order.vendor_id and not getattr(order, "vendor_name", None):
        vendor = await db.get(Vendor, order.vendor_id)
        if vendor:
            object.__setattr__(order, "vendor_name", vendor.vendor_name) if hasattr(order, "__setattr__") else None
            order.__dict__["vendor_name"] = vendor.vendor_name

    co = await _get_company(db)
    data = pdf_export.generate_purchase_order_pdf(order, project, co)
    filename = f"発注書_{order.order_number or order_id}.pdf"
    return _pdf_response(data, filename)



@router.get("/projects/{project_id}/export-pdf")
async def export_project_ledger_pdf(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """工事台帳（実行予算・取決見通）を PDF で出力する。"""
    from app.models.qcds import QCDS
    project = await _get_project(project_id, db)
    qcds = (await db.execute(
        select(QCDS).options(selectinload(QCDS.direct_works))
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
    )).scalars().first()
    direct_works = qcds.direct_works if qcds else []
    co = await _get_company(db)
    data = pdf_export.generate_ledger_pdf(project, qcds, list(direct_works), co)
    client = getattr(project, "client_name", "") or ""
    pname  = getattr(project, "project_name", "") or ""
    filename = f"工事台帳_{project.project_number}_{pname}_{client}.pdf".replace("/", "_")
    return _pdf_response(data, filename)


@router.get("/projects/{project_id}/qcds/export-excel")
async def export_qcds_excel_ep(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """QCDS 原価算定表を Excel で出力する。"""
    from app.models.qcds import QCDS
    project = await _get_project(project_id, db)
    qcds = (await db.execute(
        select(QCDS).options(selectinload(QCDS.direct_works))
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
    )).scalars().first()
    if qcds is None:
        raise HTTPException(status_code=404, detail="QCDSデータがありません")
    data = new_excel_export.export_qcds_excel(project, qcds)
    filename = f"QCDS_{project.project_number}_{getattr(project,'project_name','')}.xlsx".replace("/","_")
    return _xlsx_response(data, filename)


@router.get("/projects/{project_id}/qcds/export-pdf")
async def export_qcds_pdf_ep(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """QCDS 原価算定表を PDF で出力する。"""
    from app.models.qcds import QCDS
    project = await _get_project(project_id, db)
    qcds = (await db.execute(
        select(QCDS).options(selectinload(QCDS.direct_works))
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
    )).scalars().first()
    if qcds is None:
        raise HTTPException(status_code=404, detail="QCDSデータがありません")
    co = await _get_company(db)
    data = pdf_export.generate_qcds_pdf(project, qcds, co)
    filename = f"QCDS_{project.project_number}_{getattr(project,'project_name','')}.pdf".replace("/","_")
    return _pdf_response(data, filename)
