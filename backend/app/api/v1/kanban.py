"""カンバン API — 後方互換 re-export。

実体は app.modules.project.kanban_router に移動済み。
"""
from app.modules.project.kanban_router import router  # noqa: F401

__all__ = ["router"]
