"""ガントチャート工程表 API。"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
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


class TaskCreate(BaseModel):
    """工程タスク作成。"""
    task_name: str
    work_type: str | None = None
    work_type_master_id: uuid.UUID | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    task_no: int = 0
    parent_task_id: uuid.UUID | None = None
    assigned_user_id: uuid.UUID | None = None
    assigned_vendor_id: uuid.UUID | None = None
    color: str | None = None
    note: str | None = None


class TaskUpdate(BaseModel):
    """工程タスク更新。"""
    task_name: str | None = None
    work_type: str | None = None
    work_type_master_id: uuid.UUID | None = None
    planned_start: date | None = None
    planned_end: date | None = None
    actual_start: date | None = None
    actual_end: date | None = None
    progress_pct: Decimal | None = None
    task_no: int | None = None
    parent_task_id: uuid.UUID | None = None
    assigned_user_id: uuid.UUID | None = None
    assigned_vendor_id: uuid.UUID | None = None
    color: str | None = None
    dependency_task_id: uuid.UUID | None = None
    dependency_type: TaskDependencyType | None = None
    status: TaskStatus | None = None
    note: str | None = None


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


# ── ヘルパー ─────────────────────────────────────────────────

async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    p = await db.get(Project, project_id)
    if p is None or p.deleted_at is not None:
        raise HTTPException(status_code=404, detail="案件が見つかりません")
    return p


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


# ── 案件単位の工程タスク ────────────────────────────────────

@router.get("/projects/{project_id}/tasks", response_model=list[TaskRead])
async def list_tasks(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskRead]:
    """案件の工程タスク一覧（task_no 昇順）。"""
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(ProjectTask)
        .options(selectinload(ProjectTask.work_type_master))
        .where(ProjectTask.project_id == project_id)
        .order_by(ProjectTask.task_no)
    )
    return [TaskRead.model_validate(t) for t in result.scalars().all()]


@router.post("/projects/{project_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: uuid.UUID,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    """工程タスク追加。"""
    await _get_project_or_404(project_id, db)
    task = ProjectTask(project_id=project_id, **body.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    result = await db.execute(
        select(ProjectTask)
        .options(selectinload(ProjectTask.work_type_master))
        .where(ProjectTask.id == task.id)
    )
    return TaskRead.model_validate(result.scalar_one())


@router.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    """工程タスク更新。"""
    await _get_project_or_404(project_id, db)
    task = await db.get(ProjectTask, task_id)
    if task is None or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    result = await db.execute(
        select(ProjectTask)
        .options(selectinload(ProjectTask.work_type_master))
        .where(ProjectTask.id == task_id)
    )
    return TaskRead.model_validate(result.scalar_one())


@router.delete("/projects/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """工程タスク削除。"""
    await _get_project_or_404(project_id, db)
    task = await db.get(ProjectTask, task_id)
    if task is None or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    await db.delete(task)
    await db.commit()


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
