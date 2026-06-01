"""進捗ログ API — 案件の進捗・写真・図面の記録と閲覧。"""
from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.progress import ProgressAttachment, ProgressLog
from app.models.project import Project
from app.models.user import User
from app.models.enums import ProgressLogType
from app.schemas.progress import ProgressLogListResponse, ProgressLogRead

logger = structlog.get_logger()
router = APIRouter()


def _to_read(log: ProgressLog) -> ProgressLogRead:
    return ProgressLogRead(
        id=log.id,
        project_id=log.project_id,
        logged_at=log.logged_at,
        logged_by_name=log.logger.full_name if log.logger else "不明",
        log_type=log.log_type,
        title=log.title,
        body=log.body,
        status_changed_to=log.status_changed_to,
        attachments=list(log.attachments),
    )


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    p = await db.get(Project, project_id)
    if p is None or p.deleted_at is not None:
        raise HTTPException(status_code=404, detail="案件が見つかりません")
    return p


@router.get("/projects/{project_id}/progress", response_model=ProgressLogListResponse)
async def list_progress(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressLogListResponse:
    """進捗ログ一覧（新しい順）。"""
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(ProgressLog)
        .options(selectinload(ProgressLog.logger), selectinload(ProgressLog.attachments))
        .where(ProgressLog.project_id == project_id)
        .order_by(ProgressLog.logged_at.desc())
    )
    logs = result.scalars().all()
    return ProgressLogListResponse(items=[_to_read(l) for l in logs], total=len(logs))


@router.post(
    "/projects/{project_id}/progress",
    response_model=ProgressLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_progress(
    project_id: uuid.UUID,
    log_type: ProgressLogType = Form(ProgressLogType.text),
    title: str | None = Form(None),
    body: str | None = Form(None),
    photo_type: str | None = Form(None),
    work_type: str | None = Form(None),
    caption: str | None = Form(None),
    location_in_site: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressLogRead:
    """進捗ログを作成する（テキスト・写真・図面）。"""
    from app.models.enums import PhotoType as PT
    await _get_project_or_404(project_id, db)

    log = ProgressLog(
        project_id=project_id,
        logged_by=current_user.id,
        log_type=log_type,
        title=title,
        body=body,
    )
    db.add(log)
    await db.flush()  # log.id を確定

    upload_dir = Path(settings.upload_dir) / "progress" / str(log.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # photo_type を enum に変換（不正値は無視）
    pt_value: PT | None = None
    if photo_type:
        try:
            pt_value = PT(photo_type)
        except ValueError:
            pt_value = None

    for upload in files:
        if not upload.filename:
            continue
        ext = Path(upload.filename).suffix.lower()
        safe_name = f"{uuid.uuid4()}{ext}"
        saved_path = upload_dir / safe_name
        content = await upload.read()
        saved_path.write_bytes(content)

        mime, _ = mimetypes.guess_type(upload.filename)
        attachment = ProgressAttachment(
            progress_log_id=log.id,
            file_path=str(saved_path),
            file_name=upload.filename,
            mime_type=mime or upload.content_type,
            file_size=len(content),
            photo_type=pt_value,
            work_type=work_type or None,
            caption=caption or None,
            location_in_site=location_in_site or None,
        )
        db.add(attachment)

    await db.commit()
    await db.refresh(log)

    result = await db.execute(
        select(ProgressLog)
        .options(selectinload(ProgressLog.logger), selectinload(ProgressLog.attachments))
        .where(ProgressLog.id == log.id)
    )
    log = result.scalar_one()
    logger.info("progress_created", project_id=str(project_id), log_id=str(log.id))
    return _to_read(log)


@router.delete(
    "/projects/{project_id}/progress/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_progress(
    project_id: uuid.UUID,
    log_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """進捗ログを削除する（作成者または管理者のみ）。"""
    log = await db.get(ProgressLog, log_id)
    if log is None or log.project_id != project_id:
        raise HTTPException(status_code=404, detail="ログが見つかりません")
    if log.logged_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="削除権限がありません")

    # 添付ファイルをディスクから削除
    for att in log.attachments:
        p = Path(att.file_path)
        if p.exists():
            p.unlink()

    await db.delete(log)
    await db.commit()


@router.get("/progress/attachments/{attachment_id}")
async def get_attachment(
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """添付ファイルを返す。"""
    att = await db.get(ProgressAttachment, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")
    file_path = Path(att.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="ファイルが存在しません")
    return FileResponse(
        path=str(file_path),
        media_type=att.mime_type or "application/octet-stream",
        filename=att.file_name,
    )


@router.delete("/progress/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """添付ファイル単体を削除する（ログ作成者または管理者のみ）。"""
    att = await db.get(ProgressAttachment, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")

    log = await db.get(ProgressLog, att.progress_log_id)
    if log and log.logged_by != current_user.id and current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="削除権限がありません")

    p = Path(att.file_path)
    if p.exists():
        p.unlink(missing_ok=True)

    await db.delete(att)
    await db.commit()
