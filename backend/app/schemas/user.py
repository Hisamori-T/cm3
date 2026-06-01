"""ユーザー関連の Pydantic スキーマ。"""
import uuid

from pydantic import BaseModel, EmailStr

from app.models.enums import UserRole


class UserRead(BaseModel):
    """ユーザー情報のレスポンス用スキーマ（パスワード除外）。"""

    id: uuid.UUID
    email: EmailStr
    full_name: str
    employee_number: int | None
    role: UserRole
    department: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    """ユーザー作成リクエスト。管理者専用。"""

    email: EmailStr
    full_name: str
    password: str
    employee_number: int | None = None
    role: UserRole = UserRole.staff
    department: str | None = None


class UserUpdate(BaseModel):
    """ユーザー更新リクエスト。管理者専用。"""

    email: EmailStr | None = None
    full_name: str | None = None
    employee_number: int | None = None
    role: UserRole | None = None
    department: str | None = None
    is_active: bool | None = None
    password: str | None = None


class UserSelfUpdate(BaseModel):
    """自分自身のプロフィール更新スキーマ。"""

    full_name: str | None = None
    department: str | None = None
    current_password: str | None = None  # パスワード変更時に必要
    new_password: str | None = None
