"""scan ルーター群の共通ヘルパー・定数。

3つの scan ルーター（upload / review / transfer）から import される。
循環 import を防ぐため、このファイルから他の scan ルーターを import してはいけない。
"""
from __future__ import annotations

import uuid

from app.models.enums import ScanJobFileType
from app.models.scan import ScanJob, ScanResult, ScanResultItem
from app.schemas.scan import (
    ScanJobRead,
    ScanResultItemRead,
    ScanResultRead,
)

# ── 定数 ──────────────────────────────────────────────────────────────────

ALLOWED_CONTENT_TYPES: dict[str, ScanJobFileType] = {
    "application/pdf": ScanJobFileType.pdf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ScanJobFileType.excel,
    "application/vnd.ms-excel": ScanJobFileType.excel,
    "image/jpeg": ScanJobFileType.image,
    "image/png": ScanJobFileType.image,
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


# ── 共通シリアライザ ───────────────────────────────────────────────────────

def _job_to_read(job: ScanJob, first_result: ScanResult | None = None) -> ScanJobRead:
    """ScanJob モデル → ScanJobRead スキーマ に変換する。"""
    return ScanJobRead(
        id=job.id,
        project_id=job.project_id,
        uploaded_by=job.uploaded_by,
        original_file_name=job.original_file_name,
        file_type=job.file_type,
        status=job.status,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        deleted_at=job.deleted_at,
        vendor_name_detected=first_result.vendor_name_detected if first_result else None,
        confidence_score=(
            float(first_result.confidence_score)
            if first_result and first_result.confidence_score is not None
            else None
        ),
        item_count=len(first_result.items) if first_result else None,
    )


def _result_to_read(r: ScanResult) -> ScanResultRead:
    """ScanResult モデル → ScanResultRead スキーマ に変換する。"""
    return ScanResultRead(
        id=r.id,
        scan_job_id=r.scan_job_id,
        vendor_name_detected=r.vendor_name_detected,
        vendor_id=r.vendor_id,
        quoted_date_detected=str(r.quoted_date_detected) if r.quoted_date_detected else None,
        subtotal_detected=float(r.subtotal_detected) if r.subtotal_detected is not None else None,
        tax_detected=float(r.tax_detected) if r.tax_detected is not None else None,
        total_detected=float(r.total_detected) if r.total_detected is not None else None,
        confidence_score=float(r.confidence_score) if r.confidence_score is not None else None,
        reviewed_by=r.reviewed_by,
        reviewed_at=r.reviewed_at,
        items=[
            ScanResultItemRead(
                id=item.id,
                row_no=item.row_no,
                item_name=item.item_name,
                spec=item.spec,
                unit=item.unit,
                quantity=float(item.quantity) if item.quantity is not None else None,
                unit_price=float(item.unit_price) if item.unit_price is not None else None,
                amount=float(item.amount) if item.amount is not None else None,
                confidence=float(item.confidence) if item.confidence is not None else None,
                applied_to_qcds=item.applied_to_qcds,
                applied_to_quote=item.applied_to_quote,
            )
            for item in sorted(r.items, key=lambda x: x.row_no)
        ],
    )
