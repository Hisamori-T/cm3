"""管理者エンドポイント（ユーザー管理・印紙税）のテスト。"""
from __future__ import annotations

import uuid
import pytest
import httpx
from .conftest import BASE_URL


@pytest.mark.asyncio
async def test_list_users(auth):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/admin/users", headers=auth)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert any(u["role"] == "admin" for u in users)


@pytest.mark.asyncio
async def test_create_and_update_user(auth):
    email = f"test_admin_{uuid.uuid4().hex[:6]}@example.com"
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        # 作成
        cr = await c.post("/api/v1/admin/users", json={
            "email": email,
            "full_name": "テスト太郎",
            "password": "TestPass123!",
            "role": "member",
        }, headers=auth)
        assert cr.status_code == 201
        uid = cr.json()["id"]
        # 更新
        ur = await c.patch(f"/api/v1/admin/users/{uid}", json={
            "full_name": "テスト次郎",
            "department": "施工部",
        }, headers=auth)
        assert ur.status_code == 200
        assert ur.json()["full_name"] == "テスト次郎"
        # 無効化
        dr = await c.patch(f"/api/v1/admin/users/{uid}", json={"is_active": False}, headers=auth)
        assert dr.status_code == 200
        assert dr.json()["is_active"] is False


@pytest.mark.asyncio
async def test_create_user_duplicate_email(auth):
    from .conftest import TEST_EMAIL
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.post("/api/v1/admin/users", json={
            "email": TEST_EMAIL,
            "full_name": "重複",
            "password": "Pass123!",
        }, headers=auth)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_admin_requires_admin_role():
    """未認証では管理者エンドポイントに 401 が返ること。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/admin/users")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_stamp_tax_list(auth):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/admin/stamp-tax", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
