"""スケジュール管理 API。

モジュール構造: app.modules.schedule.schedule_router
実体: app.api.v1.schedule（現在は re-export）
"""
from app.api.v1.schedule import router  # noqa: F401

__all__ = ["router"]
