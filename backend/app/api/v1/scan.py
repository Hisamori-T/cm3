"""業者見積スキャンエンドポイント。"""
from __future__ import annotations

import mimetypes
import os
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

import aiofiles
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pydantic import BaseModel as _BaseModel
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import ScanJobFileType, ScanJobStatus
from app.models.scan import ScanJob, ScanResult, ScanResultItem
from app.models.user import User
from app.schemas.scan import (
    ApplyScanResultRequest,
    ApplyScanResultResponse,
    BulkApplyRequest,
    BulkApplyResponse,
    BulkDeleteRequest,
    BulkPurgeRequest,
    BulkRestoreRequest,
    ScanJobDetailRead,
    ScanJobRead,
    ScanResultItemRead,
    ScanResultRead,
    ScanResultUpdate,
)

router = APIRouter(tags=["scan"])
logger = structlog.get_logger(__name__)

ALLOWED_CONTENT_TYPES = {
    "application/pdf": ScanJobFileType.pdf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ScanJobFileType.excel,
    "application/vnd.ms-excel": ScanJobFileType.excel,
    "image/jpeg": ScanJobFileType.image,
    "image/png": ScanJobFileType.image,
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _job_to_read(job: ScanJob, first_result: ScanResult | None = None) -> ScanJobRead:
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
        confidence_score=float(first_result.confidence_score) if first_result and first_result.confidence_score is not None else None,
        item_count=len(first_result.items) if first_result else None,
    )


def _result_to_read(r: ScanResult) -> ScanResultRead:
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


@router.post("/scan/upload", response_model=ScanJobRead, status_code=status.HTTP_202_ACCEPTED)
async def upload_scan_file(
    file: UploadFile,
    project_id: uuid.UUID | None = Query(None, description="紐付ける案件ID（省略可）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScanJobRead:
    """業者見積ファイルをアップロードしてスキャンジョブを登録する。"""
    content_type = file.content_type or ""
    file_type = ALLOWED_CONTENT_TYPES.get(content_type)
    if file_type is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="PDF、Excel、JPEG、PNG のみアップロード可能です",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="ファイルサイズは 20MB 以下にしてください",
        )

    # 工事台帳Excelを誤アップロードしていないか確認
    if file_type == ScanJobFileType.excel:
        try:
            import io
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            sheet_names = wb.sheetnames
            wb.close()
            if "工事台帳" in sheet_names:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="このファイルは工事台帳Excelです。案件インポートには「Excelインポート」ページ（/admin/import）をご利用ください。",
                )
        except HTTPException:
            raise
        except Exception:
            pass  # 解析失敗は無視してアップロード続行

    # 一時保存ディレクトリを作成
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    job_id = uuid.uuid4()
    ext = Path(file.filename or "file").suffix
    saved_path = upload_dir / f"{job_id}{ext}"

    async with aiofiles.open(saved_path, "wb") as f:
        await f.write(content)

    job = ScanJob(
        id=job_id,
        project_id=project_id,
        uploaded_by=current_user.id,
        original_file_path=str(saved_path),
        original_file_name=file.filename or "unknown",
        file_type=file_type,
        status=ScanJobStatus.pending,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Celery ジョブをエンキュー
    try:
        from app.tasks.scan_tasks import process_scan_job
        process_scan_job.delay(str(job_id))
        logger.info("scan_job_enqueued", job_id=str(job_id), file=file.filename)
    except Exception as e:
        logger.warning("celery_enqueue_failed", job_id=str(job_id), error=str(e))
        # Celery が使えなくても HTTP 202 は返す（ジョブは pending のまま）

    return _job_to_read(job)


@router.get("/scan/jobs", response_model=list[ScanJobRead])
async def list_scan_jobs(
    project_id: uuid.UUID | None = Query(None),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ScanJobRead]:
    """スキャンジョブ一覧を返す。include_deleted=true は admin/super_admin のみ。"""
    from app.models.enums import UserRole
    stmt = (
        select(ScanJob)
        .options(selectinload(ScanJob.results).selectinload(ScanResult.items))
        .order_by(ScanJob.created_at.desc())
    )
    if project_id:
        stmt = stmt.where(ScanJob.project_id == project_id)
    # 論理削除フィルタ
    if include_deleted and current_user.role in (UserRole.admin, UserRole.super_admin):
        stmt = stmt.where(ScanJob.deleted_at.is_not(None))
    else:
        stmt = stmt.where(ScanJob.deleted_at.is_(None))

    rows = (await db.execute(stmt.offset((page - 1) * per_page).limit(per_page))).scalars().all()
    result = []
    for j in rows:
        first = j.results[0] if j.results else None
        result.append(_job_to_read(j, first))
    return result


@router.get("/scan/jobs/{job_id}", response_model=ScanJobDetailRead)
async def get_scan_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScanJobDetailRead:
    """スキャンジョブ詳細（解析結果含む）を返す。"""
    job = (await db.execute(
        select(ScanJob)
        .options(selectinload(ScanJob.results).selectinload(ScanResult.items))
        .where(ScanJob.id == job_id)
    )).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="スキャンジョブが見つかりません")

    return ScanJobDetailRead(
        **_job_to_read(job).model_dump(),
        results=[_result_to_read(r) for r in job.results],
    )


@router.get("/scan/file/{job_id}")
async def get_scan_file(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """アップロードされたスキャンファイルを返す（プレビュー用）。"""
    job = (await db.execute(
        select(ScanJob).where(ScanJob.id == job_id)
    )).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="スキャンジョブが見つかりません")

    file_path = Path(job.original_file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイルが見つかりません")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(
        path=str(file_path),
        media_type=mime_type or "application/octet-stream",
        filename=job.original_file_name,
    )


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
    await db.refresh(result)
    # items は refresh で取れないため再ロード
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
    await db.refresh(job)

    job = (await db.execute(
        select(ScanJob)
        .options(selectinload(ScanJob.results).selectinload(ScanResult.items))
        .where(ScanJob.id == job.id)
    )).scalar_one()

    return ScanJobDetailRead(
        **_job_to_read(job).model_dump(),
        results=[_result_to_read(r) for r in job.results],
    )


@router.post("/scan/results/{result_id}/apply", response_model=ApplyScanResultResponse)
async def apply_scan_result(
    result_id: uuid.UUID,
    body: ApplyScanResultRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApplyScanResultResponse:
    """スキャン解析結果を QCDS 直接工事費行または見積明細に転記する。
    vendor_id が設定されていれば単価履歴にも蓄積する。
    """
    from math import floor

    from sqlalchemy import func as sa_func

    from app.models.enums import VendorPriceHistorySource
    from app.models.qcds import QCDS, QCDSDirectWork
    from app.models.quote import Quote, QuoteItem
    from app.models.vendor import VendorPriceHistory

    if body.target not in ("qcds", "quote"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target は 'qcds' または 'quote' を指定してください",
        )

    # ── 解析結果を取得 ────────────────────────────────────────────────────────
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

    # 対象明細を絞り込み（item_ids が空なら全明細）
    target_items = [
        item for item in result.items
        if not body.item_ids or item.id in set(body.item_ids)
    ]
    if not target_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="転記対象の明細がありません",
        )

    applied_count = 0
    price_histories_created = 0

    # ── QCDS への転記 ─────────────────────────────────────────────────────────
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

    # ── 見積への転記 ──────────────────────────────────────────────────────────
    else:
        from app.models.quote import QuoteVersion

        quote = (await db.execute(
            select(Quote).where(Quote.id == body.target_id)
        )).scalar_one_or_none()
        if quote is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

        # 業者見積版を自動作成 — version_id なしの items は業者見積ページで表示されないため必須
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

        # 見積合計を再計算
        await db.flush()
        all_items = (await db.execute(
            select(QuoteItem).where(QuoteItem.quote_id == quote.id)
        )).scalars().all()
        subtotal = sum(float(i.amount or 0) for i in all_items)
        quote.subtotal = subtotal
        quote.tax_amount = floor(subtotal * 0.10)
        quote.total_amount = subtotal + floor(subtotal * 0.10)

    # ── 単価履歴への蓄積 ──────────────────────────────────────────────────────
    from app.models.vendor import Vendor
    vendor_id_for_history = result.vendor_id
    if vendor_id_for_history is None and result.vendor_name_detected:
        # 業者名で既存業者を検索、なければ新規作成
        existing = (await db.execute(
            select(Vendor).where(Vendor.vendor_name == result.vendor_name_detected)
        )).scalars().first()
        if existing:
            vendor_id_for_history = existing.id
        else:
            new_vendor = Vendor(
                id=uuid.uuid4(),
                vendor_name=result.vendor_name_detected,
            )
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
    logger.info(
        "scan_result_applied",
        result_id=str(result_id),
        target=body.target,
        target_id=str(body.target_id),
        applied=applied_count,
        histories=price_histories_created,
    )
    return ApplyScanResultResponse(
        applied_count=applied_count,
        price_histories_created=price_histories_created,
        target=body.target,
        target_id=body.target_id,
    )


# ---------------------------------------------------------------------------
# Phase 1-A: 新転記エンドポイント
# ---------------------------------------------------------------------------

class TransferToQcdsRequest(_BaseModel):
    qcds_id: uuid.UUID
    section_id: uuid.UUID | None = None  # 将来の拡張用（セクション指定）


class TransferToQcdsResponse(_BaseModel):
    qcds_id: uuid.UUID
    vendor_name: str | None
    total_amount: float
    row_no: int


class SaveAsVersionRequest(_BaseModel):
    project_id: uuid.UUID
    markup_rate: float = 1.0


class SaveAsVersionResponse(_BaseModel):
    version_id: uuid.UUID
    version_no: int
    vendor_name_snapshot: str | None
    item_count: int


@router.post("/scan/results/{result_id}/transfer-to-qcds", response_model=TransferToQcdsResponse)
async def transfer_to_qcds(
    result_id: uuid.UUID,
    body: TransferToQcdsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransferToQcdsResponse:
    """スキャン結果を QCDS に業者名 + 合計金額で 1 行だけ追加する。
    顧客見積には何もしない。
    """
    from sqlalchemy import func as sa_func
    from app.models.qcds import QCDS, QCDSDirectWork

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

    from app.models.enums import QCDSCategory
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
    """スキャン結果を業者見積版として保存する。QCDS にも顧客見積にも転記しない。"""
    from math import floor
    from sqlalchemy import func as sa_func
    from app.models.quote import Quote, QuoteItem, QuoteVersion

    result = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(ScanResult.id == result_id)
    )).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="解析結果が見つかりません")

    # 案件の Quote を取得（なければ自動作成）
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

    # 業者マスタへの自動登録
    from app.models.vendor import Vendor, VendorPriceHistory
    from app.models.enums import VendorPriceHistorySource
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
    logger.info(
        "scan_saved_as_version",
        result_id=str(result_id),
        version_id=str(new_version.id),
        item_count=len(items_sorted),
    )
    return SaveAsVersionResponse(
        version_id=new_version.id,
        version_no=new_version.version_no,
        vendor_name_snapshot=new_version.vendor_name_snapshot,
        item_count=len(items_sorted),
    )


# ---------------------------------------------------------------------------
# 一括操作エンドポイント (B-2)
# ---------------------------------------------------------------------------

@router.post("/scan/bulk-apply", response_model=BulkApplyResponse)
async def bulk_apply_scan_results(
    body: BulkApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkApplyResponse:
    """複数スキャン解析結果を指定案件の QCDS・見積書に一括転記する。"""
    from math import floor

    from sqlalchemy import func as sa_func

    from app.models.enums import VendorPriceHistorySource
    from app.models.qcds import QCDS, QCDSDirectWork
    from app.models.quote import Quote, QuoteItem
    from app.models.vendor import VendorPriceHistory

    if not body.targets:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="targets が空です")

    results = (await db.execute(
        select(ScanResult)
        .options(selectinload(ScanResult.items))
        .where(
            ScanResult.id.in_(body.scan_result_ids),
            ScanResult.deleted_at.is_(None),
        )
    )).scalars().all()

    if not results:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="転記対象の解析結果が見つかりません")

    qcds_affected = 0
    quote_affected = 0

    # QCDS 転記
    if "qcds" in body.targets:
        # 案件の最新 QCDS を取得
        from app.models.qcds import QCDS as QCDSModel
        qcds = (await db.execute(
            select(QCDSModel)
            .where(QCDSModel.project_id == body.project_id)
            .order_by(QCDSModel.revision.desc())
        )).scalars().first()
        if qcds is None:
            # QCDS がなければ自動作成
            qcds = QCDSModel(project_id=body.project_id)
            db.add(qcds)
            await db.flush()

        max_row = (await db.execute(
            select(sa_func.coalesce(sa_func.max(QCDSDirectWork.row_no), 0))
            .where(QCDSDirectWork.qcds_id == qcds.id)
        )).scalar_one()

        for r in results:
            # 1業者=1グロス行
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

    # 業者見積 転記（version_id付きで QuoteVersion を自動作成）
    if "quote" in body.targets:
        from app.models.quote import Quote as QuoteModel, QuoteItem as QuoteItemModel, QuoteVersion
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
            # スキャン結果1件につき1版を作成
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

    # 業者マスタ保存
    if body.save_to_vendor_master:
        from app.models.vendor import Vendor
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
    logger.info(
        "bulk_apply",
        project_id=str(body.project_id),
        result_ids=[str(r) for r in body.scan_result_ids],
        targets=body.targets,
        qcds=qcds_affected,
        quote=quote_affected,
    )

    from app.models.project import Project
    proj = (await db.execute(select(Project).where(Project.id == body.project_id))).scalar_one_or_none()
    proj_num = proj.project_number if proj else ""

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
        select(ScanJob).where(
            ScanJob.id.in_(body.scan_job_ids),
            ScanJob.deleted_at.is_(None),
        )
    )).scalars().all()
    for job in jobs:
        job.deleted_at = now
        job.deleted_by = current_user.id
    await db.commit()
    logger.info("bulk_delete", job_ids=[str(j) for j in body.scan_job_ids], user_id=str(current_user.id))


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
            ScanJob.deleted_at.is_not(None),  # 論理削除済みのみ物理削除可
        )
    )).scalars().all()
    for job in jobs:
        await db.delete(job)
    await db.commit()
    logger.info("bulk_purge", job_ids=[str(j) for j in body.scan_job_ids])
