"""パスワードハッシュ化 と JWT トークン生成・検証。"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

_ph = PasswordHasher()

ALGORITHM = "HS256"


# ---------- password ----------

def hash_password(plain: str) -> str:
    """Argon2id でパスワードをハッシュ化する。"""
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """パスワードを検証する。不一致の場合は False を返す。"""
    try:
        return _ph.verify(hashed, plain)
    except VerifyMismatchError:
        return False


# ---------- JWT ----------

def _make_token(sub: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(user_id: uuid.UUID) -> str:
    """アクセストークン（15分）を生成する。"""
    return _make_token(
        str(user_id),
        "access",
        timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    """リフレッシュトークン（7日）を生成する。"""
    return _make_token(
        str(user_id),
        "refresh",
        timedelta(days=settings.jwt_refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: str) -> str:
    """トークンを検証し、user_id（sub）を返す。

    不正・期限切れの場合は jwt.InvalidTokenError を送出する。
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("token type mismatch")
    sub: str = payload["sub"]
    return sub
