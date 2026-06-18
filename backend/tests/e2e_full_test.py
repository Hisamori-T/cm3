"""
Construction Manager v3 — 全機能 E2E テストスクリプト
VPS上のコンテナ内で実行: uv run python tests/e2e_full_test.py
"""
from __future__ import annotations

import json
import sys
import time
import uuid
from datetime import date, timedelta
from typing import Any

import httpx

BASE = "http://localhost:8000/api/v1"
USER_ID = "33894340-611b-4202-93d5-c342dd15afc9"
JWT_SECRET = "759d11a81e99e239b691930d510d9a8fb37974c7d7ff1234657545e4d7cafcff"

PASS_COUNT = 0
FAIL_COUNT = 0
RESULTS: list[str] = []

def _gen_token() -> str:
    """JWT アクセストークンを直接生成。"""
    import jose.jwt as jwt_lib
    payload = {
        "sub": USER_ID,
        "type": "access",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    return jwt_lib.encode(payload, JWT_SECRET, algorithm="HS256")

TOKEN: str = ""

def ok(label: str, detail: str = "") -> None:
    global PASS_COUNT
    PASS_COUNT += 1
    msg = f"  ✅ {label}" + (f" ({detail})" if detail else "")
    RESULTS.append(msg)
    print(msg)

def fail(label: str, detail: str = "") -> None:
    global FAIL_COUNT
    FAIL_COUNT += 1
    msg = f"  ❌ {label}" + (f" ({detail})" if detail else "")
    RESULTS.append(msg)
    print(msg)

def head(title: str) -> None:
    line = f"\n{'─'*50}\n▶ {title}\n{'─'*50}"
    RESULTS.append(line)
    print(line)

def api(method: str, path: str, **kwargs) -> httpx.Response:
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    headers.update(kwargs.pop("headers", {}))
    return httpx.request(method, f"{BASE}{path}", headers=headers, timeout=30, **kwargs)

def check(label: str, resp: httpx.Response, expected: int = 200) -> dict | None:
    if resp.status_code in (expected, 200, 201):
        ok(label, f"{resp.status_code}")
        try:
            return resp.json()
        except Exception:
            return {}
    else:
        fail(label, f"HTTP {resp.status_code}: {resp.text[:120]}")
        return None

TODAY = date.today().isoformat()
TOMORROW = (date.today() + timedelta(days=30)).isoformat()
SUFFIX = str(uuid.uuid4())[:8]  # 毎回ユニークなサフィックス

def run():
    global TOKEN
    TOKEN = _gen_token()

    # ─── 1. 認証 ────────────────────────────────────────────────────────────
    head("1. 認証")
    r = api("GET", "/auth/me")
    d = check("GET /auth/me", r)
    if d:
        ok("ログインユーザー確認", d.get("email", ""))

    # ─── 2. 顧客マスタ ──────────────────────────────────────────────────────
    head("2. 顧客マスタ")
    client_body = {
        "client_name": f"[TEST] テスト株式会社 {SUFFIX}",
        "client_code": f"T{SUFFIX}",
        "postal_code": "900-0001",
        "address": "沖縄県那覇市テスト1-2-3",
        "phone": "098-000-0000",
    }
    r = api("POST", "/clients", content=json.dumps(client_body))
    client = check("POST /clients（顧客作成）", r, 201)
    client_id = client["id"] if client else None

    if client_id:
        # 現場追加
        site_body = {"site_name": "[TEST] テスト現場", "address": "沖縄県那覇市現場1"}
        r = api("POST", f"/clients/{client_id}/sites", content=json.dumps(site_body))
        site = check("POST /clients/{id}/sites（現場追加）", r, 201)
        site_id = site["id"] if site else None

        # 担当者追加
        contact_body = {"name": "テスト太郎", "role": "担当者", "phone": "098-111-1111"}
        r = api("POST", f"/clients/{client_id}/contacts", content=json.dumps(contact_body))
        contact = check("POST /clients/{id}/contacts（担当者追加）", r, 201)
        contact_id = contact["id"] if contact else None

    # ─── 3. 業者マスタ ──────────────────────────────────────────────────────
    head("3. 業者マスタ")
    vendor_body = {
        "vendor_name": f"[TEST] テスト建設㈱ {SUFFIX}",
        "vendor_code": f"V{SUFFIX}",
        "phone": "06-0000-0000",
        "address": "大阪府大阪市テスト2-3-4",
        "trade_type": "内装",
    }
    r = api("POST", "/vendors", content=json.dumps(vendor_body))
    vendor = check("POST /vendors（業者作成）", r, 201)
    vendor_id = vendor["id"] if vendor else None

    # ─── 4. 案件 ────────────────────────────────────────────────────────────
    head("4. 案件")
    proj_body = {
        "project_name": f"[TEST] フルテスト工事 {SUFFIX}",
        "project_location": "東京都新宿区テスト1-1-1",
        "client_name": "[TEST] テスト株式会社",
        "period_contract_start": TODAY,
        "period_contract_end": TOMORROW,
        "order_type": "private",
        "payment_condition": "月末締め翌月払い",
    }
    if client_id:
        proj_body["client_id"] = client_id
    r = api("POST", "/projects", content=json.dumps(proj_body))
    project = check("POST /projects（案件作成）", r, 201)
    project_id = project["id"] if project else None
    project_number = project.get("project_number", "") if project else ""

    if project_id:
        r = api("GET", f"/projects/{project_id}")
        check("GET /projects/{id}（案件詳細）", r)

        r = api("PATCH", f"/projects/{project_id}",
                content=json.dumps({"project_summary": "テスト工事の概要説明"}))
        check("PATCH /projects/{id}（案件更新）", r)

        r = api("POST", f"/projects/{project_id}/status",
                content=json.dumps({"status": "ordered"}))
        check("POST /projects/{id}/status（ステータス変更→受注）", r)

    # ─── 5. QCDS ────────────────────────────────────────────────────────────
    head("5. QCDS（原価算定）")
    qcds_id = None
    if project_id:
        r = api("GET", f"/projects/{project_id}/qcds")
        qcds = check("GET /projects/{id}/qcds（QCDS取得/作成）", r)
        qcds_id = qcds.get("id") if qcds else None

        if qcds_id and vendor_id:
            # direct_works は PUT で一括更新
            works_body = {"direct_works": [{
                "row_no": 1,
                "vendor_id": vendor_id,
                "vendor_name_snapshot": f"[TEST] テスト建設㈱ {SUFFIX}",
                "work_type": "内装工事",
                "category": "subcontract",
                "budget_amount": 1500000,
                "agreed_amount": 1400000,
            }]}
            r = api("PUT", f"/projects/{project_id}/qcds",
                    content=json.dumps(works_body))
            check("PUT /qcds（直接工事費追加）", r)

    # ─── 6. 見積書 ──────────────────────────────────────────────────────────
    head("6. 見積書")
    quote_id = None
    if project_id:
        quote_body = {
            "project_name_snapshot": "[TEST] フルテスト工事",
            "issue_date": TODAY,
            "period_start": TODAY,
            "period_end": TOMORROW,
            "payment_condition": "月末締め翌月払い",
        }
        r = api("POST", f"/projects/{project_id}/quotes",
                content=json.dumps(quote_body))
        quote = check("POST /projects/{id}/quotes（見積書作成）", r, 201)
        quote_id = quote["id"] if quote else None

        if quote_id:
            item_body = {
                "row_no": 1, "item_name": "テスト工事費",
                "quantity": 1, "unit": "式", "unit_price": 1500000,
                "amount": 1500000, "note": "テスト明細",
            }
            r = api("POST", f"/projects/{project_id}/quotes/{quote_id}/items",
                    content=json.dumps(item_body))
            check("POST /quotes/{id}/items（明細追加）", r, 201)

    # ─── 7. 注文書 ──────────────────────────────────────────────────────────
    head("7. 注文書")
    order_id = None
    if project_id:
        order_body = {
            "issue_date": TODAY,
            "delivery_date": TOMORROW,
            "delivery_location": "東京都新宿区テスト現場",
            "payment_condition": "月末締め翌月払い",
        }
        r = api("POST", f"/projects/{project_id}/orders",
                content=json.dumps(order_body))
        order = check("POST /projects/{id}/orders（注文書作成）", r, 201)
        order_id = order["id"] if order else None

    # ─── 8. 請求書 ──────────────────────────────────────────────────────────
    head("8. 請求書")
    invoice_id = None
    if project_id:
        inv_body = {
            "invoice_number": f"TEST-INV-{int(time.time())%10000}",
            "issue_date": TODAY,
            "total_amount": 1650000,
            "tax_amount": 150000,
        }
        r = api("POST", f"/projects/{project_id}/invoices",
                content=json.dumps(inv_body))
        invoice = check("POST /projects/{id}/invoices（請求書作成）", r, 201)
        invoice_id = invoice["id"] if invoice else None

        if invoice_id:
            pay_body = {"payment_date": TODAY, "amount": 500000, "payment_method": "振込"}
            r = api("POST", f"/projects/{project_id}/invoices/{invoice_id}/payments",
                    content=json.dumps(pay_body))
            check("POST /invoices/{id}/payments（入金記録追加）", r, 201)

    # ─── 9. 発注書 ──────────────────────────────────────────────────────────
    head("9. 発注書")
    po_id = None
    if project_id and vendor_id:
        po_body = {
            "vendor_id": vendor_id,
            "order_date": TODAY,
            "delivery_date": TOMORROW,
            "total_amount": 1400000,
            "items": [{"item_name": "内装工事", "quantity": 1, "unit": "式",
                        "unit_price": 1400000, "amount": 1400000}],
        }
        r = api("POST", f"/projects/{project_id}/purchase-orders",
                content=json.dumps(po_body))
        po = check("POST /projects/{id}/purchase-orders（発注書作成）", r, 201)
        po_id = po["id"] if po else None

    # ─── 10. 出面台帳 ───────────────────────────────────────────────────────
    head("10. 出面台帳（Phase H 新機能含む）")
    if project_id and vendor_id:
        att_body = {
            "vendor_id": vendor_id,
            "attendance_date": TODAY,
            "worker_count": 2.5,
            "work_content": "内装解体テスト",
            "unit_price": 18000,
            "amount": 45000,
            "weather": "晴れ",
            "safety_check": True,
        }
        r = api("POST", f"/projects/{project_id}/attendance",
                content=json.dumps(att_body))
        check("POST /attendance（出面記録 + 天候/KY）", r, 201)

        r = api("GET", f"/projects/{project_id}/attendance/summary?month={TODAY[:7]}")
        check("GET /attendance/summary（集計）", r)

        r = api("GET", f"/attendance/calendar?month={TODAY[:7]}")
        check("GET /attendance/calendar（カレンダー用）", r)

    # ─── 11. 日報 ───────────────────────────────────────────────────────────
    head("11. 日報")
    if project_id:
        report_body = {
            "report_date": TODAY,
            "weather": "sunny",
            "note": "テスト日報",
            "entries": [{
                "project_id": project_id,
                "work_content": "テスト作業",
                "start_time": "08:30",
                "end_time": "17:30",
                "break_minutes": 60,
                "working_minutes": 480,
            }],
        }
        r = api("POST", "/daily-reports", content=json.dumps(report_body))
        check("POST /daily-reports（日報作成）", r, 201)

    # ─── 12. カレンダーイベント ─────────────────────────────────────────────
    head("12. カレンダーイベント")
    evt_body = {
        "title": "[TEST] テスト打合せ",
        "event_type": "meeting",
        "start_at": f"{TODAY}T10:00:00",
        "end_at": f"{TODAY}T11:00:00",
        "all_day": False,
    }
    r = api("POST", "/schedule", content=json.dumps(evt_body))
    evt = check("POST /schedule（イベント作成）", r, 201)
    evt_id = evt["id"] if evt else None

    if evt_id:
        r = api("DELETE", f"/schedule/{evt_id}")
        if r.status_code == 204:
            ok("DELETE /schedule/{id}（イベント削除）", "204")
        else:
            fail("DELETE /schedule/{id}", f"{r.status_code}")

    # ─── 13. 工事台帳 ───────────────────────────────────────────────────────
    head("13. 工事台帳（Phase G）")
    if project_id:
        r = api("GET", f"/projects/{project_id}/ledger")
        check("GET /projects/{id}/ledger（工事台帳データ取得）", r)

        meta_body = {
            "original_client_name": "[TEST] 元発注者テスト",
            "target_profit_rate": 15.0,
        }
        r = api("PATCH", f"/projects/{project_id}/ledger/meta",
                content=json.dumps(meta_body))
        check("PATCH /projects/{id}/ledger/meta（手動入力保存）", r)

    # ─── 14. PDF/Excel 出力 ─────────────────────────────────────────────────
    head("14. PDF/Excel 出力")
    if project_id and quote_id:
        r = api("GET", f"/projects/{project_id}/quotes/{quote_id}/export-pdf")
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf"):
            ok("GET /quotes/{id}/export-pdf（見積PDF）", f"{len(r.content):,} bytes")
        else:
            fail("GET /quotes/{id}/export-pdf", f"{r.status_code}")

    if project_id:
        r = api("GET", f"/projects/{project_id}/export-pdf")
        if r.status_code == 200:
            ok("GET /projects/{id}/export-pdf（工事台帳PDF）", f"{len(r.content):,} bytes")
        else:
            fail("GET /projects/{id}/export-pdf", f"{r.status_code}: {r.text[:80]}")

    # ─── 15. CSV 出力（Phase I）────────────────────────────────────────────
    head("15. CSV 出力（Phase I）")
    for csv_type in ["projects", "invoices", "purchase-orders", "attendance", "payments"]:
        r = api("GET", f"/export/csv/{csv_type}")
        if r.status_code == 200 and "text/csv" in r.headers.get("content-type", ""):
            lines = r.text.count("\n")
            ok(f"GET /export/csv/{csv_type}", f"{lines}行")
        else:
            fail(f"GET /export/csv/{csv_type}", f"{r.status_code}")

    # ─── 16. ダッシュボード ─────────────────────────────────────────────────
    head("16. ダッシュボード")
    r = api("GET", "/dashboard")
    dash = check("GET /dashboard（KPI）", r)
    if dash:
        ok("KPI取得", f"案件数={dash.get('total_projects', '?')}, 今月売上={dash.get('this_month_revenue', '?')}")

    # ─── 17. クリーンアップ ─────────────────────────────────────────────────
    head("17. テストデータ削除")
    if project_id:
        r = api("DELETE", f"/projects/{project_id}")
        if r.status_code in (200, 204):
            ok("DELETE /projects/{id}（案件論理削除）")
        else:
            fail("DELETE /projects/{id}", f"{r.status_code}")

    if client_id:
        r = api("DELETE", f"/clients/{client_id}")
        if r.status_code in (200, 204):
            ok("DELETE /clients/{id}（顧客削除）")
        else:
            fail("DELETE /clients/{id}", f"{r.status_code}")

    if vendor_id:
        # 業者削除（soft_deleteが無い場合はスキップ）
        r = api("DELETE", f"/vendors/{vendor_id}")
        if r.status_code in (200, 204):
            ok("DELETE /vendors/{id}（業者削除）")
        elif r.status_code == 405:
            ok("DELETE /vendors/{id}（業者削除エンドポイントなし — スキップ）", "405")
        else:
            fail("DELETE /vendors/{id}", f"{r.status_code}")

    # ─── 結果サマリー ────────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"テスト結果: ✅ {PASS_COUNT} 件成功 / ❌ {FAIL_COUNT} 件失敗")
    print(f"{'='*50}")
    if FAIL_COUNT > 0:
        print("\n失敗一覧:")
        for r in RESULTS:
            if "❌" in r:
                print(r)

if __name__ == "__main__":
    try:
        from jose import jwt as _  # noqa
    except ImportError:
        print("ERROR: python-jose が必要です。`uv add python-jose` を実行してください")
        sys.exit(1)
    run()
