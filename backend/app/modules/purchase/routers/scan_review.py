"""スキャン解析結果: 取得・更新・レビュー確認エンドポイント。

元: app.api.v1.scan の中盤部（258〜373行）
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import ScanJobStatus
from app.models.scan import ScanJob, ScanResult
from app.models.user import User
from app.schemas.scan import ScanJobDetailRead, ScanResultRead, ScanResultUpdate
from app.modules.purchase.routers._shared import _job_to_read, _result_to_read

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["scan"])


@router.get("/scan/results/{result_id}", response_model=ScanResultRead)
async def get_scan_result(
    result_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScanResultRead:
    """スキャン解析結果（明細含む）を取得する。"""
    result = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id == result_id)
    )).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="解析結果が見つかりません")
    return _result_to_read(result)


@router.patch("/scan/results/{result_id}", response_model=ScanResultRead)
async def update_scan_result(
    result_id: uuid.UUID,
    body: ScanResultUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScanResultRead:
    """スキャン解析結果（ヘッダ・明細）を更新する。"""
    result = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id == result_id)
    )).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="解析結果が見つかりません")

    if body.vendor_name_detected is not None:
        result.vendor_name_detected = body.vendor_name_detected
    if body.vendor_id is not None:
        result.vendor_id = body.vendor_id
    if body.quoted_date_detected is not None:
        try:
            result.quoted_date_detected = date.fromisoformat(body.quoted_date_detected[:10])
        except ValueError:
            pass
    if body.subtotal_detected is not None:
        result.subtotal_detected = body.subtotal_detected
    if body.tax_detected is not None:
        result.tax_detected = body.tax_detected
    if body.total_detected is not None:
        result.total_detected = body.total_detected

    if body.items:
        item_map = {item.id: item for item in result.items}
        for upd in body.items:
            target = item_map.get(upd.id)
            if target is None:
                continue
            if upd.item_name is not None:
                target.item_name = upd.item_name
            if upd.spec is not None:
                target.spec = upd.spec
            if upd.unit is not None:
                target.unit = upd.unit
            if upd.quantity is not None:
                target.quantity = upd.quantity
            if upd.unit_price is not None:
                target.unit_price = upd.unit_price
            if upd.amount is not None:
                target.amount = upd.amount

    await db.commit()
    result = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id == result_id)
    )).scalar_one()
    return _result_to_read(result)


@router.post("/scan/results/{result_id}/confirm", response_model=ScanJobDetailRead)
async def confirm_scan_result(
    result_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScanJobDetailRead:
    """解析結果をレビュー済みにする。ジョブステータスを reviewed に変更する。"""
    result = (await db.execute(
        select(ScanResult).where(ScanResult.id == result_id)
    )).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="解析結果が見つかりません")

    result.reviewed_by = current_user.id
    result.reviewed_at = datetime.now(timezone.utc)

    job = (await db.execute(
        select(ScanJob)
        .options(selectinload(ScanJob.results).selectinload(ScanResult.items))
        .where(ScanJob.id == result.scan_job_id)
    )).scalar_one()
    job.status = ScanJobStatus.reviewed

    await db.commit()

    job = (await db.execute(
        select(ScanJob)
        .options(selectinload(ScanJob.results).selectinload(ScanResult.items))
        .where(ScanJob.id == job.id)
    )).scalar_one()

    return ScanJobDetailRead(
        **_job_to_read(job).model_dump(),
        results=[_result_to_read(r) for r in job.results],
    )
