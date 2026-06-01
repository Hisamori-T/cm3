"""自社企業情報 API エンドポイント。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.company_settings import CompanySettings
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.company_settings import CompanySettingsRead, CompanySettingsUpdate

router = APIRouter(prefix="/company-settings", tags=["company-settings"])

_DEFAULT_ID = "default"


async def _get_or_create(db: AsyncSession) -> CompanySettings:
    row = await db.scalar(select(CompanySettings).where(CompanySettings.id == _DEFAULT_ID))
    if row is None:
        row = CompanySettings(id=_DEFAULT_ID)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("", response_model=CompanySettingsRead)
async def get_company_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CompanySettings:
    """自社情報を取得する（全認証済みユーザー参照可）。"""
    return await _get_or_create(db)


@router.patch("", response_model=CompanySettingsRead)
async def update_company_settings(
    body: CompanySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanySettings:
    """自社情報を更新する（admin / super_admin のみ）。"""
    if current_user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="管理者のみ変更できます")
    row = await _get_or_create(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return row
