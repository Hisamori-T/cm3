"""日報 API — re-export。実体: app.api.v1.daily_reports"""
from app.api.v1.daily_reports import router  # noqa: F401
__all__ = ["router"]
