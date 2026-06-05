"""QCDS関連の Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import QCDSCategory

ExpenseSection = Literal["B_site", "B_dept", "C"]


class ExpenseItemInput(BaseModel):
    """経費行の入力データ（PUT リクエスト用）。"""

    id: uuid.UUID | None = None
    section: ExpenseSection
    row_no: int = Field(..., ge=1)
    system_key: str | None = None
    item_name: str = Field(..., max_length=200)
    formula_description: str | None = None
    amount_override: float | None = None
    is_custom: bool = False


class ExpenseItemRead(BaseModel):
    """経費行のレスポンス。effective_amount は override または自動計算値。"""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    qcds_id: uuid.UUID
    section: ExpenseSection
    row_no: int
    system_key: str | None
    item_name: str
    formula_description: str | None
    amount_override: float | None
    is_custom: bool


class DirectWorkInput(BaseModel):
    """直接工事費1行の入力データ。"""

    row_no: int = Field(..., ge=1)
    work_type: str | None = None
    vendor_id: uuid.UUID | None = None
    vendor_name_snapshot: str | None = None
    category: QCDSCategory | None = None
    budget_amount: float | None = None
    agreed_amount: float | None = None
    settlement_amount: float | None = None
    agreement_checked: bool = False
    payment_month_4: float | None = None
    payment_month_5: float | None = None
    payment_month_6: float | None = None
    payment_month_7: float | None = None
    payment_month_8: float | None = None
    payment_month_9: float | None = None
    payment_month_10: float | None = None
    payment_month_11: float | None = None
    payment_month_12: float | None = None
    payment_month_1: float | None = None
    payment_month_2: float | None = None
    payment_month_3: float | None = None
    payment_completed: bool = False
    note: str | None = None


class QCDSInput(BaseModel):
    """QCDS保存リクエスト（ヘッダ + 直接工事費30行）。"""

    revision: int = 0
    spare_cost: float | None = None
    industrial_waste_cost: float | None = None
    labor_insurance_rate: float = 0.001973
    construction_insurance_rate: float = 0.002095
    special_insurance_rate: float = 0.000110
    special_insurance_equipment_rate: float = 0.000110
    special_insurance_demolition_rate: float = 0.019053
    office_supplies: float = 2000
    communication_cost: float = 10000
    misc_cost: float = 5000
    site_staff_salary_rate: float = 0.035
    common_overhead_rate: float | None = None
    shared_overhead_rate: float = 0.05
    general_admin_rate: float = 0.035
    target_operating_profit_rate: float = 0.10
    actual_site_personnel_cost: float | None = None
    direct_works: list[DirectWorkInput] = Field(default_factory=list)
    expense_items: list[ExpenseItemInput] | None = None


class DirectWorkRead(DirectWorkInput):
    """直接工事費1行のレスポンス。"""

    id: uuid.UUID
    vendor_name: str | None = None
    source_scan_result_id: uuid.UUID | None = None


class QCDSCalcFields(BaseModel):
    """QCDS派生計算結果。"""

    direct_cost_budget: float
    direct_cost_agreed: float
    direct_cost_settlement: float
    labor_insurance: float
    construction_insurance: float
    stamp_cost: float
    receipt_cost: float
    special_insurance: float
    special_insurance_equipment: float = 0.0
    special_insurance_demolition: float = 0.0
    site_personnel_cost: float
    fixed_overhead: float
    site_overhead_total: float
    construction_cost_total: float
    construction_dept_overhead: float
    shared_overhead: float
    total_cost: float
    general_admin_cost: float
    operating_profit: float
    operating_profit_rate: float
    target_operating_profit: float


class QCDSResponse(BaseModel):
    """QCDS取得レスポンス（ヘッダ + 直接工事費 + 計算結果）。"""

    id: uuid.UUID
    project_id: uuid.UUID
    revision: int
    spare_cost: float | None
    industrial_waste_cost: float | None
    labor_insurance_rate: float
    construction_insurance_rate: float
    special_insurance_rate: float
    special_insurance_equipment_rate: float = 0.000110
    special_insurance_demolition_rate: float = 0.019053
    office_supplies: float
    communication_cost: float
    misc_cost: float
    site_staff_salary_rate: float
    common_overhead_rate: float | None
    shared_overhead_rate: float
    general_admin_rate: float
    target_operating_profit_rate: float
    actual_site_personnel_cost: float | None
    created_at: datetime
    updated_at: datetime
    direct_works: list[DirectWorkRead]
    expense_items: list[ExpenseItemRead]
    calc: QCDSCalcFields
