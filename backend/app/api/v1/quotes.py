"""見積書エンドポイント — re-export shim。

実装は modules/estimate/routers/ に移動済み。
既存コードが `from app.api.v1.quotes import router` でインポートしている場合も引き続き動作する。
"""
from __future__ import annotations

from fastapi import APIRouter

from app.modules.estimate.routers.quote_core import router as _core_router
from app.modules.estimate.routers.quote_versions import router as _versions_router
from app.modules.estimate.routers.quote_sections import router as _sections_router

router = APIRouter(tags=["quotes"])
router.include_router(_core_router)
router.include_router(_versions_router)
router.include_router(_sections_router)

__all__ = ["router"]
