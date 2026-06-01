"""スケジュール管理 API。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.schedule import ScheduleEvent, ScheduleEventAttendee
from app.models.enums import AttendeeResponse, ScheduleEventType, ScheduleVisibility
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()


# ── Pydantic スキーマ ─────────────────────────────────────────

class AttendeeRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    response: AttendeeResponse

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    title: str
    event_type: ScheduleEventType = ScheduleEventType.meeting
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    description: str | None = None
    location: str | None = None
    project_id: uuid.UUID | None = None
    project_task_id: uuid.UUID | None = None
    visibility: ScheduleVisibility = ScheduleVisibility.public
    color: str | None = None
    attendee_user_ids: list[uuid.UUID] = []


class EventUpdate(BaseModel):
    title: str | None = None
    event_type: ScheduleEventType | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    description: str | None = None
    location: str | None = None
    project_id: uuid.UUID | None = None
    visibility: ScheduleVisibility | None = None
    color: str | None = None


class EventRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    project_task_id: uuid.UUID | None
    event_type: ScheduleEventType
    title: str
    description: str | None
    start_at: datetime
    end_at: datetime
    all_day: bool
    location: str | None
    organizer_id: uuid.UUID
    visibility: ScheduleVisibility
    color: str | None
    attendees: list[AttendeeRead] = []
    project_name: str | None = None
    organizer_name: str | None = None

    model_config = {"from_attributes": True}


# ── エンドポイント ────────────────────────────────────────────

def _to_read(event: ScheduleEvent) -> EventRead:
    _skip = {"attendees", "project_name", "organizer_name"}
    return EventRead(
        **{k: getattr(event, k) for k in EventRead.model_fields if hasattr(event, k) and k not in _skip},
        attendees=[AttendeeRead.model_validate(a) for a in event.attendees],
        project_name=event.project.project_name if event.project else None,
        organizer_name=event.organizer.full_name if event.organizer else None,
    )


def _load_opts() -> Any:
    return [
        selectinload(ScheduleEvent.attendees),
        selectinload(ScheduleEvent.project),
        selectinload(ScheduleEvent.organizer),
    ]


@router.get("/schedule", response_model=list[EventRead])
async def list_events(
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    project_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EventRead]:
    """スケジュール一覧。"""
    q = select(ScheduleEvent).options(*_load_opts()).order_by(ScheduleEvent.start_at)
    if from_dt:
        q = q.where(ScheduleEvent.start_at >= from_dt)
    if to_dt:
        q = q.where(ScheduleEvent.end_at <= to_dt)
    if project_id:
        q = q.where(ScheduleEvent.project_id == project_id)
    result = await db.execute(q)
    return [_to_read(e) for e in result.scalars().all()]


@router.get("/schedule/{event_id}", response_model=EventRead)
async def get_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventRead:
    """イベント詳細。"""
    result = await db.execute(
        select(ScheduleEvent).options(*_load_opts()).where(ScheduleEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="イベントが見つかりません")
    return _to_read(event)


@router.post("/schedule", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventRead:
    """イベント作成。"""
    data = body.model_dump(exclude={"attendee_user_ids"})
    event = ScheduleEvent(organizer_id=current_user.id, **data)
    db.add(event)
    await db.flush()
    for uid in body.attendee_user_ids:
        db.add(ScheduleEventAttendee(schedule_event_id=event.id, user_id=uid))
    await db.commit()
    return await get_event(event.id, db, current_user)


@router.patch("/schedule/{event_id}", response_model=EventRead)
async def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventRead:
    """イベント更新。"""
    event = await db.get(ScheduleEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="イベントが見つかりません")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    await db.commit()
    return await get_event(event_id, db, current_user)


@router.delete("/schedule/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """イベント削除。"""
    event = await db.get(ScheduleEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="イベントが見つかりません")
    await db.delete(event)
    await db.commit()


@router.patch("/schedule/{event_id}/respond", response_model=EventRead)
async def respond_to_event(
    event_id: uuid.UUID,
    response: AttendeeResponse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventRead:
    """参加・辞退応答。"""
    result = await db.execute(
        select(ScheduleEventAttendee)
        .where(
            ScheduleEventAttendee.schedule_event_id == event_id,
            ScheduleEventAttendee.user_id == current_user.id,
        )
    )
    attendee = result.scalar_one_or_none()
    if attendee is None:
        raise HTTPException(status_code=404, detail="参加者として登録されていません")
    attendee.response = response
    await db.commit()
    return await get_event(event_id, db, current_user)
