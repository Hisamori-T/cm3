"""見積書サービス — 案件作成時の初期 Quote / QuoteVersion 自動生成など。"""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quote import Quote, QuoteVersion


async def create_initial_quote(
    project_id: uuid.UUID,
    project_number: str,
    project_name: str,
    project_location: str | None,
    db: AsyncSession,
) -> Quote:
    """案件作成と同時に見積書と第1版（業者見積版）を生成する。

    project/router.py の create_project から呼び出される。
    flush のみ行い、commit は呼び出し元に委ねる。
    """
    quote = Quote(
        id=uuid.uuid4(),
        project_id=project_id,
        quote_number=f"{project_number}-1",
        project_name_snapshot=project_name,
        project_location_snapshot=project_location,
        validity_days=30,
    )
    db.add(quote)
    await db.flush()

    first_version = QuoteVersion(
        id=uuid.uuid4(),
        quote_id=quote.id,
        version_no=1,
        markup_rate=1.0,
        is_active=True,
    )
    db.add(first_version)

    return quote
