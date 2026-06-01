"""ヘルスチェックエンドポイント。"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス。"""

    status: str
    version: str = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """サービスの稼働状態を返す。監視ツール用エンドポイント。"""
    return HealthResponse(status="ok")
