"""編集履歴モデル。全エンティティの変更を自動記録。

後方互換 re-export: 新しいパスは app.shared.models.history
既存コードはそのまま from app.models.history import EditHistory で動作する。
"""
from app.shared.models.history import EditHistory  # noqa: F401

__all__ = ["EditHistory"]
