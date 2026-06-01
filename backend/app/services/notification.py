"""Slack Webhook 通知サービス。"""
from __future__ import annotations

import httpx
import structlog

logger = structlog.get_logger()

_STATUS_LABEL = {
    "quote":       "見積中",
    "ordered":     "受注",
    "started":     "着工",
    "in_progress": "施工中",
    "completed":   "完工",
    "billed":      "請求済",
    "paid":        "入金済",
}

_STATUS_COLOR = {
    "quote":       "#94a3b8",
    "ordered":     "#3b82f6",
    "started":     "#f59e0b",
    "in_progress": "#10b981",
    "completed":   "#6366f1",
    "billed":      "#f97316",
    "paid":        "#22c55e",
}


async def _post(webhook_url: str, payload: dict) -> None:
    """Slack Webhook に非同期 POST する。エラーはログのみ（通知失敗でも業務処理は止めない）。"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(webhook_url, json=payload)
            if r.status_code != 200:
                logger.warning("slack_webhook_failed", status=r.status_code, body=r.text[:200])
    except Exception as e:
        logger.warning("slack_webhook_error", error=str(e))


async def notify_status_changed(
    webhook_url: str | None,
    project_number: str,
    project_name: str,
    new_status: str,
    changed_by: str,
) -> None:
    """案件ステータス変更を Slack に通知する。"""
    if not webhook_url:
        return
    label = _STATUS_LABEL.get(new_status, new_status)
    color = _STATUS_COLOR.get(new_status, "#94a3b8")
    payload = {
        "attachments": [
            {
                "color": color,
                "fallback": f"[{project_number}] ステータスが「{label}」に変更されました",
                "title": ":construction: 案件ステータスが更新されました",
                "fields": [
                    {"title": "案件番号", "value": project_number, "short": True},
                    {"title": "工事名",   "value": project_name,   "short": True},
                    {"title": "新ステータス", "value": label,       "short": True},
                    {"title": "更新者",   "value": changed_by,     "short": True},
                ],
            }
        ]
    }
    await _post(webhook_url, payload)


async def notify_payment_overdue(
    webhook_url: str | None,
    project_number: str,
    project_name: str,
    invoice_number: str | None,
    total_amount: float,
    days_overdue: int,
) -> None:
    """入金期限超過を Slack に通知する（ダッシュボードAPIから呼び出し可能）。"""
    if not webhook_url:
        return
    payload = {
        "attachments": [
            {
                "color": "#ef4444",
                "fallback": f"[{project_number}] 入金期限超過 {days_overdue}日",
                "title": ":warning: 入金期限超過アラート",
                "fields": [
                    {"title": "案件番号",   "value": project_number,                          "short": True},
                    {"title": "工事名",     "value": project_name,                            "short": True},
                    {"title": "請求番号",   "value": invoice_number or "—",                   "short": True},
                    {"title": "請求額",     "value": f"¥{int(total_amount):,}",               "short": True},
                    {"title": "超過日数",   "value": f"{days_overdue}日",                     "short": True},
                ],
            }
        ]
    }
    await _post(webhook_url, payload)
