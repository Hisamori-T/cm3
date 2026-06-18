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
from app.models.project import Project
from app.models.quote import Quote
from app.models.user import User
from app.models.company_settings import CompanySettings
from app.services import excel_export
from app.modules.report.services import pdf_export

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
            select(UserModel.id, UserModel.full_name, UserModel.phone, UserModel.stamp_text)
            .where(UserModel.id.in_(user_ids))
        )).all()
        for r in rows:
            # stamp_text 優先。未設定なら姓（スペース区切り先頭）を使用
            if r.stamp_text:
                stamp_users[str(r.id)] = r.stamp_text
            else:
                parts = (r.full_name or "").split()
                stamp_users[str(r.id)] = parts[0] if parts else (r.full_name or "")
            if r.phone:
                stamp_users[f"{r.id}_phone"] = r.phone

    co = await _get_company(db)
    items = sorted(quote.items, key=lambda x: x.row_no)
    sections = sorted(quote.sections, key=lambda x: x.row_no)
    data = pdf_export.generate_quote_pdf(quote, project, items, sections, co, stamp_users)
    filename = f"見積書_{quote.quote_number or quote_id}.pdf"
    return _pdf_response(data, filename)


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
