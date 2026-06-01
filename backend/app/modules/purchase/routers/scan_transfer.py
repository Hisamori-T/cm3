"""スキャン解析結果の転記・一括操作エンドポイント。

元: app.api.v1.scan の後半部（375〜1019行）
分割: apply / transfer-to-qcds / save-as-version / bulk-*
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from math import floor

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.scan import ScanJob, ScanResult
from app.models.user import User
from app.schemas.scan import (
    ApplyScanResultRequest,
    ApplyScanResultResponse,
    BulkApplyRequest,
    BulkApplyResponse,
    BulkDeleteRequest,
    BulkPurgeRequest,
    BulkRestoreRequest,
)
from app.modules.purchase.routers._shared import _job_to_read, _result_to_read

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["scan"])


# ── ローカルスキーマ（Phase 1-A 追加エンドポイント） ─────────────────────────

class TransferToQcdsRequest(BaseModel):
    qcds_id: uuid.UUID
    section_id: uuid.UUID | None = None


class TransferToQcdsResponse(BaseModel):
    qcds_id: uuid.UUID
    vendor_name: str | None
    total_amount: float
    row_no: int


class SaveAsVersionRequest(BaseModel):
    project_id: uuid.UUID
    markup_rate: float = 1.0


class SaveAsVersionResponse(BaseModel):
    version_id: uuid.UUID
    version_no: int
    vendor_name_snapshot: str | None
    item_count: int


# ── エンドポイント ────────────────────────────────────────────────────────────

@router.post("/scan/results/{result_id}/apply", response_model=ApplyScanResultResponse)
async def apply_scan_result(
    result_id: uuid.UUID,
    body: ApplyScanResultRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApplyScanResultResponse:
    """スキャン解析結果を QCDS 直接工事費行または見積明細に転記する。"""
    from sqlalchemy import func as sa_func
    from app.models.enums import VendorPriceHistorySource
    from app.models.qcds import QCDS, QCDSDirectWork
    from app.models.quote import Quote, QuoteItem, QuoteVersion
    from app.models.vendor import Vendor, VendorPriceHistory

    if body.target not in ("qcds", "quote"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target は 'qcds' または 'quote' を指定してください",
        )

    result = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id == result_id)
    )).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="解析結果が見つかりません")

    job = (await db.execute(
        select(ScanJob).where(ScanJob.id == result.scan_job_id)
    )).scalar_one()

    target_items = [
        item for item in result.items
        if not body.item_ids or item.id in set(body.item_ids)
    ]
    if not target_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="転記対象の明細がありません")

    applied_count = 0
    price_histories_created = 0

    if body.target == "qcds":
        qcds = (await db.execute(
            select(QCDS).where(QCDS.id == body.target_id)
        )).scalar_one_or_none()
        if qcds is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QCDS が見つかりません")

        max_row = (await db.execute(
            select(sa_func.coalesce(sa_func.max(QCDSDirectWork.row_no), 0))
            .where(QCDSDirectWork.qcds_id == qcds.id)
        )).scalar_one()

        for i, item in enumerate(target_items):
            db.add(QCDSDirectWork(
                qcds_id=qcds.id,
                row_no=max_row + i + 1,
                work_type=item.item_name,
                vendor_id=result.vendor_id,
                vendor_name_snapshot=result.vendor_name_detected,
                budget_amount=item.amount,
            ))
            item.applied_to_qcds = True
            applied_count += 1
    else:
        quote = (await db.execute(
            select(Quote).where(Quote.id == body.target_id)
        )).scalar_one_or_none()
        if quote is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

        max_version_no = (await db.execute(
            select(sa_func.coalesce(sa_func.max(QuoteVersion.version_no), 0))
            .where(QuoteVersion.quote_id == quote.id)
        )).scalar_one()
        new_version = QuoteVersion(
            id=uuid.uuid4(),
            quote_id=quote.id,
            version_no=max_version_no + 1,
            vendor_id=result.vendor_id,
            vendor_name_snapshot=result.vendor_name_detected or "スキャン取込",
            markup_rate=1.0,
        )
        db.add(new_version)
        await db.flush()

        max_row = (await db.execute(
            select(sa_func.coalesce(sa_func.max(QuoteItem.row_no), 0))
            .where(QuoteItem.quote_id == quote.id)
        )).scalar_one()

        for i, item in enumerate(target_items):
            db.add(QuoteItem(
                quote_id=quote.id,
                version_id=new_version.id,
                row_no=max_row + i + 1,
                item_name=item.item_name,
                spec=item.spec,
                unit=item.unit,
                quantity=item.quantity,
                unit_price=item.unit_price,
                cost_price=item.unit_price,
                amount=item.amount,
                source_vendor_id=result.vendor_id,
                source_scan_result_id=result.id,
            ))
            item.applied_to_quote = True
            applied_count += 1

        await db.flush()
        all_items = (await db.execute(
            select(QuoteItem).where(QuoteItem.quote_id == quote.id)
        )).scalars().all()
        subtotal = sum(float(i.amount or 0) for i in all_items)
        quote.subtotal = subtotal
        quote.tax_amount = floor(subtotal * 0.10)
        quote.total_amount = subtotal + floor(subtotal * 0.10)

    vendor_id_for_history = result.vendor_id
    if vendor_id_for_history is None and result.vendor_name_detected:
        existing = (await db.execute(
            select(Vendor).where(Vendor.vendor_name == result.vendor_name_detected)
        )).scalars().first()
        if existing:
            vendor_id_for_history = existing.id
        else:
            new_vendor = Vendor(id=uuid.uuid4(), vendor_name=result.vendor_name_detected)
            db.add(new_vendor)
            await db.flush()
            vendor_id_for_history = new_vendor.id
        result.vendor_id = vendor_id_for_history

    if vendor_id_for_history is not None:
        for item in target_items:
            if item.item_name:
                db.add(VendorPriceHistory(
                    vendor_id=vendor_id_for_history,
                    project_id=job.project_id,
                    item_name=item.item_name,
                    item_spec=item.spec,
                    unit=item.unit,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    amount=item.amount,
                    quoted_at=result.quoted_date_detected,
                    source=VendorPriceHistorySource.scan,
                ))
                price_histories_created += 1

    await db.commit()
    logger.info("scan_result_applied", result_id=str(result_id), target=body.target, applied=applied_count)
    return ApplyScanResultResponse(
        applied_count=applied_count,
        price_histories_created=price_histories_created,
        target=body.target,
        target_id=body.target_id,
    )


@router.post("/scan/results/{result_id}/transfer-to-qcds", response_model=TransferToQcdsResponse)
async def transfer_to_qcds(
    result_id: uuid.UUID,
    body: TransferToQcdsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransferToQcdsResponse:
    """スキャン結果を QCDS に業者名 + 合計金額で 1 行だけ追加する。"""
    from sqlalchemy import func as sa_func
    from app.models.qcds import QCDS, QCDSDirectWork
    from app.models.enums import QCDSCategory

    result = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id == result_id)
    )).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="解析結果が見つかりません")

    qcds = (await db.execute(
        select(QCDS).where(QCDS.id == body.qcds_id)
    )).scalar_one_or_none()
    if qcds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QCDS が見つかりません")

    total = float(result.total_detected or sum(float(i.amount or 0) for i in result.items))
    max_row = (await db.execute(
        select(sa_func.coalesce(sa_func.max(QCDSDirectWork.row_no), 0))
        .where(QCDSDirectWork.qcds_id == qcds.id)
    )).scalar_one()
    new_row = max_row + 1

    db.add(QCDSDirectWork(
        qcds_id=qcds.id,
        row_no=new_row,
        work_type=result.vendor_name_detected or "スキャン取込",
        vendor_id=result.vendor_id,
        vendor_name_snapshot=result.vendor_name_detected,
        budget_amount=total,
        category=QCDSCategory.subcontract,
    ))
    for item in result.items:
        item.applied_to_qcds = True

    await db.commit()
    logger.info("scan_transfer_to_qcds", result_id=str(result_id), qcds_id=str(body.qcds_id), total=total)
    return TransferToQcdsResponse(
        qcds_id=qcds.id,
        vendor_name=result.vendor_name_detected,
        total_amount=total,
        row_no=new_row,
    )


@router.post("/scan/results/{result_id}/save-as-version", response_model=SaveAsVersionResponse)
async def save_as_version(
    result_id: uuid.UUID,
    body: SaveAsVersionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SaveAsVersionResponse:
    """スキャン結果を業者見積版として保存する。"""
    from sqlalchemy import func as sa_func
    from app.models.quote import Quote, QuoteItem, QuoteVersion
    from app.models.vendor import Vendor, VendorPriceHistory
    from app.models.enums import VendorPriceHistorySource

    result = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id == result_id)
    )).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="解析結果が見つかりません")

    quotes = (await db.execute(
        select(Quote).where(Quote.project_id == body.project_id)
    )).scalars().all()
    if not quotes:
        quote = Quote(project_id=body.project_id)
        db.add(quote)
        await db.flush()
    else:
        quote = quotes[0]

    max_version_no = (await db.execute(
        select(sa_func.coalesce(sa_func.max(QuoteVersion.version_no), 0))
        .where(QuoteVersion.quote_id == quote.id)
    )).scalar_one()

    new_version = QuoteVersion(
        id=uuid.uuid4(),
        quote_id=quote.id,
        version_no=max_version_no + 1,
        vendor_id=result.vendor_id,
        vendor_name_snapshot=result.vendor_name_detected or "スキャン取込",
        markup_rate=body.markup_rate,
    )
    db.add(new_version)
    await db.flush()

    max_row = (await db.execute(
        select(sa_func.coalesce(sa_func.max(QuoteItem.row_no), 0))
        .where(QuoteItem.quote_id == quote.id, QuoteItem.version_id == new_version.id)
    )).scalar_one()

    items_sorted = sorted(result.items, key=lambda x: x.row_no)
    for i, item in enumerate(items_sorted):
        db.add(QuoteItem(
            quote_id=quote.id,
            version_id=new_version.id,
            row_no=max_row + i + 1,
            item_name=item.item_name,
            spec=item.spec,
            unit=item.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            cost_price=item.unit_price,
            amount=item.amount,
            source_vendor_id=result.vendor_id,
            source_scan_result_id=result.id,
            source_type="scan",
        ))
        item.applied_to_quote = True

    vendor_id_for_master = result.vendor_id
    if vendor_id_for_master is None and result.vendor_name_detected:
        existing = (await db.execute(
            select(Vendor).where(Vendor.vendor_name == result.vendor_name_detected)
        )).scalars().first()
        if existing:
            vendor_id_for_master = existing.id
        else:
            new_vendor = Vendor(id=uuid.uuid4(), vendor_name=result.vendor_name_detected)
            db.add(new_vendor)
            await db.flush()
            vendor_id_for_master = new_vendor.id
        result.vendor_id = vendor_id_for_master
        new_version.vendor_id = vendor_id_for_master

    if vendor_id_for_master is not None:
        scan_job = (await db.execute(
            select(ScanJob).where(ScanJob.id == result.scan_job_id)
        )).scalar_one_or_none()
        for item in items_sorted:
            if item.item_name:
                db.add(VendorPriceHistory(
                    vendor_id=vendor_id_for_master,
                    project_id=scan_job.project_id if scan_job else body.project_id,
                    item_name=item.item_name,
                    item_spec=item.spec,
                    unit=item.unit,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    amount=item.amount,
                    quoted_at=result.quoted_date_detected,
                    source=VendorPriceHistorySource.scan,
                ))

    await db.commit()
    logger.info("scan_saved_as_version", result_id=str(result_id), version_id=str(new_version.id))
    return SaveAsVersionResponse(
        version_id=new_version.id,
        version_no=new_version.version_no,
        vendor_name_snapshot=new_version.vendor_name_snapshot,
        item_count=len(items_sorted),
    )


@router.post("/scan/bulk-apply", response_model=BulkApplyResponse)
async def bulk_apply_scan_results(
    body: BulkApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkApplyResponse:
    """複数スキャン解析結果を指定案件の QCDS・見積書に一括転記する。"""
    from sqlalchemy import func as sa_func
    from app.models.enums import VendorPriceHistorySource
    from app.models.qcds import QCDS as QCDSModel, QCDSDirectWork
    from app.models.quote import Quote as QuoteModel, QuoteItem as QuoteItemModel, QuoteVersion
    from app.models.vendor import Vendor, VendorPriceHistory

    if not body.targets:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="targets が空です")

    results = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id.in_(body.scan_result_ids), ScanResult.deleted_at.is_(None))
    )).scalars().all()

    if not results:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="転記対象の解析結果が見つかりません")

    qcds_affected = 0
    quote_affected = 0

    if "qcds" in body.targets:
        qcds = (await db.execute(
            select(QCDSModel)
            .where(QCDSModel.project_id == body.project_id)
            .order_by(QCDSModel.revision.desc())
        )).scalars().first()
        if qcds is None:
            qcds = QCDSModel(project_id=body.project_id)
            db.add(qcds)
            await db.flush()

        max_row = (await db.execute(
            select(sa_func.coalesce(sa_func.max(QCDSDirectWork.row_no), 0))
            .where(QCDSDirectWork.qcds_id == qcds.id)
        )).scalar_one()

        for r in results:
            total = float(r.total_detected or r.subtotal_detected or 0)
            max_row += 1
            db.add(QCDSDirectWork(
                qcds_id=qcds.id,
                row_no=max_row,
                work_type=None,
                vendor_id=r.vendor_id,
                vendor_name_snapshot=r.vendor_name_detected,
                budget_amount=total,
                source_scan_result_id=r.id,
            ))
            qcds_affected += 1

    if "quote" in body.targets:
        quote = (await db.execute(
            select(QuoteModel).where(QuoteModel.project_id == body.project_id)
        )).scalars().first()
        if quote is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

        max_row = (await db.execute(
            select(sa_func.coalesce(sa_func.max(QuoteItemModel.row_no), 0))
            .where(QuoteItemModel.quote_id == quote.id)
        )).scalar_one()

        for r in results:
            max_version_no = (await db.execute(
                select(sa_func.coalesce(sa_func.max(QuoteVersion.version_no), 0))
                .where(QuoteVersion.quote_id == quote.id)
            )).scalar_one()
            new_version = QuoteVersion(
                id=uuid.uuid4(),
                quote_id=quote.id,
                version_no=max_version_no + 1,
                vendor_id=r.vendor_id,
                vendor_name_snapshot=r.vendor_name_detected or "スキャン取込",
                markup_rate=1.0,
            )
            db.add(new_version)
            await db.flush()

            for item in sorted(r.items, key=lambda x: x.row_no):
                max_row += 1
                db.add(QuoteItemModel(
                    quote_id=quote.id,
                    version_id=new_version.id,
                    row_no=max_row,
                    item_name=item.item_name,
                    spec=item.spec,
                    unit=item.unit,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    cost_price=item.unit_price,
                    amount=item.amount,
                    source_vendor_id=r.vendor_id,
                    source_scan_result_id=r.id,
                ))
                item.applied_to_quote = True
                quote_affected += 1

    if body.save_to_vendor_master:
        _vendor_name_cache: dict[str, uuid.UUID] = {}
        for r in results:
            vid = r.vendor_id
            if vid is None and r.vendor_name_detected:
                name = r.vendor_name_detected
                if name in _vendor_name_cache:
                    vid = _vendor_name_cache[name]
                else:
                    existing = (await db.execute(
                        select(Vendor).where(Vendor.vendor_name == name)
                    )).scalars().first()
                    if existing:
                        vid = existing.id
                    else:
                        new_v = Vendor(id=uuid.uuid4(), vendor_name=name)
                        db.add(new_v)
                        await db.flush()
                        vid = new_v.id
                    _vendor_name_cache[name] = vid
                r.vendor_id = vid
            if vid:
                for item in r.items:
                    if item.item_name:
                        db.add(VendorPriceHistory(
                            vendor_id=vid,
                            project_id=body.project_id,
                            item_name=item.item_name,
                            item_spec=item.spec,
                            unit=item.unit,
                            quantity=item.quantity,
                            unit_price=item.unit_price,
                            amount=item.amount,
                            quoted_at=r.quoted_date_detected,
                            source=VendorPriceHistorySource.scan,
                        ))

    await db.commit()
    logger.info("bulk_apply", project_id=str(body.project_id), qcds=qcds_affected, quote=quote_affected)
    return BulkApplyResponse(
        applied_count=qcds_affected + quote_affected,
        qcds_affected=qcds_affected,
        quote_affected=quote_affected,
        qcds_url=f"/projects/{body.project_id}/qcds" if qcds_affected else None,
        quote_url=f"/projects/{body.project_id}/quote" if quote_affected else None,
    )


@router.post("/scan/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_scan_jobs(
    body: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """スキャンジョブを論理削除する。"""
    now = datetime.now(timezone.utc)
    jobs = (await db.execute(
        select(ScanJob).where(ScanJob.id.in_(body.scan_job_ids), ScanJob.deleted_at.is_(None))
    )).scalars().all()
    for job in jobs:
        job.deleted_at = now
        job.deleted_by = current_user.id
    await db.commit()
    logger.info("bulk_delete", job_ids=[str(j) for j in body.scan_job_ids])


@router.post("/scan/bulk-restore", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_restore_scan_jobs(
    body: BulkRestoreRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """論理削除済みスキャンジョブを復活させる（admin only）。"""
    from app.models.enums import UserRole
    if current_user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ実行できます")
    jobs = (await db.execute(
        select(ScanJob).where(ScanJob.id.in_(body.scan_job_ids))
    )).scalars().all()
    for job in jobs:
        job.deleted_at = None
        job.deleted_by = None
    await db.commit()
    logger.info("bulk_restore", job_ids=[str(j) for j in body.scan_job_ids])


@router.delete("/scan/bulk-purge", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_purge_scan_jobs(
    body: BulkPurgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """論理削除済みスキャンジョブを物理削除する（admin only）。"""
    from app.models.enums import UserRole
    if current_user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ実行できます")
    jobs = (await db.execute(
        select(ScanJob).where(
            ScanJob.id.in_(body.scan_job_ids),
            ScanJob.deleted_at.is_not(None),
        )
    )).scalars().all()
    for job in jobs:
        await db.delete(job)
    await db.commit()
