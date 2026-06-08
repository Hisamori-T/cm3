"""案件（Project）関連の Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import (
    AwardingType,
    ContractType,
    OrderType,
    PrevConstructionType,
    ProjectRole,
    ProjectStatus,
)


class ProjectCreate(BaseModel):
    """新規案件作成リクエスト。project_number を省略すると自動採番。"""

    project_name: str = Field(..., max_length=255)
    project_number: str | None = Field(None, max_length=20)
    client_name: str | None = Field(None, max_length=255)
    project_location: str | None = None
    order_type: OrderType | None = None
    contract_type: ContractType | None = None
    awarding_type: AwardingType | None = None
    sales_person_id: uuid.UUID | None = None
    construction_person_id: uuid.UUID | None = None
    project_price: float | None = None
    period_quote_start: date | None = None
    period_quote_end: date | None = None


class ProjectRoleUpdate(BaseModel):
    """案件立場（元請/下請/公共）変更リクエスト。"""
    project_role: ProjectRole


class ProjectUpdate(BaseModel):
    """案件更新リクエスト。すべてのフィールドがオプション。"""

    project_name: str | None = Field(None, max_length=255)
    project_number: str | None = Field(None, max_length=20)
    client_name: str | None = None
    client_id: uuid.UUID | None = None
    client_site_id: uuid.UUID | None = None
    original_client_name: str | None = None
    project_location: str | None = None
    order_type: OrderType | None = None
    contract_type: ContractType | None = None
    awarding_type: AwardingType | None = None
    payment_condition: str | None = None
    project_summary: str | None = None
    prev_construction_type: PrevConstructionType | None = None
    prev_construction_year: int | None = None
    prev_construction_other: str | None = None
    client_contact_company: str | None = None
    client_contact_person: str | None = None
    client_contact_phone: str | None = None
    sales_person_id: uuid.UUID | None = None
    construction_person_id: uuid.UUID | None = None
    project_price: float | None = None
    period_quote_start: date | None = None
    period_quote_end: date | None = None
    period_contract_start: date | None = None
    period_contract_end: date | None = None
    period_actual_start: date | None = None
    period_actual_end: date | None = None
    project_role: ProjectRole | None = None


class ProjectListItem(BaseModel):
    """案件一覧の1行。"""

    id: uuid.UUID
    project_number: str
    project_name: str
    client_name: str | None
    status: ProjectStatus
    order_type: OrderType | None
    contract_type: ContractType | None
    project_role: ProjectRole | None = None
    project_price: float | None
    sales_person_name: str | None
    construction_person_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    """案件一覧レスポンス（ページネーション付き）。"""

    items: list[ProjectListItem]
    total: int
    page: int
    per_page: int


class StatusChangeRequest(BaseModel):
    """ステータス変更リクエスト。"""

    status: ProjectStatus


class EditHistoryItem(BaseModel):
    """編集履歴の1件。"""

    id: uuid.UUID
    entity_type: str
    change_type: str
    field_changes: dict | None
    changed_by_name: str
    changed_at: datetime


class EditHistoryResponse(BaseModel):
    items: list[EditHistoryItem]
    total: int


class ProjectCounts(BaseModel):
    """案件サブナビ用の関連データ件数。"""

    qcds: int = 0
    estimate: int = 0
    quote: int = 0
    order: int = 0
    acknowledgment: int = 0
    invoice: int = 0
    progress: int = 0
    history: int = 0


class ProjectDetail(BaseModel):
    """案件詳細レスポンス（全フィールド＋関連件数）。"""

    id: uuid.UUID
    project_number: str
    project_name: str
    client_name: str | None
    client_id: uuid.UUID | None
    client_site_id: uuid.UUID | None
    original_client_name: str | None
    project_location: str | None
    status: ProjectStatus
    order_type: OrderType | None
    contract_type: ContractType | None
    awarding_type: AwardingType | None
    payment_condition: str | None
    project_summary: str | None
    prev_construction_type: PrevConstructionType | None
    prev_construction_year: int | None
    prev_construction_other: str | None
    client_contact_company: str | None
    client_contact_person: str | None
    client_contact_phone: str | None
    sales_person_id: uuid.UUID | None
    sales_person_name: str | None
    construction_person_id: uuid.UUID | None
    construction_person_name: str | None
    created_by: uuid.UUID
    project_price: float | None
    project_role: ProjectRole | None = None
    period_quote_start: date | None
    period_quote_end: date | None
    period_contract_start: date | None
    period_contract_end: date | None
    period_actual_start: date | None
    period_actual_end: date | None
    created_at: datetime
    updated_at: datetime
    # 関連件数（後方互換）
    qcds_count: int
    quote_count: int
    order_count: int
    invoice_count: int
    progress_log_count: int
    # サブナビ用集計オブジェクト
    counts: ProjectCounts
