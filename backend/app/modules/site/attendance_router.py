"""出面台帳 API — re-export。実体: app.api.v1.attendance"""
from app.api.v1.attendance import router  # noqa: F401
__all__ = ["router"]
