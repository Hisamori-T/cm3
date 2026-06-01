"""FastAPI アプリケーションのエントリポイント。"""
import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import acknowledgments, admin, attendance, auth, clients, comments, company_settings, daily_reports, dashboard, excel_import, exports, gantt, health, invoices, kanban, orders, progress, projects, purchase, qcds, quotes, scan, schedule, section_templates, vendors
from app.core.config import settings


def _configure_logging() -> None:
    """structlog を JSON 出力で設定する。"""
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(settings.log_level_int),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(format="%(message)s", level=settings.log_level_int, stream=sys.stdout)


_configure_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """アプリケーションのライフサイクル管理。"""
    logger.info("startup", env=settings.app_env, version="0.1.0")
    yield
    logger.info("shutdown")


app = FastAPI(
    title="Construction Manager v3",
    description="株式会社クラップ 工事台帳管理システム",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(kanban.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(qcds.router, prefix="/api/v1")
app.include_router(quotes.router, prefix="/api/v1")
app.include_router(vendors.router, prefix="/api/v1")
app.include_router(clients.router, prefix="/api/v1")
app.include_router(scan.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(acknowledgments.router, prefix="/api/v1")
app.include_router(section_templates.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(exports.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(progress.router, prefix="/api/v1")
app.include_router(excel_import.router, prefix="/api/v1")
app.include_router(gantt.router, prefix="/api/v1")
app.include_router(daily_reports.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(schedule.router, prefix="/api/v1")
app.include_router(purchase.router, prefix="/api/v1")
app.include_router(comments.router, prefix="/api/v1")
app.include_router(company_settings.router, prefix="/api/v1")
