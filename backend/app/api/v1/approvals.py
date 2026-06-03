"""承認ワークフロー API。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.approval import ApprovalRequest, ApprovalStep, Notification
from app.models.quote import Quote
from app.models.user import User

router = APIRouter(tags=["approvals"])


# ── スキーマ ──────────────────────────────────────────────────────────────────

class ApprovalStepInput(BaseModel):
    approver_id: uuid.UUID
    role_label: str
    required: bool = True


class ApprovalRequestCreate(BaseModel):
    steps: list[ApprovalStepInput]
    request_comment: str | None = None


class ApprovalStepRead(BaseModel):
    id: uuid.UUID
    step_no: int
    approver_id: uuid.UUID
    approver_name: str
    role_label: str
    required: bool
    status: str
    comment: str | None
    decided_at: str | None


class ApprovalRequestRead(BaseModel):
    id: uuid.UUID
    quote_id: uuid.UUID
    requester_id: uuid.UUID
    requester_name: str
    status: str
    request_comment: str | None
    created_at: str
    steps: list[ApprovalStepRead]


class NotificationRead(BaseModel):
    id: uuid.UUID
    title: str
    body: str | None
    related_type: str | None
    related_id: uuid.UUID | None
    is_read: bool
    created_at: str


class DecideBody(BaseModel):
    action: str  # "approve" | "reject"
    comment: str | None = None


# ── ヘルパー ──────────────────────────────────────────────────────────────────

def _step_read(s: ApprovalStep) -> ApprovalStepRead:
    return ApprovalStepRead(
        id=s.id,
        step_no=s.step_no,
        approver_id=s.approver_id,
        approver_name=s.approver.full_name if s.approver else "",
        role_label=s.role_label,
        required=s.required,
        status=s.status,
        comment=s.comment,
        decided_at=s.decided_at.isoformat() if s.decided_at else None,
    )


def _req_read(r: ApprovalRequest) -> ApprovalRequestRead:
    return ApprovalRequestRead(
        id=r.id,
        quote_id=r.quote_id,
        requester_id=r.requester_id,
        requester_name=r.requester.full_name if r.requester else "",
        status=r.status,
        request_comment=r.request_comment,
        created_at=r.created_at.isoformat(),
        steps=[_step_read(s) for s in r.steps],
    )


async def _create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str | None,
    related_type: str,
    related_id: uuid.UUID,
) -> None:
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        related_type=related_type,
        related_id=related_id,
    )
    db.add(notif)


# ── エンドポイント ─────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/quotes/{quote_id}/approval-requests", response_model=list[ApprovalRequestRead])
async def list_approval_requests(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ApprovalRequestRead]:
    """見積書の承認依頼一覧。"""
    rows = (await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.quote_id == quote_id)
        .options(selectinload(ApprovalRequest.requester), selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver))
        .order_by(ApprovalRequest.created_at.desc())
    )).scalars().all()
    return [_req_read(r) for r in rows]


@router.post("/projects/{project_id}/quotes/{quote_id}/approval-requests", response_model=ApprovalRequestRead, status_code=status.HTTP_201_CREATED)
async def create_approval_request(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: ApprovalRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalRequestRead:
    """承認依頼を作成し、第1ステップの承認者に通知する。"""
    quote = (await db.execute(select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id))).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="見積書が見つかりません")

    req = ApprovalRequest(
        quote_id=quote_id,
        requester_id=current_user.id,
        status="pending",
        request_comment=body.request_comment,
    )
    db.add(req)
    await db.flush()

    for idx, step_in in enumerate(body.steps, start=1):
        step = ApprovalStep(
            request_id=req.id,
            step_no=idx,
            approver_id=step_in.approver_id,
            role_label=step_in.role_label,
            required=step_in.required,
            status="pending",
        )
        db.add(step)

    # 第1ステップの承認者に通知
    if body.steps:
        first = body.steps[0]
        await _create_notification(
            db, first.approver_id,
            title=f"【承認依頼】{quote.quote_number or '見積書'} の承認をお願いします",
            body=body.request_comment,
            related_type="approval_request",
            related_id=req.id,
        )

    await db.commit()

    loaded = (await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == req.id)
        .options(selectinload(ApprovalRequest.requester), selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver))
    )).scalar_one()
    return _req_read(loaded)


@router.post("/approval-requests/{request_id}/decide", response_model=ApprovalRequestRead)
async def decide_approval_step(
    request_id: uuid.UUID,
    body: DecideBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalRequestRead:
    """承認/差戻しを行う。"""
    req = (await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == request_id)
        .options(selectinload(ApprovalRequest.requester), selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver))
    )).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="承認依頼が見つかりません")

    # 自分が担当する pending ステップを取得
    my_step = next((s for s in req.steps if str(s.approver_id) == str(current_user.id) and s.status == "pending"), None)
    if my_step is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="あなたが担当する承認ステップが見つかりません")

    now = datetime.now(timezone.utc)
    my_step.status = "approved" if body.action == "approve" else "rejected"
    my_step.comment = body.comment
    my_step.decided_at = now

    if body.action == "reject":
        req.status = "rejected"
        # 依頼者に差戻し通知
        await _create_notification(
            db, req.requester_id,
            title=f"【差戻し】{my_step.role_label} が差し戻しました",
            body=body.comment,
            related_type="approval_request",
            related_id=req.id,
        )
    else:
        # 次のステップに通知
        next_step = next((s for s in sorted(req.steps, key=lambda x: x.step_no) if s.step_no > my_step.step_no and s.status == "pending"), None)
        if next_step:
            await _create_notification(
                db, next_step.approver_id,
                title=f"【承認依頼】{next_step.role_label} の承認をお願いします",
                body=req.request_comment,
                related_type="approval_request",
                related_id=req.id,
            )
        else:
            # 全ステップ完了
            all_done = all(s.status in ("approved", "skipped") for s in req.steps if s.required)
            if all_done:
                req.status = "approved"
                await _create_notification(
                    db, req.requester_id,
                    title="【承認完了】見積書の承認が完了しました",
                    body="全承認者が承認しました。",
                    related_type="approval_request",
                    related_id=req.id,
                )

    await db.commit()
    await db.refresh(req)
    return _req_read(req)


@router.post("/approval-requests/{request_id}/withdraw", response_model=ApprovalRequestRead)
async def withdraw_approval_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalRequestRead:
    """承認依頼を取り下げる（依頼者のみ）。"""
    req = (await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == request_id)
        .options(selectinload(ApprovalRequest.requester), selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver))
    )).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="承認依頼が見つかりません")
    if str(req.requester_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="依頼者のみ取り下げできます")
    req.status = "withdrawn"
    await db.commit()
    await db.refresh(req)
    return _req_read(req)


# ── 通知 API ──────────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationRead])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationRead]:
    """自分宛の通知一覧（新しい順、最大50件）。"""
    rows = (await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )).scalars().all()
    return [NotificationRead(
        id=n.id, title=n.title, body=n.body,
        related_type=n.related_type, related_id=n.related_id,
        is_read=n.is_read, created_at=n.created_at.isoformat()
    ) for n in rows]


@router.get("/notifications/unread-count")
async def unread_notification_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """未読通知件数。"""
    from sqlalchemy import func
    count = (await db.execute(
        select(func.count()).where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
    )).scalar_one()
    return {"count": count}


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """通知を既読にする。"""
    notif = (await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )).scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"ok": True}


@router.patch("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """全通知を既読にする。"""
    from sqlalchemy import update
    await db.execute(
        update(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


# ── 承認待ちサマリー（/approvals ページ用） ────────────────────────────────────

@router.get("/approvals/my")
async def my_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """自分が関わる承認依頼サマリー（要承認・依頼中・差戻し）。"""
    # 自分が承認者として pending のステップ
    pending_steps = (await db.execute(
        select(ApprovalStep)
        .where(ApprovalStep.approver_id == current_user.id, ApprovalStep.status == "pending")
        .options(
            selectinload(ApprovalStep.request).selectinload(ApprovalRequest.requester),
            selectinload(ApprovalStep.request).selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver),
        )
    )).scalars().all()

    # 自分が依頼した pending/rejected
    my_requests = (await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.requester_id == current_user.id, ApprovalRequest.status.in_(["pending", "rejected"]))
        .options(selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver))
        .order_by(ApprovalRequest.created_at.desc())
    )).scalars().all()

    pending_requests = [r for r in my_requests if r.status == "pending"]
    rejected_requests = [r for r in my_requests if r.status == "rejected"]

    return {
        "awaiting_my_approval": [_req_read(s.request) for s in pending_steps],
        "requested_by_me": [_req_read(r) for r in pending_requests],
        "rejected": [_req_read(r) for r in rejected_requests],
    }
