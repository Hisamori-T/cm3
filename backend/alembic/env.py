"""Alembic マイグレーション環境設定（asyncpg / SQLAlchemy 2.0 対応）。"""
import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# モデルを全てインポートして Base.metadata に登録する
from app.core.database import Base
import app.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# DATABASE_URL 環境変数から URL を設定（alembic.ini の sqlalchemy.url を上書き）
db_url = os.environ.get("DATABASE_URL", "")
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def do_run_migrations(connection: Connection) -> None:
    """同期コンテキストでマイグレーションを実行。"""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """非同期エンジンでマイグレーションを実行。"""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """オンラインモードでのマイグレーション実行エントリポイント。"""
    asyncio.run(run_async_migrations())


run_migrations_online()
