"""案件（Project）エンドポイント: 一覧取得・新規作成・詳細取得・更新。

移行先: app.modules.project.router
旧パス: app.api.v1.projects（後方互換 re-export を維持）
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import EditHistoryChangeType, ProjectStatus, UserRole
from app.models.acknowledgment import Acknowledgment
from app.models.invoice import Invoice
from app.models.order import Order
from app.models.progress import ProgressLog
from app.models.project import Project
from app.models.qcds import QCDS
from app.models.quote import Quote, QuoteVersion
from app.models.user import User
from app.shared.services.quote_init import create_initial_quote
from app.schemas.project import (
    EditHistoryItem,
    EditHistoryResponse,
    ProjectCounts,
    ProjectCreate,
    ProjectDetail,
    ProjectListItem,
    ProjectListResponse,
    ProjectUpdate,
    StatusChangeRequest,
)
from app.services.history import record as record_history
from app.services.project_number import generate_project_number

router = APIRouter(prefix="/projects", tags=["projects"])
logger = structlog.get_logger(__name__)


def _to_list_item(p: Project) -> ProjectListItem:
    return ProjectListItem(
        id=p.id,
        project_number=p.project_number,
        project_name=p.project_name,
        client_name=p.client_name,
        status=p.status,
        order_type=p.order_type,
        contract_type=p.contract_type,
        project_price=float(p.project_price) if p.project_price is not None else None,
        sales_person_name=p.sales_person.full_name if p.sales_person else None,
        construction_person_name=p.construction_person.full_name if p.construction_person else None,
        created_at=p.created_at,
    )


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    status: ProjectStatus | None = Query(None),
    year: int | None = Query(None, description="西暦4桁（例: 2026）"),
    sales_person_id: uuid.UUID | None = Query(None),
    client_id: uuid.UUID | None = Query(None, description="顧客IDでフィルタ"),
    q: str | None = Query(None, description="工事番号・工事名・発注者のあいまい検索"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectListResponse:
    """案件一覧を返す。論理削除済みは除外。"""
    stmt = (
        select(Project)
        .options(
            selectinload(Project.sales_person),
            selectinload(Project.construction_person),
        )
        .where(Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
    )

    if status is not None:
        stmt = stmt.where(Project.status == status)

    if year is not None:
        year_start = datetime(year, 1, 1, tzinfo=timezone.utc)
        year_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        stmt = stmt.where(Project.created_at >= year_start, Project.created_at < year_end)

    if sales_person_id is not None:
        stmt = stmt.where(Project.sales_person_id == sales_person_id)

    if client_id is not None:
        stmt = stmt.where(Project.client_id == client_id)

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Project.project_number.ilike(like),
                Project.project_name.ilike(like),
                Project.client_name.ilike(like),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(stmt)).scalars().all()

    return ProjectListResponse(
        items=[_to_list_item(p) for p in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=ProjectListItem, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectListItem:
    """新規案件を作成する。project_number を省略した場合は自動採番。"""
    if body.project_number:
        dup = (await db.execute(
            select(Project).where(Project.project_number == body.project_number)
        )).scalar_one_or_none()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"工事番号 {body.project_number} は既に使用されています",
            )
        project_number = body.project_number
    else:
        employee_number = current_user.employee_number or 0
        project_number = await generate_project_number(
            employee_number=employee_number,
            project_date=date.today(),
            session=db,
        )

    project = Project(
        id=uuid.uuid4(),
        project_number=project_number,
        project_name=body.project_name,
        client_name=body.client_name,
        project_location=body.project_location,
        order_type=body.order_type,
        contract_type=body.contract_type,
        awarding_type=body.awarding_type,
        sales_person_id=body.sales_person_id,
        construction_person_id=body.construction_person_id,
        project_price=body.project_price,
        period_quote_start=body.period_quote_start,
        period_quote_end=body.period_quote_end,
        status=ProjectStatus.quote,
        created_by=current_user.id,
    )
    db.add(project)
    await db.flush()

    # 案件作成と同時に見積書（と最初の業者見積版）を自動生成する（estimate サービスに委譲）
    await create_initial_quote(
        project_id=project.id,
        project_number=project.project_number,
        project_name=body.project_name,
        project_location=body.project_location,
        db=db,
    )

    await db.commit()
    await db.refresh(project, ["sales_person", "construction_person"])

    logger.info("project_created", project_number=project_number, user_id=str(current_user.id))
    return _to_list_item(project)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectDetail:
    """案件詳細を返す。関連データの件数も含む。"""
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.sales_person),
            selectinload(Project.construction_person),
        )
        .where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    qcds_count = (await db.execute(
        select(func.count()).where(QCDS.project_id == project_id)
    )).scalar_one()
    quote_count = (await db.execute(
        select(func.count()).where(Quote.project_id == project_id)
    )).scalar_one()
    order_count = (await db.execute(
        select(func.count()).where(Order.project_id == project_id)
    )).scalar_one()
    acknowledgment_count = (await db.execute(
        select(func.count()).where(Acknowledgment.project_id == project_id)
    )).scalar_one()
    invoice_count = (await db.execute(
        select(func.count()).where(Invoice.project_id == project_id)
    )).scalar_one()
    progress_log_count = (await db.execute(
        select(func.count()).where(ProgressLog.project_id == project_id)
    )).scalar_one()
    from app.models.history import EditHistory
    history_count = (await db.execute(
        select(func.count()).where(EditHistory.project_id == project_id)
    )).scalar_one()
    estimate_count = (await db.execute(
        select(func.count(QuoteVersion.id))
        .join(Quote, QuoteVersion.quote_id == Quote.id)
        .where(Quote.project_id == project_id)
    )).scalar_one()

    return ProjectDetail(
        id=project.id,
        project_number=project.project_number,
        project_name=project.project_name,
        client_name=project.client_name,
        client_id=project.client_id,
        client_site_id=project.client_site_id,
        original_client_name=project.original_client_name,
        project_location=project.project_location,
        status=project.status,
        order_type=project.order_type,
        contract_type=project.contract_type,
        awarding_type=project.awarding_type,
        payment_condition=project.payment_condition,
        project_summary=project.project_summary,
        prev_construction_type=project.prev_construction_type,
        prev_construction_year=project.prev_construction_year,
        prev_construction_other=project.prev_construction_other,
        client_contact_company=project.client_contact_company,
        client_contact_person=project.client_contact_person,
        client_contact_phone=project.client_contact_phone,
        sales_person_id=project.sales_person_id,
        sales_person_name=project.sales_person.full_name if project.sales_person else None,
        construction_person_id=project.construction_person_id,
        construction_person_name=project.construction_person.full_name if project.construction_person else None,
        created_by=project.created_by,
        project_price=float(project.project_price) if project.project_price is not None else None,
        period_quote_start=project.period_quote_start,
        period_quote_end=project.period_quote_end,
        period_contract_start=project.period_contract_start,
        period_contract_end=project.period_contract_end,
        period_actual_start=project.period_actual_start,
        period_actual_end=project.period_actual_end,
        created_at=project.created_at,
        updated_at=project.updated_at,
        qcds_count=qcds_count,
        quote_count=quote_count,
        order_count=order_count,
        invoice_count=invoice_count,
        progress_log_count=progress_log_count,
        counts=ProjectCounts(
            qcds=qcds_count,
            estimate=estimate_count,
            quote=quote_count,
            order=order_count,
            acknowledgment=acknowledgment_count,
            invoice=invoice_count,
            progress=progress_log_count,
            history=history_count,
        ),
    )


@router.patch("/{project_id}", response_model=ProjectDetail)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectDetail:
    """案件を更新する。権限: 管理者 or 作成者本人。"""
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.sales_person),
            selectinload(Project.construction_person),
        )
        .where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    if body.project_number is not None and body.project_number != project.project_number:
        dup = (await db.execute(
            select(Project).where(Project.project_number == body.project_number)
        )).scalar_one_or_none()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"工事番号 {body.project_number} は既に使用されています",
            )

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project, ["sales_person", "construction_person"])

    logger.info("project_updated", project_id=str(project_id), user_id=str(current_user.id))
    return await get_project(project_id=project_id, db=db, current_user=current_user)


@router.post("/{project_id}/status", response_model=ProjectDetail)
async def change_status(
    project_id: uuid.UUID,
    body: StatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectDetail:
    """案件ステータスを変更し、編集履歴に記録する。"""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="変更権限がありません")

    old_status = project.status
    if old_status == body.status:
        return await get_project(project_id=project_id, db=db, current_user=current_user)

    project.status = body.status
    await record_history(
        db,
        entity_type="project",
        entity_id=project_id,
        project_id=project_id,
        changed_by=current_user.id,
        change_type=EditHistoryChangeType.update,
        field_changes={"status": {"before": old_status.value, "after": body.status.value}},
    )
    await db.commit()

    logger.info(
        "status_changed",
        project_id=str(project_id),
        old=old_status.value,
        new=body.status.value,
        user_id=str(current_user.id),
    )

    try:
        from app.models.company_settings import CompanySettings
        from app.services.notification import notify_status_changed
        settings = await db.scalar(select(CompanySettings).where(CompanySettings.id == "default"))
        if settings and settings.slack_webhook_url and getattr(settings, "slack_notify_status_change", True):
            await notify_status_changed(
                webhook_url=settings.slack_webhook_url,
                project_number=project.project_number,
                project_name=project.project_name,
                new_status=body.status.value,
                changed_by=current_user.full_name or current_user.email,
            )
    except Exception:
        pass

    return await get_project(project_id=project_id, db=db, current_user=current_user)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """案件を論理削除する（deleted_at を設定）。管理者または作成者のみ可。"""
    project = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="削除権限がありません")
    project.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("project_deleted", project_id=str(project_id), user_id=str(current_user.id))


@router.get("/{project_id}/history", response_model=EditHistoryResponse)
async def get_history(
    project_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EditHistoryResponse:
    """案件の編集履歴を返す（新しい順）。"""
    from app.models.history import EditHistory
    from sqlalchemy.orm import selectinload as _sel

    exists = (await db.execute(
        select(Project.id).where(Project.id == project_id, Project.deleted_at.is_(None))
    )).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    total = (await db.execute(
        select(func.count()).where(EditHistory.project_id == project_id)
    )).scalar_one()

    rows = (await db.execute(
        select(EditHistory)
        .options(_sel(EditHistory.changer))
        .where(EditHistory.project_id == project_id)
        .order_by(EditHistory.changed_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )).scalars().all()

    items = [
        EditHistoryItem(
            id=h.id,
            entity_type=h.entity_type,
            change_type=h.change_type.value,
            field_changes=h.field_changes,
            changed_by_name=h.changer.full_name,
            changed_at=h.changed_at,
        )
        for h in rows
    ]
    return EditHistoryResponse(items=items, total=total)
