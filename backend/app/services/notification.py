"""Slack Webhook 通知サービス。

後方互換 re-export: 新しいパスは app.shared.services.notification
既存コードはそのまま from app.services.notification import notify_status_changed で動作する。
"""
from app.shared.services.notification import (  # noqa: F401
    notify_payment_overdue,
    notify_status_changed,
)

__all__ = ["notify_status_changed", "notify_payment_overdue"]
