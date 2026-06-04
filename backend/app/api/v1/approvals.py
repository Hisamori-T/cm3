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

# role_label → Quote フィールドのマッピング
_ROLE_TO_STAMP: dict[str, tuple[str, str]] = {
    "担当": ("person_in_charge_id", "person_in_charge_confirmed_at"),
    "確認": ("reviewer_id", "reviewed_at"),
    "審査": ("reviewer_id", "reviewed_at"),
    "承認": ("approver_id", "approved_at"),
}

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
    project_id: uuid.UUID | None = None
    quote_number: str | None = None
    project_name: str | None = None
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


def _req_read(r: ApprovalRequest, quote: "Quote | None" = None) -> ApprovalRequestRead:
    return ApprovalRequestRead(
        id=r.id,
        quote_id=r.quote_id,
        project_id=quote.project_id if quote else None,
        quote_number=quote.quote_number if quote else None,
        project_name=quote.project_name_snapshot if quote else None,
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
    quote = (await db.execute(select(Quote).where(Quote.id == quote_id))).scalar_one_or_none()
    return [_req_read(r, quote) for r in rows]


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

    # 既存スタンプマップ（role_label → (stamped_user_id, stamped_at)）
    _existing_stamps = {
        "担当": (str(quote.person_in_charge_id) if quote.person_in_charge_id else None, quote.person_in_charge_confirmed_at),
        "確認": (str(quote.reviewer_id) if quote.reviewer_id else None, quote.reviewed_at),
        "審査": (str(quote.reviewer_id) if quote.reviewer_id else None, quote.reviewed_at),
        "承認": (str(quote.approver_id) if quote.approver_id else None, quote.approved_at),
    } if quote else {}

    now = datetime.now(timezone.utc)
    for idx, step_in in enumerate(body.steps, start=1):
        # step1 が依頼者自身、または既にスタンプ済みの同一ユーザーなら自動承認
        is_self_step1 = idx == 1 and str(step_in.approver_id) == str(current_user.id)
        ex_user, ex_at = _existing_stamps.get(step_in.role_label, (None, None))
        already_stamped = (ex_user is not None and str(step_in.approver_id) == ex_user and ex_at is not None)
        auto_approve = is_self_step1 or already_stamped
        step = ApprovalStep(
            request_id=req.id,
            step_no=idx,
            approver_id=step_in.approver_id,
            role_label=step_in.role_label,
            required=step_in.required,
            status="approved" if auto_approve else "pending",
            decided_at=now if auto_approve else None,
        )
        db.add(step)

    # 通知先を決定（自動承認された全ステップをスキップして最初の pending に通知）
    if body.steps:
        first_pending_idx = None
        for i, step_in in enumerate(body.steps):
            is_s1_self = i == 0 and str(step_in.approver_id) == str(current_user.id)
            ex_u, ex_a = _existing_stamps.get(step_in.role_label, (None, None))
            _already = ex_u is not None and str(step_in.approver_id) == ex_u and ex_a is not None
            if not (is_s1_self or _already):
                first_pending_idx = i
                break
        if first_pending_idx is not None:
            notify_target = body.steps[first_pending_idx]
            await _create_notification(
                db, notify_target.approver_id,
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
    return _req_read(loaded, quote)


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

    # 承認時: Quote のスタンプフィールドを同期
    if body.action == "approve":
        quote = (await db.execute(select(Quote).where(Quote.id == req.quote_id))).scalar_one_or_none()
        if quote and my_step.role_label in _ROLE_TO_STAMP:
            id_field, at_field = _ROLE_TO_STAMP[my_step.role_label]
            setattr(quote, id_field, current_user.id)
            setattr(quote, at_field, now)

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
    q = (await db.execute(select(Quote).where(Quote.id == req.quote_id))).scalar_one_or_none()
    return _req_read(req, q)


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
    q = (await db.execute(select(Quote).where(Quote.id == req.quote_id))).scalar_one_or_none()
    return _req_read(req, q)


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
    """自分が関わる承認依頼サマリー（要承認・依頼中・差戻し・完了）。"""
    opts = [
        selectinload(ApprovalRequest.requester),
        selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver),
    ]

    # 自分が承認者として pending のステップ
    pending_steps = (await db.execute(
        select(ApprovalStep)
        .where(ApprovalStep.approver_id == current_user.id, ApprovalStep.status == "pending")
        .options(
            selectinload(ApprovalStep.request).selectinload(ApprovalRequest.requester),
            selectinload(ApprovalStep.request).selectinload(ApprovalRequest.steps).selectinload(ApprovalStep.approver),
        )
    )).scalars().all()

    # 自分が依頼した全ステータス（withdrawn 除く）
    my_requests = (await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.requester_id == current_user.id,
               ApprovalRequest.status.in_(["pending", "rejected", "approved"]))
        .options(*opts)
        .order_by(ApprovalRequest.created_at.desc())
    )).scalars().all()

    # 全 quote_id を収集して一括ロード
    all_reqs = [s.request for s in pending_steps] + my_requests
    quote_ids = list({r.quote_id for r in all_reqs})
    quotes_rows = (await db.execute(select(Quote).where(Quote.id.in_(quote_ids)))).scalars().all()
    quote_map = {q.id: q for q in quotes_rows}

    def read(r: ApprovalRequest) -> ApprovalRequestRead:
        return _req_read(r, quote_map.get(r.quote_id))

    pending_requests = [r for r in my_requests if r.status == "pending"]
    rejected_requests = [r for r in my_requests if r.status == "rejected"]
    completed_requests = [r for r in my_requests if r.status == "approved"]

    # awaiting からは withdrawn 済み依頼を除外
    awaiting_req_ids = {s.request.id for s in pending_steps}
    awaiting_reqs = [s.request for s in pending_steps if s.request.status == "pending"]

    return {
        "awaiting_my_approval": [read(r) for r in awaiting_reqs],
        "requested_by_me": [read(r) for r in pending_requests],
        "rejected": [read(r) for r in rejected_requests],
        "completed": [read(r) for r in completed_requests],
    }
