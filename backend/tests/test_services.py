"""サービス層のユニットテスト（Excel帳票・セキュリティ）。"""
from __future__ import annotations

import datetime
import decimal
import uuid

import pytest


class _FakeProject:
    project_name = "テスト工事"
    project_number = "26-001-001"
    client_name = "株式会社テスト"
    project_location = "福井県坂井市テスト町1-2-3"


def test_export_quote_returns_bytes():
    from app.services.excel_export import export_quote_excel

    class FakeQuote:
        id = uuid.uuid4()
        quote_number = "Q-2026-001"
        issue_date = datetime.date.today()
        validity_days = 30
        period_start = datetime.date.today()
        period_end = datetime.date.today()
        payment_condition = "月末締め翌月末払い"
        project_location_snapshot = None
        subtotal = decimal.Decimal("100000")
        tax_amount = decimal.Decimal("10000")
        total_amount = decimal.Decimal("110000")
        conditions_text = None
        remarks = None

    class FakeItem:
        def __init__(self, n: int) -> None:
            self.row_no = n
            self.item_name = f"工事項目{n}"
            self.spec = "仕様A"
            self.unit = "式"
            self.quantity = decimal.Decimal("1")
            self.unit_price = decimal.Decimal("50000")
            self.amount = decimal.Decimal("50000")
            self.remarks = ""

    data = export_quote_excel(FakeQuote(), _FakeProject(), [FakeItem(1), FakeItem(2)])
    assert isinstance(data, bytes)
    assert len(data) > 5000
    # xlsxファイルのマジックバイト確認
    assert data[:2] == b"PK"


def test_export_order_returns_bytes():
    from app.services.excel_export import export_order_excel

    class FakeOrder:
        id = uuid.uuid4()
        order_number = "O-2026-001"
        issue_date = datetime.date.today()
        client_address = None
        client_company = "株式会社テスト業者"
        client_person = None
        amount_excl_tax = decimal.Decimal("100000")
        tax_amount = decimal.Decimal("10000")
        total_amount = decimal.Decimal("110000")
        stamp_tax = decimal.Decimal("200")
        construction_period_start = datetime.date.today()
        construction_period_end = datetime.date.today()
        payment_condition = "月末締め翌月末払い"
        terms_and_conditions = None

    data = export_order_excel(FakeOrder(), _FakeProject())
    assert isinstance(data, bytes)
    assert len(data) > 5000
    assert data[:2] == b"PK"


def test_export_invoice_returns_bytes():
    from app.services.excel_export import export_invoice_excel

    class FakeInvoice:
        id = uuid.uuid4()
        invoice_number = "I-2026-001"
        invoice_date = datetime.date.today()
        due_date = datetime.date.today()
        current_purchase = decimal.Decimal("100000")
        subtotal = decimal.Decimal("100000")
        tax_amount = decimal.Decimal("10000")
        total_amount = decimal.Decimal("110000")
        previous_balance = decimal.Decimal("0")
        received_amount = decimal.Decimal("0")
        outstanding_balance = decimal.Decimal("0")
        notes = None

    data = export_invoice_excel(FakeInvoice(), _FakeProject())
    assert isinstance(data, bytes)
    assert len(data) > 5000
    assert data[:2] == b"PK"


def test_hash_and_verify_password():
    from app.core.security import hash_password, verify_password

    plain = "TestSecurePass999!"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("wrongpass", hashed) is False


def test_create_access_token():
    from app.core.security import create_access_token, decode_token

    uid = uuid.uuid4()
    token = create_access_token(uid)
    assert isinstance(token, str)
    sub = decode_token(token, "access")
    assert sub == str(uid)


def test_create_refresh_token():
    from app.core.security import create_refresh_token, decode_token

    uid = uuid.uuid4()
    token = create_refresh_token(uid)
    sub = decode_token(token, "refresh")
    assert sub == str(uid)


def test_decode_wrong_type():
    import jwt as pyjwt
    from app.core.security import create_access_token, decode_token

    token = create_access_token(uuid.uuid4())
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_token(token, "refresh")  # access token passed as refresh
