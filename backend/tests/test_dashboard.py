"""ダッシュボードエンドポイントのテスト。"""
from __future__ import annotations

import pytest
import httpx
from .conftest import BASE_URL


@pytest.mark.asyncio
async def test_dashboard_structure(auth):
    """ダッシュボードが正しいキー構造のJSONを返すこと。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/dashboard", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert "kpi" in data
    assert "status_distribution" in data
    assert "monthly_stats" in data
    assert "deadline_alerts" in data
    assert "recent_activities" in data


@pytest.mark.asyncio
async def test_dashboard_kpi_count(auth):
    """KPIカードが4枚あること。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/dashboard", headers=auth)
    assert len(r.json()["kpi"]) == 4


@pytest.mark.asyncio
async def test_dashboard_monthly_stats(auth):
    """月別統計が12ヶ月分あること。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/dashboard", headers=auth)
    assert len(r.json()["monthly_stats"]) == 12


@pytest.mark.asyncio
async def test_dashboard_unauthorized():
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/dashboard")
    assert r.status_code == 401
