"""見積書サービス — 後方互換のため shared から re-export。"""
from app.shared.services.quote_init import create_initial_quote

__all__ = ["create_initial_quote"]
