"""認証エンドポイント: login / refresh / logout / me。"""
import jwt
import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserRead, UserSelfUpdate

router = APIRouter(prefix="/auth", tags=["auth"])
logger = structlog.get_logger(__name__)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """メールアドレスとパスワードで認証し、JWT トークンを返す。"""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        logger.warning("login_failed", email=body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="アカウントが無効です",
        )

    logger.info("login_success", user_id=str(user.id), email=user.email)
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """リフレッシュトークンを使って新しいアクセストークンを発行する。"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="リフレッシュトークンが無効です",
    )
    try:
        import uuid
        user_id_str = decode_token(body.refresh_token, "refresh")
        user_id = uuid.UUID(user_id_str)
    except (jwt.InvalidTokenError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: User = Depends(get_current_user)) -> None:
    """ログアウト（クライアント側でトークンを破棄する）。"""
    logger.info("logout", user_id=str(current_user.id))


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    """ログイン中のユーザー情報を返す。"""
    return UserRead.model_validate(current_user)


@router.get("/users", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserRead]:
    """全認証済みユーザーが参照可能なユーザー一覧（押印選択用）。"""
    rows = (
        await db.execute(select(User).where(User.is_active == True).order_by(User.full_name))
    ).scalars().all()
    return [UserRead.model_validate(u) for u in rows]


@router.patch("/me", response_model=UserRead)
async def update_me(
    body: UserSelfUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """自分自身のプロフィールを更新する。"""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.department is not None:
        current_user.department = body.department or None
    if body.new_password:
        if not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="パスワード変更には現在のパスワードが必要です",
            )
        if not verify_password(body.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="現在のパスワードが正しくありません",
            )
        current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    await db.refresh(current_user)
    logger.info("profile_updated", user_id=str(current_user.id))
    return UserRead.model_validate(current_user)
