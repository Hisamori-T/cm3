"""pytest 共通フィクスチャ。ライブAPI（localhost:8000）に対して統合テストを実行する。"""
from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
import httpx
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

# テスト用ユーザー情報（セッション内で一意に生成）
_TEST_SUFFIX = uuid.uuid4().hex[:8]
TEST_EMAIL = f"pytest_{_TEST_SUFFIX}@example.com"
TEST_PASSWORD = "PytestPass123!"

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://cmv3user:cmv3pass@cmv3-db:5432/cmv3",
)
BASE_URL = "http://localhost:8000"


# ── DB エンジン (session スコープ) ─────────────────────────────────────────

@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest_asyncio.fixture(scope="session")
async def engine():
    e = create_async_engine(DATABASE_URL)
    yield e
    await e.dispose()


# ── テストユーザー作成・削除 ────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="session")
async def test_user(engine):
    """セッション開始時にテスト管理者ユーザーを作成し、終了時に削除する。"""
    from app.models.user import User
    from app.models.enums import UserRole
    from app.core.security import hash_password

    async with AsyncSession(engine) as session:
        user = User(
            email=TEST_EMAIL,
            hashed_password=hash_password(TEST_PASSWORD),
            full_name="pytestユーザー",
            role=UserRole.admin,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        uid = user.id

    yield {"id": str(uid), "email": TEST_EMAIL, "password": TEST_PASSWORD}

    # まず作成したプロジェクト（deleted_at含む）を物理削除してからユーザー削除
    from app.models.project import Project
    from sqlalchemy import update
    async with AsyncSession(engine) as session:
        # FK制約を避けるため edit_histories → quotes/orders/invoices → projects → users の順に削除
        from app.models.history import EditHistory
        from app.models.quote import Quote, QuoteItem
        from sqlalchemy import select as sa_select
        proj_ids = (await session.execute(
            sa_select(Project.id).where(Project.created_by == uid)
        )).scalars().all()
        if proj_ids:
            for pid in proj_ids:
                await session.execute(
                    delete(QuoteItem).where(
                        QuoteItem.quote_id.in_(
                            sa_select(Quote.id).where(Quote.project_id == pid)
                        )
                    )
                )
            await session.execute(delete(Quote).where(Quote.project_id.in_(proj_ids)))
            await session.execute(delete(EditHistory).where(EditHistory.project_id.in_(proj_ids)))
            await session.execute(delete(Project).where(Project.id.in_(proj_ids)))
        await session.execute(delete(User).where(User.id == uid))
        await session.commit()


@pytest_asyncio.fixture(scope="session")
async def token(test_user) -> str:
    """テストユーザーのアクセストークンを取得する。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user["email"], "password": test_user["password"]},
        )
        assert r.status_code == 200, f"login failed: {r.text}"
        return str(r.json()["access_token"])


@pytest.fixture(scope="session")
def auth(token) -> dict[str, str]:
    """Authorization ヘッダーを返す。"""
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def client() -> httpx.AsyncClient:
    """テスト用 httpx クライアント（接続を都度生成）。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        yield c
