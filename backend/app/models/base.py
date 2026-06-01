"""全モデル共通の Mixin クラス。

後方互換 re-export: 新しいパスは app.shared.models.base
既存コードはそのまま from app.models.base import TimestampMixin で動作する。
"""
from app.shared.models.base import TimestampMixin  # noqa: F401

__all__ = ["TimestampMixin"]
