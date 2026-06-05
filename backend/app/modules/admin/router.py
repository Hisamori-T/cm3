"""管理者向けエンドポイント（ユーザー管理・印紙税テーブル・見積条件テンプレート・企業情報）。"""
from __future__ import annotations

import uuid
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password
from app.models.company_settings import CompanySettings
from app.models.master import QuoteConditionTemplate, StampTaxTable
from app.models.user import User
from app.schemas.master import (
    QuoteConditionTemplateCreate,
    QuoteConditionTemplateRead,
    QuoteConditionTemplateUpdate,
    StampTaxCreate,
    StampTaxRead,
    StampTaxUpdate,
)
from app.schemas.user import UserCreate, UserRead, UserUpdate


class CompanySettingsRead(BaseModel):
    id: str
    company_name: str
    company_name_en: Optional[str] = None
    postal_code: Optional[str] = None
    address: Optional[str] = None
    tel: Optional[str] = None
    fax: Optional[str] = None
    representative_name: Optional[str] = None
    tax_registration_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_type: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_holder: Optional[str] = None
    seal_text: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_name_en: Optional[str] = None
    postal_code: Optional[str] = None
    address: Optional[str] = None
    tel: Optional[str] = None
    fax: Optional[str] = None
    representative_name: Optional[str] = None
    tax_registration_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_type: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_holder: Optional[str] = None
    seal_text: Optional[str] = None
    notes: Optional[str] = None

router = APIRouter(tags=["admin"])
logger = structlog.get_logger(__name__)


def _require_admin(current_user: User) -> User:
    """admin または super_admin のみ通過（複数ロール対応）。"""
    from app.shared.services.permissions import is_admin
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者権限が必要です")
    return current_user


def _require_super_admin(current_user: User) -> User:
    """super_admin のみ通過（複数ロール対応）。"""
    from app.shared.services.permissions import has_role
    from app.models.enums import UserRole
    if not has_role(current_user, UserRole.super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="システム管理者権限が必要です")
    return current_user


# ── 印紙税テーブル ─────────────────────────────────────────────────────────────

@router.get("/admin/stamp-tax", response_model=list[StampTaxRead])
async def list_stamp_tax(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StampTaxRead]:
    """印紙税テーブルを一覧返す。"""
    rows = (await db.execute(
        select(StampTaxTable).order_by(StampTaxTable.effective_from.desc(), StampTaxTable.min_amount)
    )).scalars().all()
    return [StampTaxRead(
        id=r.id, min_amount=float(r.min_amount),
        max_amount=float(r.max_amount) if r.max_amount is not None else None,
        tax_amount=float(r.tax_amount), effective_from=r.effective_from,
    ) for r in rows]


@router.post("/admin/stamp-tax", response_model=StampTaxRead, status_code=status.HTTP_201_CREATED)
async def create_stamp_tax(
    body: StampTaxCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StampTaxRead:
    """印紙税エントリを作成する。管理者専用。"""
    _require_admin(current_user)
    row = StampTaxTable(
        min_amount=body.min_amount, max_amount=body.max_amount,
        tax_amount=body.tax_amount, effective_from=body.effective_from,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return StampTaxRead(
        id=row.id, min_amount=float(row.min_amount),
        max_amount=float(row.max_amount) if row.max_amount is not None else None,
        tax_amount=float(row.tax_amount), effective_from=row.effective_from,
    )


@router.patch("/admin/stamp-tax/{entry_id}", response_model=StampTaxRead)
async def update_stamp_tax(
    entry_id: uuid.UUID,
    body: StampTaxUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StampTaxRead:
    """印紙税エントリを更新する。管理者専用。"""
    _require_admin(current_user)
    row = (await db.execute(
        select(StampTaxTable).where(StampTaxTable.id == entry_id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="エントリが見つかりません")
    for field in ("min_amount", "max_amount", "tax_amount", "effective_from"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(row, field, val)
    await db.commit()
    await db.refresh(row)
    return StampTaxRead(
        id=row.id, min_amount=float(row.min_amount),
        max_amount=float(row.max_amount) if row.max_amount is not None else None,
        tax_amount=float(row.tax_amount), effective_from=row.effective_from,
    )


@router.delete("/admin/stamp-tax/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stamp_tax(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """印紙税エントリを削除する。管理者専用。"""
    _require_admin(current_user)
    row = (await db.execute(
        select(StampTaxTable).where(StampTaxTable.id == entry_id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="エントリが見つかりません")
    await db.delete(row)
    await db.commit()


# ── 見積条件テンプレート ───────────────────────────────────────────────────────

@router.get("/admin/quote-conditions", response_model=list[QuoteConditionTemplateRead])
async def list_quote_conditions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuoteConditionTemplateRead]:
    """見積条件テンプレート一覧を返す。"""
    rows = (await db.execute(
        select(QuoteConditionTemplate).order_by(QuoteConditionTemplate.created_at)
    )).scalars().all()
    return [QuoteConditionTemplateRead(
        id=r.id, name=r.name, content=r.content, is_active=r.is_active, created_at=r.created_at
    ) for r in rows]


@router.post("/admin/quote-conditions", response_model=QuoteConditionTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_quote_condition(
    body: QuoteConditionTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteConditionTemplateRead:
    """見積条件テンプレートを作成する。管理者専用。"""
    _require_admin(current_user)
    row = QuoteConditionTemplate(name=body.name, content=body.content, is_active=body.is_active)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return QuoteConditionTemplateRead(
        id=row.id, name=row.name, content=row.content, is_active=row.is_active, created_at=row.created_at
    )


@router.patch("/admin/quote-conditions/{template_id}", response_model=QuoteConditionTemplateRead)
async def update_quote_condition(
    template_id: uuid.UUID,
    body: QuoteConditionTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteConditionTemplateRead:
    """見積条件テンプレートを更新する。管理者専用。"""
    _require_admin(current_user)
    row = (await db.execute(
        select(QuoteConditionTemplate).where(QuoteConditionTemplate.id == template_id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="テンプレートが見つかりません")
    for field in ("name", "content", "is_active"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(row, field, val)
    await db.commit()
    await db.refresh(row)
    return QuoteConditionTemplateRead(
        id=row.id, name=row.name, content=row.content, is_active=row.is_active, created_at=row.created_at
    )


@router.delete("/admin/quote-conditions/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quote_condition(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """見積条件テンプレートを削除する。管理者専用。"""
    _require_admin(current_user)
    row = (await db.execute(
        select(QuoteConditionTemplate).where(QuoteConditionTemplate.id == template_id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="テンプレートが見つかりません")
    await db.delete(row)
    await db.commit()


# ── ユーザー管理 ───────────────────────────────────────────────────────────────

@router.get("/admin/users", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserRead]:
    """全ユーザー一覧を返す。管理者専用。"""
    _require_admin(current_user)
    users = (await db.execute(select(User).order_by(User.employee_number))).scalars().all()
    return [UserRead.model_validate(u) for u in users]


@router.post("/admin/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """ユーザーを作成する。管理者専用。super_admin ロールの付与は super_admin のみ可。"""
    _require_admin(current_user)
    from app.models.enums import UserRole as _Role
    from app.shared.services.permissions import has_role
    # roles に super_admin が含まれる場合は super_admin のみ可
    effective_roles = body.roles if body.roles else [body.role]
    if _Role.super_admin in effective_roles and not has_role(current_user, _Role.super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="super_admin ロールの付与にはシステム管理者権限が必要です")
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="このメールアドレスは既に使用されています")
    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        employee_number=body.employee_number,
        role=body.role,
        roles=effective_roles,
        department=body.department,
        phone=getattr(body, "phone", None),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.patch("/admin/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """ユーザー情報を更新する。管理者専用。super_admin ロールの付与は super_admin のみ可。"""
    _require_admin(current_user)
    from app.models.enums import UserRole as _Role
    from app.shared.services.permissions import has_role
    # super_admin ロールの付与チェック
    if body.role == _Role.super_admin and not has_role(current_user, _Role.super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="super_admin ロールの付与にはシステム管理者権限が必要です")
    if body.roles and _Role.super_admin in body.roles and not has_role(current_user, _Role.super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="super_admin ロールの付与にはシステム管理者権限が必要です")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")
    if body.email is not None:
        dup = (await db.execute(
            select(User).where(User.email == body.email, User.id != user_id)
        )).scalar_one_or_none()
        if dup:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="このメールアドレスは既に使用されています")
        user.email = body.email
    for field in ("full_name", "employee_number", "role", "department", "phone", "is_active", "stamp_text", "stamp_style"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(user, field, val)
    if body.roles is not None:
        user.roles = body.roles
    if body.password:
        user.hashed_password = hash_password(body.password)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


# ── 企業情報設定 ────────────────────────────────────────────────────────────────

@router.get("/admin/company-settings", response_model=CompanySettingsRead)
async def get_company_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanySettingsRead:
    """自社企業情報を取得する（全認証ユーザー参照可）。"""
    row = (await db.execute(select(CompanySettings).where(CompanySettings.id == "default"))).scalar_one_or_none()
    if row is None:
        row = CompanySettings(id="default")
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return CompanySettingsRead.model_validate(row)


@router.patch("/admin/company-settings", response_model=CompanySettingsRead)
async def update_company_settings(
    body: CompanySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanySettingsRead:
    """自社企業情報を更新する（admin/super_admin のみ）。"""
    _require_admin(current_user)
    row = (await db.execute(select(CompanySettings).where(CompanySettings.id == "default"))).scalar_one_or_none()
    if row is None:
        row = CompanySettings(id="default")
        db.add(row)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(row, field, val)
    await db.commit()
    await db.refresh(row)
    logger.info("company_settings_updated", user_id=str(current_user.id))
    return CompanySettingsRead.model_validate(row)


# ── 承認ルート設定 ─────────────────────────────────────────────────────────────

@router.get("/admin/approval-route")
async def get_approval_route(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """承認ルート設定を返す。"""
    _require_admin(current_user)
    row = (await db.execute(select(CompanySettings).where(CompanySettings.id == "default"))).scalar_one_or_none()
    default_steps = [
        {"step": 1, "label": "担当", "required_roles": ["staff", "member", "accounting", "manager", "admin", "super_admin"]},
        {"step": 2, "label": "確認", "required_roles": ["manager", "admin", "super_admin"]},
        {"step": 3, "label": "承認", "required_roles": ["admin", "super_admin"]},
    ]
    if row is None or not hasattr(row, "approval_route_config") or not row.approval_route_config:
        return {"quote_approval_steps": default_steps}
    return row.approval_route_config


@router.patch("/admin/approval-route")
async def update_approval_route(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """承認ルート設定を更新する。"""
    _require_admin(current_user)
    row = (await db.execute(select(CompanySettings).where(CompanySettings.id == "default"))).scalar_one_or_none()
    if row is None:
        row = CompanySettings(id="default")
        db.add(row)
    row.approval_route_config = body  # type: ignore[attr-defined]
    await db.commit()
    return body


# ── 基本契約約款 ──────────────────────────────────────────────────────────────

from sqlalchemy import text as sa_text  # noqa: E402

@router.get("/admin/clauses")
async def list_clauses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    """基本契約約款一覧を返す。"""
    _require_admin(current_user)
    result = await db.execute(sa_text("SELECT id, clause_no, title, content, is_active FROM contract_clauses ORDER BY clause_no"))
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


@router.patch("/admin/clauses/{clause_id}")
async def update_clause(
    clause_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """基本契約約款を更新する。"""
    _require_admin(current_user)
    allowed = {k: v for k, v in body.items() if k in ("title", "content", "is_active")}
    if not allowed:
        return {}
    sets = ", ".join(f"{k} = :{k}" for k in allowed)
    await db.execute(sa_text(f"UPDATE contract_clauses SET {sets}, updated_at = now() WHERE id = :id"), {**allowed, "id": str(clause_id)})
    await db.commit()
    result = await db.execute(sa_text("SELECT id, clause_no, title, content, is_active FROM contract_clauses WHERE id = :id"), {"id": str(clause_id)})
    return dict(result.fetchone()._mapping)


# ── QCDSテンプレート ──────────────────────────────────────────────────────────

@router.get("/admin/qcds-templates")
async def list_qcds_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    """QCDSテンプレート一覧を返す。"""
    result = await db.execute(sa_text("SELECT * FROM qcds_templates WHERE is_active = true ORDER BY created_at"))
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/admin/qcds-templates", status_code=201)
async def create_qcds_template(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """QCDSテンプレートを作成する。"""
    _require_admin(current_user)
    fields = ["name", "description", "labor_insurance_rate", "construction_insurance_rate",
              "office_supplies", "communication_cost", "misc_cost",
              "site_staff_salary_rate", "shared_overhead_rate", "general_admin_rate",
              "target_operating_profit_rate"]
    safe = {k: v for k, v in body.items() if k in fields and v is not None}
    if "name" not in safe:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="name は必須です")
    cols = ", ".join(safe.keys())
    vals = ", ".join(f":{k}" for k in safe)
    result = await db.execute(sa_text(f"INSERT INTO qcds_templates ({cols}) VALUES ({vals}) RETURNING *"), safe)
    await db.commit()
    return dict(result.fetchone()._mapping)


@router.patch("/admin/qcds-templates/{template_id}")
async def update_qcds_template(
    template_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """QCDSテンプレートを更新する。"""
    _require_admin(current_user)
    fields = ["name", "description", "labor_insurance_rate", "construction_insurance_rate",
              "office_supplies", "communication_cost", "misc_cost",
              "site_staff_salary_rate", "shared_overhead_rate", "general_admin_rate",
              "target_operating_profit_rate", "is_active"]
    safe = {k: v for k, v in body.items() if k in fields and v is not None}
    if not safe:
        return {}
    sets = ", ".join(f"{k} = :{k}" for k in safe)
    result = await db.execute(
        sa_text(f"UPDATE qcds_templates SET {sets}, updated_at = now() WHERE id = :id RETURNING *"),
        {**safe, "id": str(template_id)}
    )
    await db.commit()
    return dict(result.fetchone()._mapping)
