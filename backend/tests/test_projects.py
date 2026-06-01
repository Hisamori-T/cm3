"""案件エンドポイントのテスト。"""
from __future__ import annotations

import uuid
import pytest
import httpx
from .conftest import BASE_URL


@pytest.fixture
def project_payload():
    return {
        "project_name": f"pytest工事_{uuid.uuid4().hex[:6]}",
        "client_name": "テスト発注者",
        "project_location": "福井県坂井市テスト町",
    }


@pytest.mark.asyncio
async def test_create_project(auth, project_payload):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.post("/api/v1/projects", json=project_payload, headers=auth)
    assert r.status_code == 201
    data = r.json()
    assert data["project_name"] == project_payload["project_name"]
    assert "project_number" in data
    assert data["status"] == "quote"
    # 後始末
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        await c.delete(f"/api/v1/projects/{data['id']}", headers=auth)


@pytest.mark.asyncio
async def test_list_projects(auth):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/projects", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_get_project_not_found(auth):
    fake_id = str(uuid.uuid4())
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get(f"/api/v1/projects/{fake_id}", headers=auth)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_project(auth, project_payload):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        cr = await c.post("/api/v1/projects", json=project_payload, headers=auth)
        assert cr.status_code == 201
        pid = cr.json()["id"]
        ur = await c.patch(
            f"/api/v1/projects/{pid}",
            json={"client_name": "更新後発注者"},
            headers=auth,
        )
    assert ur.status_code == 200
    assert ur.json()["client_name"] == "更新後発注者"
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        await c.delete(f"/api/v1/projects/{pid}", headers=auth)


@pytest.mark.asyncio
async def test_change_status(auth, project_payload):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        cr = await c.post("/api/v1/projects", json=project_payload, headers=auth)
        pid = cr.json()["id"]
        sr = await c.post(
            f"/api/v1/projects/{pid}/status",
            json={"status": "ordered"},
            headers=auth,
        )
    assert sr.status_code == 200
    assert sr.json()["status"] == "ordered"
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        await c.delete(f"/api/v1/projects/{pid}", headers=auth)


@pytest.mark.asyncio
async def test_delete_project_soft_delete(auth, project_payload):
    """DELETE は論理削除（204を返し、その後GETが404になること）。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        cr = await c.post("/api/v1/projects", json=project_payload, headers=auth)
        assert cr.status_code == 201
        pid = cr.json()["id"]
        dr = await c.delete(f"/api/v1/projects/{pid}", headers=auth)
        assert dr.status_code == 204
        # 論理削除後はGETが404になること
        gr = await c.get(f"/api/v1/projects/{pid}", headers=auth)
        assert gr.status_code == 404


@pytest.mark.asyncio
async def test_project_unauthorized():
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        r = await c.get("/api/v1/projects")
    assert r.status_code == 401
