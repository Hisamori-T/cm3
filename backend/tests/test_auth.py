"""認証エンドポイントのテスト。"""
from __future__ import annotations

import pytest
import httpx
from .conftest import BASE_URL, TEST_EMAIL, TEST_PASSWORD


@pytest.mark.asyncio
async def test_login_success(test_user):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.post("/api/v1/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password():
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.post("/api/v1/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrong",
        })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email():
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "anything",
        })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me(auth):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/auth/me", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == TEST_EMAIL
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_me_unauthorized():
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh(test_user):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        login = await c.post("/api/v1/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        refresh_token = login.json()["refresh_token"]
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200
    assert "access_token" in r.json()
