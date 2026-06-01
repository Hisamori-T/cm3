"""見積書エンドポイントのテスト。"""
from __future__ import annotations

import datetime
import uuid
import pytest
import httpx
from .conftest import BASE_URL


@pytest.fixture
def project_name():
    return f"pytest見積工事_{uuid.uuid4().hex[:6]}"


@pytest.mark.asyncio
async def test_create_quote(auth, project_name):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        pr = await c.post("/api/v1/projects", json={"project_name": project_name}, headers=auth)
        pid = pr.json()["id"]
        qr = await c.post(
            f"/api/v1/projects/{pid}/quotes",
            json={"issue_date": str(datetime.date.today())},
            headers=auth,
        )
        assert qr.status_code == 201
        assert "id" in qr.json()
        assert "quote_number" in qr.json()
        await c.delete(f"/api/v1/projects/{pid}", headers=auth)


@pytest.mark.asyncio
async def test_list_quotes(auth, project_name):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        pr = await c.post("/api/v1/projects", json={"project_name": project_name}, headers=auth)
        pid = pr.json()["id"]
        # 見積書なし
        lr = await c.get(f"/api/v1/projects/{pid}/quotes", headers=auth)
        assert lr.status_code == 200
        assert lr.json() == []
        # 見積書作成後
        await c.post(f"/api/v1/projects/{pid}/quotes", json={}, headers=auth)
        lr2 = await c.get(f"/api/v1/projects/{pid}/quotes", headers=auth)
        assert len(lr2.json()) == 1
        await c.delete(f"/api/v1/projects/{pid}", headers=auth)


@pytest.mark.asyncio
async def test_quote_items(auth, project_name):
    """PATCH で見積明細を更新できること。"""
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        pr = await c.post("/api/v1/projects", json={"project_name": project_name}, headers=auth)
        pid = pr.json()["id"]
        qr = await c.post(f"/api/v1/projects/{pid}/quotes", json={}, headers=auth)
        qid = qr.json()["id"]
        # 明細をPATCHで保存
        items = [
            {"row_no": 1, "item_name": "配管工事", "unit": "式", "quantity": "1", "unit_price": "100000"},
            {"row_no": 2, "item_name": "電気工事", "unit": "式", "quantity": "2", "unit_price": "50000"},
        ]
        sr = await c.patch(
            f"/api/v1/projects/{pid}/quotes/{qid}",
            json={"items": items},
            headers=auth,
        )
        assert sr.status_code == 200
        saved = sr.json()
        assert len(saved["items"]) == 2
        assert saved["items"][0]["item_name"] == "配管工事"
        # 小計確認（100000 + 100000 = 200000）
        assert float(saved["subtotal"]) == 200000.0
        await c.delete(f"/api/v1/projects/{pid}", headers=auth)


@pytest.mark.asyncio
async def test_quote_export(auth, project_name):
    """Excel出力が200でXLSXを返すこと。"""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as c:
        pr = await c.post("/api/v1/projects", json={"project_name": project_name}, headers=auth)
        pid = pr.json()["id"]
        qr = await c.post(
            f"/api/v1/projects/{pid}/quotes",
            json={"issue_date": str(datetime.date.today())},
            headers=auth,
        )
        qid = qr.json()["id"]
        er = await c.get(
            f"/api/v1/projects/{pid}/quotes/{qid}/export",
            headers=auth,
        )
        assert er.status_code == 200, f"export failed: {er.text[:200]}"
        assert er.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert len(er.content) > 5000
        await c.delete(f"/api/v1/projects/{pid}", headers=auth)
