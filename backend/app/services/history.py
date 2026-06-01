"""編集履歴記録サービス。エンドポイントから呼び出す共通ヘルパー。

後方互換 re-export: 新しいパスは app.shared.services.history
既存コードはそのまま from app.services.history import record で動作する。
"""
from app.shared.services.history import record  # noqa: F401

__all__ = ["record"]
