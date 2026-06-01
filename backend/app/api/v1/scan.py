"""業者見積スキャン API — 後方互換 re-export。

実体は app.modules.purchase.routers.{scan_upload, scan_review, scan_transfer} に分割済み。
main.py は引き続き from app.api.v1.scan import router で動作する。

3つのルーターを1つに統合して返す。
"""
from fastapi import APIRouter

from app.modules.purchase.routers.scan_upload import router as _upload_router
from app.modules.purchase.routers.scan_review import router as _review_router
from app.modules.purchase.routers.scan_transfer import router as _transfer_router

# 3ルーターを1つに集約（main.py の include_router 呼び出し元を変えずに済む）
router = APIRouter(tags=["scan"])
router.include_router(_upload_router)
router.include_router(_review_router)
router.include_router(_transfer_router)

__all__ = ["router"]
