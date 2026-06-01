"""案件（Project）エンドポイント — 後方互換 re-export。

実体は app.modules.project.router に移動済み。
既存コードは from app.api.v1.projects import router で動作する。
"""
from app.modules.project.router import router  # noqa: F401

__all__ = ["router"]
