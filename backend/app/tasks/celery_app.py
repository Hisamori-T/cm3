"""Celery アプリケーション定義。"""
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "cmv3",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.scan_tasks", "app.tasks.invoice_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Tokyo",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
)

# 定期タスクスケジュール（Celery Beat）
celery_app.conf.beat_schedule = {
    # 毎朝9時（JST）に支払期日超過チェック
    "check-overdue-invoices-daily": {
        "task": "invoice_tasks.check_overdue_invoices",
        "schedule": crontab(hour=9, minute=0),
    },
}
