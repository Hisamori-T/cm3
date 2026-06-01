"""自社企業情報のPydanticスキーマ。"""
from __future__ import annotations
from pydantic import BaseModel


class CompanySettingsRead(BaseModel):
    id: str
    company_name: str
    company_name_en: str | None
    postal_code: str | None
    address: str | None
    tel: str | None
    fax: str | None
    representative_name: str | None
    tax_registration_number: str | None
    bank_name: str | None
    bank_branch: str | None
    bank_account_type: str | None
    bank_account_number: str | None
    bank_account_holder: str | None
    logo_path: str | None
    seal_text: str | None
    logo_text: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class CompanySettingsUpdate(BaseModel):
    company_name: str | None = None
    company_name_en: str | None = None
    postal_code: str | None = None
    address: str | None = None
    tel: str | None = None
    fax: str | None = None
    representative_name: str | None = None
    tax_registration_number: str | None = None
    bank_name: str | None = None
    bank_branch: str | None = None
    bank_account_type: str | None = None
    bank_account_number: str | None = None
    bank_account_holder: str | None = None
    seal_text: str | None = None
    logo_text: str | None = None
    notes: str | None = None
