"""権限チェックヘルパー。複数ロール対応。"""
from fastapi import HTTPException, status

from app.models.enums import UserRole


def has_role(user, *required_roles: UserRole) -> bool:
    """ユーザーが指定ロールのうち少なくとも1つを保有するか確認。

    user.roles（配列）を優先し、なければ user.role（単体）で確認。
    """
    user_roles: set[str] = set()
    if hasattr(user, "roles") and user.roles:
        user_roles = {str(r) for r in user.roles}
    elif hasattr(user, "role") and user.role:
        user_roles = {str(user.role)}

    return any(str(r) in user_roles for r in required_roles)


def require_roles(user, *required_roles: UserRole) -> None:
    """指定ロールを1つも持たない場合 403 を送出。"""
    if not has_role(user, *required_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この操作には権限がありません",
        )


def is_admin(user) -> bool:
    """管理者権限を持つか確認。"""
    return has_role(user, UserRole.admin, UserRole.super_admin)


def is_manager_or_above(user) -> bool:
    """上長以上の権限を持つか確認。"""
    return has_role(user, UserRole.manager, UserRole.admin, UserRole.super_admin)


def is_accounting_or_above(user) -> bool:
    """経理以上の権限を持つか確認。"""
    return has_role(
        user,
        UserRole.accounting,
        UserRole.manager,
        UserRole.admin,
        UserRole.super_admin,
    )


def can_edit_project(user, project) -> bool:
    """案件を編集できるか確認（admin または作成者）。"""
    return is_admin(user) or (
        hasattr(project, "created_by") and project.created_by == user.id
    )
