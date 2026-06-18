"""ガントチャート工程表 API。"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.gantt import ProjectTask, WorkTypeMaster
from app.models.project import Project
from app.models.enums import TaskDependencyType, TaskStatus
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()


# ── Pydantic スキーマ ─────────────────────────────────────────

class WorkTypeMasterRead(BaseModel):
    """工種マスタ。"""
    id: uuid.UUID
    code: str
    name: str
    default_color: str
    display_order: int

    model_config = {"from_attributes": True}


class TaskRead(BaseModel):
    """工程タスク読み取り。"""
    id: uuid.UUID
    project_id: uuid.UUID
    parent_task_id: uuid.UUID | None
    task_no: int
    task_name: str
    work_type: str | None
    planned_start: date | None
    planned_end: date | None
    actual_start: date | None
    actual_end: date | None
    progress_pct: Decimal
    assigned_user_id: uuid.UUID | None
    assigned_vendor_id: uuid.UUID | None
    color: str | None
    dependency_task_id: uuid.UUID | None
    dependency_type: TaskDependencyType | None
    status: TaskStatus
    note: str | None
    work_type_master: WorkTypeMasterRead | None = None

    model_config = {"from_attributes": True}


# ── 工種マスタ ──────────────────────────────────────────────

@router.get("/work-types", response_model=list[WorkTypeMasterRead])
async def list_work_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkTypeMasterRead]:
    """工種マスタ一覧。"""
    result = await db.execute(
        select(WorkTypeMaster).order_by(WorkTypeMaster.display_order)
    )
    return [WorkTypeMasterRead.model_validate(wt) for wt in result.scalars().all()]


# ── 全社工程表 ─────────────────────────────────────────────

@router.get("/gantt/all", response_model=list[dict[str, Any]])
async def list_all_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """全社工程表用：全案件の工程タスクを返す（削除済案件除く）。"""
    result = await db.execute(
        select(ProjectTask)
        .options(
            selectinload(ProjectTask.project).selectinload(Project.construction_person),
            selectinload(ProjectTask.project).selectinload(Project.sales_person),
            selectinload(ProjectTask.work_type_master),
            selectinload(ProjectTask.assigned_user),
        )
        .join(Project, ProjectTask.project_id == Project.id)
        .where(Project.deleted_at.is_(None))
        .order_by(ProjectTask.planned_start.nullslast())
    )
    tasks = result.scalars().all()

    def _resolve_assignee(t: ProjectTask) -> tuple[uuid.UUID | None, str | None]:
        """タスク担当者 → 案件工事担当 → 案件営業担当 の優先順で解決する。"""
        if getattr(t, "assigned_user", None):
            return t.assigned_user_id, t.assigned_user.full_name
        p = t.project
        if p and getattr(p, "construction_person", None):
            return p.construction_person_id, p.construction_person.full_name
        if p and getattr(p, "sales_person", None):
            return p.sales_person_id, p.sales_person.full_name
        return None, None

    rows = []
    for t in tasks:
        uid, uname = _resolve_assignee(t)
        rows.append({
            **TaskRead.model_validate(t).model_dump(),
            "project_name":       t.project.project_name   if t.project else None,
            "project_number":     t.project.project_number if t.project else None,
            "assigned_user_id":   str(uid)  if uid   else None,
            "assigned_user_name": uname,
        })
    return rows
