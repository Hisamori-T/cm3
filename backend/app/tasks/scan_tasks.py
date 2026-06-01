"""業者見積スキャン Celery タスク。"""
from __future__ import annotations

import uuid

import structlog
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


def _get_sync_db_url() -> str:
    """asyncpg → psycopg2 に変換した同期接続 URL を返す。"""
    from app.core.config import settings

    return settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


@celery_app.task(bind=True, name="app.tasks.scan_tasks.process_scan_job", max_retries=3)
def process_scan_job(self, scan_job_id: str) -> dict:  # type: ignore[override]
    """スキャンジョブを処理する。Gemini API で業者見積書を解析する。"""
    from app.models.enums import ScanJobStatus
    from app.models.scan import ScanJob
    from app.services import gemini_scanner

    engine = create_engine(_get_sync_db_url())
    try:
        with Session(engine) as db:
            job = db.execute(
                select(ScanJob).where(ScanJob.id == uuid.UUID(scan_job_id))
            ).scalar_one_or_none()

            if job is None:
                logger.error("scan_job_not_found", scan_job_id=scan_job_id)
                return {"status": "error", "message": "job not found"}

            job.status = ScanJobStatus.processing
            db.commit()

            try:
                logger.info(
                    "scan_job_processing",
                    scan_job_id=scan_job_id,
                    file=job.original_file_name,
                    file_type=job.file_type,
                )

                gemini_scanner.process_file(job, db)

                job.status = ScanJobStatus.succeeded
                db.commit()

                logger.info("scan_job_succeeded", scan_job_id=scan_job_id)
                return {"status": "succeeded", "scan_job_id": scan_job_id}

            except Exception as exc:
                db.rollback()
                job.status = ScanJobStatus.failed
                job.error_message = str(exc)
                db.commit()
                logger.error("scan_job_failed", scan_job_id=scan_job_id, error=str(exc))
                raise self.retry(exc=exc, countdown=2**self.request.retries)
    finally:
        engine.dispose()
