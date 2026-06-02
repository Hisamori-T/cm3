"""業者出面管理 API。"""
from __future__ import annotations

import uuid
from datetime import date, time
from decimal import Decimal
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.attendance import VendorAttendance
from app.models.project import Project
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()


# ── Pydantic スキーマ ─────────────────────────────────────────

class AttendanceCreate(BaseModel):
    vendor_id: uuid.UUID
    attendance_date: date
    worker_count: Decimal = Decimal("1")
    worker_names: list[str] | None = None
    work_content: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    unit_price: Decimal | None = None
    amount: Decimal | None = None
    daily_report_entry_id: uuid.UUID | None = None
    note: str | None = None


class AttendanceUpdate(BaseModel):
    worker_count: Decimal | None = None
    worker_names: list[str] | None = None
    work_content: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    unit_price: Decimal | None = None
    amount: Decimal | None = None
    note: str | None = None


class AttendanceRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    vendor_id: uuid.UUID
    attendance_date: date
    worker_count: Decimal
    worker_names: list[str] | None
    work_content: str | None
    start_time: time | None
    end_time: time | None
    unit_price: Decimal | None
    amount: Decimal | None
    recorded_by: uuid.UUID
    daily_report_entry_id: uuid.UUID | None
    note: str | None
    vendor_name: str | None = None

    model_config = {"from_attributes": True}


class AttendanceSummary(BaseModel):
    vendor_id: uuid.UUID
    vendor_name: str | None
    month: str
    total_worker_count: Decimal
    working_days: int
    total_amount: Decimal | None


# ── ヘルパー ─────────────────────────────────────────────────

async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    p = await db.get(Project, project_id)
    if p is None or p.deleted_at is not None:
        raise HTTPException(status_code=404, detail="案件が見つかりません")
    return p


# ── エンドポイント ────────────────────────────────────────────

@router.get("/projects/{project_id}/attendance", response_model=list[AttendanceRead])
async def list_attendance(
    project_id: uuid.UUID,
    month: str | None = None,
    vendor_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceRead]:
    """出面台帳一覧（月フィルタ可）。"""
    await _get_project_or_404(project_id, db)
    q = (
        select(VendorAttendance)
        .options(selectinload(VendorAttendance.vendor))
        .where(VendorAttendance.project_id == project_id)
        .order_by(VendorAttendance.attendance_date)
    )
    if vendor_id:
        q = q.where(VendorAttendance.vendor_id == vendor_id)
    result = await db.execute(q)
    rows = result.scalars().all()
    if month:
        rows = [r for r in rows if str(r.attendance_date)[:7] == month]
    return [
        AttendanceRead(
            **AttendanceRead.model_validate(r).model_dump(exclude={"vendor_name"}),
            vendor_name=r.vendor.vendor_name if r.vendor else None,
        )
        for r in rows
    ]


@router.post("/projects/{project_id}/attendance", response_model=AttendanceRead, status_code=status.HTTP_201_CREATED)
async def create_attendance(
    project_id: uuid.UUID,
    body: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceRead:
    """出面記録追加。"""
    await _get_project_or_404(project_id, db)
    record = VendorAttendance(
        project_id=project_id,
        recorded_by=current_user.id,
        **body.model_dump(),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return AttendanceRead.model_validate(record)


@router.patch("/projects/{project_id}/attendance/{attendance_id}", response_model=AttendanceRead)
async def update_attendance(
    project_id: uuid.UUID,
    attendance_id: uuid.UUID,
    body: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceRead:
    """出面記録更新。"""
    await _get_project_or_404(project_id, db)
    record = await db.get(VendorAttendance, attendance_id)
    if record is None or record.project_id != project_id:
        raise HTTPException(status_code=404, detail="出面記録が見つかりません")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return AttendanceRead.model_validate(record)


@router.delete("/projects/{project_id}/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance(
    project_id: uuid.UUID,
    attendance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """出面記録削除。"""
    await _get_project_or_404(project_id, db)
    record = await db.get(VendorAttendance, attendance_id)
    if record is None or record.project_id != project_id:
        raise HTTPException(status_code=404, detail="出面記録が見つかりません")
    await db.delete(record)
    await db.commit()


@router.get("/projects/{project_id}/attendance/summary", response_model=list[AttendanceSummary])
async def attendance_summary(
    project_id: uuid.UUID,
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceSummary]:
    """出面集計サマリ（月単位）。"""
    await _get_project_or_404(project_id, db)
    where_clause = "WHERE va.project_id = :project_id"
    params: dict[str, Any] = {"project_id": str(project_id)}
    if month:
        where_clause += " AND TO_CHAR(DATE_TRUNC('month', va.attendance_date), 'YYYY-MM') = :month"
        params["month"] = month

    rows = await db.execute(
        text(f"""
            SELECT
                va.vendor_id,
                v.vendor_name AS vendor_name,
                TO_CHAR(DATE_TRUNC('month', va.attendance_date), 'YYYY-MM') AS month,
                SUM(va.worker_count) AS total_worker_count,
                COUNT(DISTINCT va.attendance_date) AS working_days,
                SUM(va.amount) AS total_amount
            FROM vendor_attendances va
            LEFT JOIN vendors v ON v.id = va.vendor_id
            {where_clause}
            GROUP BY va.vendor_id, v.vendor_name, DATE_TRUNC('month', va.attendance_date)
            ORDER BY month, vendor_name
        """),
        params,
    )
    return [
        AttendanceSummary(
            vendor_id=row.vendor_id,
            vendor_name=row.vendor_name,
            month=row.month,
            total_worker_count=row.total_worker_count,
            working_days=row.working_days,
            total_amount=row.total_amount,
        )
        for row in rows
    ]
