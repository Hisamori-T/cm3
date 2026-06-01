"""初期データ投入スクリプト。
管理者ユーザー・印紙税テーブル・サンプル業者を作成する。

実行方法:
  docker exec cmv3-api uv run python -m app.scripts.seed
"""
import asyncio
import sys
import uuid
from datetime import date

import structlog
from argon2 import PasswordHasher
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.master import StampTaxTable
from app.models.user import User
from app.models.vendor import Vendor
from app.models.enums import UserRole

logger = structlog.get_logger(__name__)
ph = PasswordHasher()


async def seed_admin_user(session) -> None:
    """管理者ユーザーを作成（既存なら何もしない）。"""
    result = await session.execute(select(User).where(User.email == settings.admin_email))
    if result.scalar_one_or_none():
        logger.info("admin_user_exists", email=settings.admin_email)
        return

    user = User(
        id=uuid.uuid4(),
        email=settings.admin_email,
        hashed_password=ph.hash(settings.admin_password),
        full_name="管理者",
        employee_number=1,
        role=UserRole.admin,
        department="管理",
        is_active=True,
    )
    session.add(user)
    logger.info("admin_user_created", email=settings.admin_email)


async def seed_stamp_tax_table(session) -> None:
    """印紙税額テーブルを投入（既存なら何もしない）。"""
    result = await session.execute(select(StampTaxTable).limit(1))
    if result.scalar_one_or_none():
        logger.info("stamp_tax_table_exists")
        return

    # 2024年現在の印紙税額（建設工事請負契約書・第2号文書）
    effective = date(2024, 1, 1)
    rows = [
        (0,          1_000_000,       0),
        (1_000_000,  5_000_000,   2_000),
        (5_000_000,  10_000_000,  10_000),
        (10_000_000, 50_000_000,  20_000),
        (50_000_000, 100_000_000, 60_000),
        (100_000_000, 500_000_000, 100_000),
        (500_000_000, 1_000_000_000, 200_000),
        (1_000_000_000, None,       400_000),
    ]
    for min_amt, max_amt, tax in rows:
        session.add(StampTaxTable(
            id=uuid.uuid4(),
            min_amount=min_amt,
            max_amount=max_amt,
            tax_amount=tax,
            effective_from=effective,
        ))
    logger.info("stamp_tax_table_seeded", count=len(rows))


async def seed_sample_vendors(session) -> None:
    """サンプル業者を数件投入（既存なら何もしない）。"""
    result = await session.execute(select(Vendor).limit(1))
    if result.scalar_one_or_none():
        logger.info("vendors_exist")
        return

    vendors = [
        Vendor(
            id=uuid.uuid4(),
            vendor_name="株式会社HIT",
            vendor_name_kana="カブシキカイシャエイチアイティー",
            primary_work_types=["内装解体", "仮設"],
            phone="0776-XX-XXXX",
            is_active=True,
        ),
        Vendor(
            id=uuid.uuid4(),
            vendor_name="開拓工業株式会社",
            vendor_name_kana="カイタクコウギョウカブシキカイシャ",
            primary_work_types=["土工事", "外構"],
            phone="0776-XX-XXXX",
            is_active=True,
        ),
        Vendor(
            id=uuid.uuid4(),
            vendor_name="有限会社サンプル電気",
            vendor_name_kana="ユウゲンカイシャサンプルデンキ",
            primary_work_types=["電気工事"],
            phone="0776-XX-XXXX",
            is_active=True,
        ),
    ]
    for v in vendors:
        session.add(v)
    logger.info("sample_vendors_seeded", count=len(vendors))


async def main() -> None:
    """シードデータを投入する。"""
    logger.info("seed_start")
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await seed_admin_user(session)
            await seed_stamp_tax_table(session)
            await seed_sample_vendors(session)
    logger.info("seed_complete")


if __name__ == "__main__":
    asyncio.run(main())
