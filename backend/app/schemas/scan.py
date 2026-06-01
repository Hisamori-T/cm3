"""スキャンジョブ関連の Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ScanJobFileType, ScanJobStatus


class ScanJobRead(BaseModel):
    """スキャンジョブのレスポンス。"""

    id: uuid.UUID
    project_id: uuid.UUID | None
    uploaded_by: uuid.UUID
    original_file_name: str
    file_type: ScanJobFileType
    status: ScanJobStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    # 一覧表示用: 最初の解析結果から取得（任意）
    vendor_name_detected: str | None = None
    confidence_score: float | None = None
    item_count: int | None = None


class BulkApplyRequest(BaseModel):
    """複数スキャン結果を一括転記するリクエスト。"""

    scan_result_ids: list[uuid.UUID]
    project_id: uuid.UUID
    targets: list[str]  # "qcds" | "quote"
    save_to_vendor_master: bool = False


class BulkApplyResponse(BaseModel):
    """一括転記レスポンス。"""

    applied_count: int
    qcds_affected: int
    quote_affected: int
    qcds_url: str | None = None
    quote_url: str | None = None


class BulkDeleteRequest(BaseModel):
    """複数スキャンジョブを論理削除するリクエスト。"""

    scan_job_ids: list[uuid.UUID]


class BulkRestoreRequest(BaseModel):
    """論理削除済みスキャンジョブを復活させるリクエスト（admin only）。"""

    scan_job_ids: list[uuid.UUID]


class BulkPurgeRequest(BaseModel):
    """スキャンジョブを物理削除するリクエスト（admin only）。"""

    scan_job_ids: list[uuid.UUID]


class ScanResultItemRead(BaseModel):
    """スキャン解析結果の明細行。"""

    id: uuid.UUID
    row_no: int
    item_name: str | None
    spec: str | None
    unit: str | None
    quantity: float | None
    unit_price: float | None
    amount: float | None
    confidence: float | None
    applied_to_qcds: bool
    applied_to_quote: bool


class ScanResultRead(BaseModel):
    """スキャン解析結果ヘッダ（レビュー用）。"""

    id: uuid.UUID
    scan_job_id: uuid.UUID
    vendor_name_detected: str | None
    vendor_id: uuid.UUID | None
    quoted_date_detected: str | None
    subtotal_detected: float | None
    tax_detected: float | None
    total_detected: float | None
    confidence_score: float | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    items: list[ScanResultItemRead]


class ScanJobDetailRead(ScanJobRead):
    """スキャンジョブ詳細（解析結果含む）。"""

    results: list[ScanResultRead]


class ScanResultItemUpdate(BaseModel):
    """明細1行の更新リクエスト。"""

    id: uuid.UUID
    item_name: str | None = None
    spec: str | None = None
    unit: str | None = None
    quantity: float | None = None
    unit_price: float | None = None
    amount: float | None = None


class ScanResultUpdate(BaseModel):
    """スキャン解析結果の更新リクエスト。"""

    vendor_name_detected: str | None = None
    vendor_id: uuid.UUID | None = None
    quoted_date_detected: str | None = None  # YYYY-MM-DD
    subtotal_detected: float | None = None
    tax_detected: float | None = None
    total_detected: float | None = None
    items: list[ScanResultItemUpdate] | None = None


class ApplyScanResultRequest(BaseModel):
    """スキャン結果を QCDS/見積へ転記するリクエスト。"""

    target: str  # "qcds" | "quote"
    target_id: uuid.UUID
    item_ids: list[uuid.UUID]  # 空の場合は全明細を対象


class ApplyScanResultResponse(BaseModel):
    """スキャン結果転記のレスポンス。"""

    applied_count: int
    price_histories_created: int
    target: str
    target_id: uuid.UUID
