"""見積書→注文書・請求書 連動同期サービス。"""
from __future__ import annotations

import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.order import Order
from app.models.quote import Quote

logger = structlog.get_logger(__name__)


async def sync_dependent_documents_on_quote_change(
    quote_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, int]:
    """見積書の金額変更を、連動中の注文書・請求書に伝播する。

    連動対象: linked_to_quote=True かつ quote_id が一致するレコード。
    同期する項目: amount_excl_tax, tax_amount, total_amount（金額のみ）。
    同期しない項目: 発行日・宛先・支払条件・約款（各帳票で独立編集可能）。
    """
    quote = (await db.execute(
        select(Quote).where(Quote.id == quote_id)
    )).scalar_one_or_none()
    if quote is None:
        logger.warning("sync_skip_quote_not_found", quote_id=str(quote_id))
        return {"orders_synced": 0, "invoices_synced": 0}

    orders = (await db.execute(
        select(Order).where(
            Order.quote_id == quote_id,
            Order.linked_to_quote.is_(True),
        )
    )).scalars().all()

    invoices = (await db.execute(
        select(Invoice).where(
            Invoice.quote_id == quote_id,
            Invoice.linked_to_quote.is_(True),
        )
    )).scalars().all()

    for order in orders:
        order.amount_excl_tax = quote.subtotal
        order.tax_amount = quote.tax_amount
        order.total_amount = quote.total_amount

    for invoice in invoices:
        invoice.current_purchase = quote.subtotal
        invoice.tax_amount = quote.tax_amount
        invoice.total_amount = quote.total_amount

    await db.flush()

    logger.info(
        "sync_documents_on_quote_change",
        quote_id=str(quote_id),
        orders=len(orders),
        invoices=len(invoices),
    )
    return {"orders_synced": len(orders), "invoices_synced": len(invoices)}
