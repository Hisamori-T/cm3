"""作業日報 API。"""
from __future__ import annotations

import uuid
from datetime import date, time
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.daily_report import DailyReport, DailyReportAttachment, DailyReportEntry
from app.models.enums import PhotoType, WeatherType
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()


# ── Pydantic スキーマ ─────────────────────────────────────────

class AttachmentRead(BaseModel):
    id: uuid.UUID
    file_path: str
    photo_type: PhotoType | None
    caption: str | None
    taken_at: Any | None

    model_config = {"from_attributes": True}


class EntryCreate(BaseModel):
    project_id: uuid.UUID
    project_task_id: uuid.UUID | None = None
    work_content: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    break_minutes: int = 0
    working_minutes: int = 0
    progress_pct: int | None = None
    issues: str | None = None
    tomorrow_plan: str | None = None


class EntryRead(BaseModel):
    id: uuid.UUID
    daily_report_id: uuid.UUID
    project_id: uuid.UUID
    project_name: str | None = None
    project_number: str | None = None
    project_task_id: uuid.UUID | None
    work_content: str | None
    start_time: time | None
    end_time: time | None
    break_minutes: int
    working_minutes: int
    progress_pct: int | None
    issues: str | None
    tomorrow_plan: str | None
    attachments: list[AttachmentRead] = []

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    report_date: date
    weather: WeatherType | None = None
    temperature: int | None = None
    note: str | None = None
    entries: list[EntryCreate] = []


class ReportUpdate(BaseModel):
    weather: WeatherType | None = None
    temperature: int | None = None
    note: str | None = None


class ReportRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    report_date: date
    weather: WeatherType | None
    temperature: int | None
    submitted_at: Any | None
    note: str | None
    entries: list[EntryRead] = []
    user_name: str | None = None

    model_config = {"from_attributes": True}


# ── エンドポイント ────────────────────────────────────────────

@router.get("/daily-reports", response_model=list[ReportRead])
async def list_reports(
    user_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReportRead]:
    """日報一覧（タイムライン）。"""
    q = (
        select(DailyReport)
        .options(
            selectinload(DailyReport.user),
            selectinload(DailyReport.entries).selectinload(DailyReportEntry.attachments),
            selectinload(DailyReport.entries).selectinload(DailyReportEntry.project),
        )
        .order_by(DailyReport.report_date.desc())
    )
    if user_id:
        q = q.where(DailyReport.user_id == user_id)
    if from_date:
        q = q.where(DailyReport.report_date >= from_date)
    if to_date:
        q = q.where(DailyReport.report_date <= to_date)
    result = await db.execute(q)
    reports = result.scalars().all()

    if project_id:
        reports = [r for r in reports if any(e.project_id == project_id for e in r.entries)]

    _skip = {"entries", "user_name"}
    return [
        ReportRead(
            **{k: getattr(r, k) for k in ReportRead.model_fields if hasattr(r, k) and k not in _skip},
            entries=[
                EntryRead(
                    **{k: getattr(e, k) for k in EntryRead.model_fields
                       if hasattr(e, k) and k not in {"project_name", "project_number", "attachments"}},
                    project_name=e.project.project_name if e.project else None,
                    project_number=e.project.project_number if e.project else None,
                    attachments=[AttachmentRead.model_validate(a) for a in e.attachments],
                )
                for e in r.entries
            ],
            user_name=r.user.full_name if r.user else None,
        )
        for r in reports
    ]


@router.get("/daily-reports/{report_id}", response_model=ReportRead)
async def get_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportRead:
    """日報詳細。"""
    result = await db.execute(
        select(DailyReport)
        .options(
            selectinload(DailyReport.user),
            selectinload(DailyReport.entries).selectinload(DailyReportEntry.attachments),
            selectinload(DailyReport.entries).selectinload(DailyReportEntry.project),
        )
        .where(DailyReport.id == report_id)
    )
    r = result.scalar_one_or_none()
    if r is None:
        raise HTTPException(status_code=404, detail="日報が見つかりません")
    _skip_r = {"entries", "user_name"}
    return ReportRead(
        **{k: getattr(r, k) for k in ReportRead.model_fields if hasattr(r, k) and k not in _skip_r},
        entries=[
            EntryRead(
                **{k: getattr(e, k) for k in EntryRead.model_fields
                   if hasattr(e, k) and k not in {"project_name", "project_number", "attachments"}},
                project_name=e.project.project_name if e.project else None,
                project_number=e.project.project_number if e.project else None,
                attachments=[AttachmentRead.model_validate(a) for a in e.attachments],
            )
            for e in r.entries
        ],
        user_name=r.user.full_name if r.user else None,
    )


@router.post("/daily-reports", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportRead:
    """日報作成。"""
    report = DailyReport(
        user_id=current_user.id,
        report_date=body.report_date,
        weather=body.weather,
        temperature=body.temperature,
        note=body.note,
    )
    db.add(report)
    await db.flush()
    for entry_data in body.entries:
        entry = DailyReportEntry(daily_report_id=report.id, **entry_data.model_dump())
        db.add(entry)
    await db.commit()
    return await get_report(report.id, db, current_user)


@router.patch("/daily-reports/{report_id}", response_model=ReportRead)
async def update_report(
    report_id: uuid.UUID,
    body: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportRead:
    """日報更新。"""
    r = await db.get(DailyReport, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="日報が見つかりません")
    if r.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="自分の日報のみ編集できます")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(r, field, value)
    await db.commit()
    return await get_report(report_id, db, current_user)


@router.post("/daily-reports/{report_id}/submit", response_model=ReportRead)
async def submit_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportRead:
    """日報提出（submitted_at を設定）。"""
    from datetime import datetime, timezone
    r = await db.get(DailyReport, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="日報が見つかりません")
    if r.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="自分の日報のみ提出できます")
    r.submitted_at = datetime.now(timezone.utc)
    await db.commit()
    return await get_report(report_id, db, current_user)


@router.delete("/daily-reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """日報削除（提出前のみ）。"""
    r = await db.get(DailyReport, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="日報が見つかりません")
    if r.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="自分の日報のみ削除できます")
    if r.submitted_at is not None:
        raise HTTPException(status_code=400, detail="提出済みの日報は削除できません")
    await db.delete(r)
    await db.commit()
