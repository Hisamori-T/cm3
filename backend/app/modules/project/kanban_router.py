"""営業カンバンボード API。

移行先: app.modules.project.kanban_router
旧パス: app.api.v1.kanban（後方互換 re-export を維持）
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.project import Project
from app.models.enums import ProjectStatus
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()


class KanbanCard(BaseModel):
    id: uuid.UUID
    project_number: str
    project_name: str
    status: ProjectStatus
    project_price: float | None
    client_name: str | None
    period_contract_end: date | None
    sales_person_name: str | None
    created_at: datetime
    alert: str | None = None

    model_config = {"from_attributes": True}


class KanbanColumn(BaseModel):
    status: ProjectStatus
    label: str
    cards: list[KanbanCard]


class KanbanMoveRequest(BaseModel):
    status: ProjectStatus


_STATUS_LABELS: dict[ProjectStatus, str] = {
    ProjectStatus.quote: "見積中",
    ProjectStatus.ordered: "受注",
    ProjectStatus.started: "着工",
    ProjectStatus.in_progress: "施工中",
    ProjectStatus.completed: "完工",
    ProjectStatus.billed: "請求済",
    ProjectStatus.paid: "入金済",
}


def _build_alert(project: Project) -> str | None:
    today = date.today()
    if project.status == ProjectStatus.quote and project.created_at:
        days = (datetime.now(project.created_at.tzinfo) - project.created_at).days
        if days >= 7:
            return f"見積後{days}日経過"
    if project.period_contract_end and project.period_contract_end < today:
        if project.status not in (ProjectStatus.completed, ProjectStatus.billed, ProjectStatus.paid):
            delta = (today - project.period_contract_end).days
            return f"工期超過{delta}日"
    return None


@router.get("/projects/kanban", response_model=list[KanbanColumn])
async def get_kanban(
    sales_person_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[KanbanColumn]:
    q = (
        select(Project)
        .options(
            selectinload(Project.sales_person),
            selectinload(Project.client),
        )
        .where(Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
    )
    if sales_person_id:
        q = q.where(Project.sales_person_id == sales_person_id)

    result = await db.execute(q)
    projects = result.scalars().all()

    columns: dict[ProjectStatus, list[KanbanCard]] = {s: [] for s in ProjectStatus}
    for p in projects:
        card = KanbanCard(
            id=p.id,
            project_number=p.project_number,
            project_name=p.project_name,
            status=p.status,
            project_price=float(p.project_price) if p.project_price else None,
            client_name=p.client.client_name if p.client else p.client_name,
            period_contract_end=p.period_contract_end,
            sales_person_name=p.sales_person.full_name if p.sales_person else None,
            created_at=p.created_at,
            alert=_build_alert(p),
        )
        columns[p.status].append(card)

    return [
        KanbanColumn(status=status, label=_STATUS_LABELS[status], cards=cards)
        for status, cards in columns.items()
        if cards or status in (ProjectStatus.quote, ProjectStatus.ordered, ProjectStatus.in_progress)
    ]


@router.patch("/projects/{project_id}/kanban/move", response_model=KanbanCard)
async def move_card(
    project_id: uuid.UUID,
    body: KanbanMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KanbanCard:
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.sales_person), selectinload(Project.client))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if project is None or project.deleted_at is not None:
        raise HTTPException(status_code=404, detail="案件が見つかりません")
    project.status = body.status
    await db.commit()
    await db.refresh(project)
    return KanbanCard(
        id=project.id,
        project_number=project.project_number,
        project_name=project.project_name,
        status=project.status,
        project_price=float(project.project_price) if project.project_price else None,
        client_name=project.client.client_name if project.client else project.client_name,
        period_contract_end=project.period_contract_end,
        sales_person_name=project.sales_person.full_name if project.sales_person else None,
        created_at=project.created_at,
        alert=_build_alert(project),
    )
