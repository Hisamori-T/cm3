"""請求書関連の定期タスク。"""
from __future__ import annotations

import asyncio
from datetime import date

import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="invoice_tasks.check_overdue_invoices", bind=True, max_retries=3)
def check_overdue_invoices(self) -> dict:  # type: ignore[type-arg]
    """支払期日を過ぎた請求書を overdue ステータスに更新する（毎朝9時JST）。"""
    return asyncio.get_event_loop().run_until_complete(_check_overdue_async())


async def _check_overdue_async() -> dict:
    from sqlalchemy import select, update
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    from app.core.config import settings
    from app.models.enums import InvoiceStatus
    from app.models.invoice import Invoice

    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    today = date.today()
    updated = 0

    async with async_session() as session:
        result = await session.execute(
            update(Invoice)
            .where(
                Invoice.status == InvoiceStatus.sent,
                Invoice.payment_due_date < today,
                Invoice.payment_due_date.isnot(None),
            )
            .values(status=InvoiceStatus.overdue)
            .returning(Invoice.id)
        )
        updated = len(result.fetchall())
        await session.commit()

    await engine.dispose()
    logger.info("check_overdue_invoices completed", updated=updated, date=str(today))
    return {"updated": updated, "date": str(today)}
