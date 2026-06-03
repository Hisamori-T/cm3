"""注文請書エンドポイント。"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.acknowledgment import Acknowledgment
from app.models.project import Project
from app.models.user import User
from app.schemas.acknowledgment import AcknowledgmentRead, AcknowledgmentUpdate

router = APIRouter(tags=["acknowledgments"])
logger = structlog.get_logger(__name__)


def _to_read(a: Acknowledgment) -> AcknowledgmentRead:
    return AcknowledgmentRead(
        id=a.id,
        order_id=a.order_id,
        project_id=a.project_id,
        acknowledgment_number=a.acknowledgment_number,
        issue_date=a.issue_date,
        client_address=a.client_address,
        client_company=a.client_company,
        client_person=a.client_person,
        amount_excl_tax=float(a.amount_excl_tax) if a.amount_excl_tax is not None else None,
        tax_amount=float(a.tax_amount) if a.tax_amount is not None else None,
        total_amount=float(a.total_amount) if a.total_amount is not None else None,
        stamp_tax=float(a.stamp_tax) if a.stamp_tax is not None else None,
        construction_period_start=a.construction_period_start,
        construction_period_end=a.construction_period_end,
        payment_condition=a.payment_condition,
        terms_and_conditions=a.terms_and_conditions,
        status=a.status,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


@router.get("/projects/{project_id}/acknowledgments", response_model=list[AcknowledgmentRead])
async def list_acknowledgments(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AcknowledgmentRead]:
    """案件の注文請書一覧を返す。"""
    project = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    acks = (await db.execute(
        select(Acknowledgment)
        .where(Acknowledgment.project_id == project_id)
        .order_by(Acknowledgment.created_at.desc())
    )).scalars().all()
    return [_to_read(a) for a in acks]


@router.get("/acknowledgments/{acknowledgment_id}", response_model=AcknowledgmentRead)
async def get_acknowledgment(
    acknowledgment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AcknowledgmentRead:
    """注文請書詳細を返す。"""
    ack = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.id == acknowledgment_id)
    )).scalar_one_or_none()
    if ack is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文請書が見つかりません")
    return _to_read(ack)


@router.patch("/acknowledgments/{acknowledgment_id}", response_model=AcknowledgmentRead)
async def update_acknowledgment(
    acknowledgment_id: uuid.UUID,
    body: AcknowledgmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AcknowledgmentRead:
    """注文請書を更新する（宛先・日付・ステータスなど独立項目のみ）。"""
    ack = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.id == acknowledgment_id)
    )).scalar_one_or_none()
    if ack is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文請書が見つかりません")

    for field in (
        "issue_date", "client_address", "client_company", "client_person",
        "amount_excl_tax", "tax_amount", "total_amount", "stamp_tax",
        "construction_period_start", "construction_period_end",
        "payment_condition", "terms_and_conditions", "status",
    ):
        val = getattr(body, field, None)
        if val is not None:
            setattr(ack, field, val)

    await db.commit()
    await db.refresh(ack)
    return _to_read(ack)


@router.delete("/acknowledgments/{acknowledgment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_acknowledgment(
    acknowledgment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """注文請書を削除する。"""
    ack = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.id == acknowledgment_id)
    )).scalar_one_or_none()
    if ack is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文請書が見つかりません")
    await db.delete(ack)
    await db.commit()
