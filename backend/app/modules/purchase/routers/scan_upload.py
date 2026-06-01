"""スキャンジョブ: アップロード・一覧・詳細・ファイル取得エンドポイント。

元: app.api.v1.scan の前半部（〜255行）
"""
from __future__ import annotations

import uuid
import mimetypes
from pathlib import Path

import aiofiles
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import ScanJobFileType, ScanJobStatus
from app.models.scan import ScanJob, ScanResult
from app.models.user import User
from app.schemas.scan import ScanJobDetailRead, ScanJobRead
from app.modules.purchase.routers._shared import (
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_SIZE,
    _job_to_read,
    _result_to_read,
)

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["scan"])


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
                    detail=(
                        "このファイルは工事台帳Excelです。"
                        "案件インポートには「Excelインポート」ページ（/admin/import）をご利用ください。"
                    ),
                )
        except HTTPException:
            raise
        except Exception:
            pass

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

    # Celery ジョブをエンキュー（scan_tasks は独立 — import 循環なし）
    try:
        from app.tasks.scan_tasks import process_scan_job
        process_scan_job.delay(str(job_id))
        logger.info("scan_job_enqueued", job_id=str(job_id), file=file.filename)
    except Exception as e:
        logger.warning("celery_enqueue_failed", job_id=str(job_id), error=str(e))

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
