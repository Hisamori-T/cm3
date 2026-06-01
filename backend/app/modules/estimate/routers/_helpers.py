"""見積ルーター群の共通ヘルパー・シリアライザ。

quote_core / quote_versions / quote_sections の3ルーターから import される。
循環 import を防ぐため、このファイルから他の estimate ルーターを import してはいけない。
"""
from __future__ import annotations

import uuid
from math import floor

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project
from app.models.quote import Quote, QuoteItem, QuoteSection, QuoteVersion
from app.schemas.quote import (
    TAX_RATE,
    QuoteDetail,
    QuoteItemRead,
    QuoteSectionRead,
    QuoteVersionRead,
)


# ── DB ヘルパー ───────────────────────────────────────────────────────────────

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


# ── 計算ヘルパー ──────────────────────────────────────────────────────────────

def _calc_item_unit_price(
    cost_price: float | None,
    item_markup: float | None,
    version_markup: float,
) -> float | None:
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


# ── シリアライザ ──────────────────────────────────────────────────────────────

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
