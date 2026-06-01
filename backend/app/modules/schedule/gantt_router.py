"""ガントチャート工程表 API。

モジュール構造: app.modules.schedule.gantt_router
実体: app.api.v1.gantt（Phase 4 で移動予定、現在は re-export）
"""
from app.api.v1.gantt import router  # noqa: F401

__all__ = ["router"]
