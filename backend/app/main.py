"""FastAPI アプリケーションのエントリポイント。"""
import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.config import settings

# ── auth ──────────────────────────────────────────────────────────────────────
from app.modules.auth.router import router as auth_router

# ── customer ──────────────────────────────────────────────────────────────────
from app.modules.customer.router import router as customer_router

# ── vendor ────────────────────────────────────────────────────────────────────
from app.modules.vendor.router import router as vendor_router

# ── project ───────────────────────────────────────────────────────────────────
from app.modules.project.kanban_router import router as kanban_router
from app.modules.project.router import router as project_router
from app.modules.project.comments_router import router as comments_router

# ── estimate ──────────────────────────────────────────────────────────────────
from app.modules.estimate.routers.qcds import router as qcds_router
from app.modules.estimate.routers.quote_core import router as quote_core_router
from app.modules.estimate.routers.quote_versions import router as quote_versions_router
from app.modules.estimate.routers.quote_sections import router as quote_sections_router
from app.modules.estimate.routers.acknowledgments import router as acknowledgments_router
from app.api.v1.conditions import router as conditions_router
from app.api.v1.approvals import router as approvals_router

# ── report ────────────────────────────────────────────────────────────────────
from app.modules.report.routers.orders import router as orders_router
from app.modules.report.routers.invoices import router as invoices_router
from app.modules.report.routers.exports import router as exports_router
from app.modules.report.routers.dashboard import router as dashboard_router

# ── admin ─────────────────────────────────────────────────────────────────────
from app.modules.admin.router import router as admin_router
from app.modules.admin.company_settings_router import router as company_settings_router
from app.modules.admin.section_templates_router import router as section_templates_router
from app.modules.admin.excel_import_router import router as excel_import_router

# ── schedule ──────────────────────────────────────────────────────────────────
from app.modules.schedule.gantt_router import router as gantt_router
from app.modules.schedule.schedule_router import router as schedule_router

# ── site ──────────────────────────────────────────────────────────────────────
from app.modules.site.progress_router import router as progress_router
from app.modules.site.daily_reports_router import router as daily_reports_router
from app.modules.site.attendance_router import router as attendance_router

# ── purchase ──────────────────────────────────────────────────────────────────
from app.modules.purchase.routers.orders import router as purchase_router
from app.modules.purchase.routers.scan_upload import router as scan_upload_router
from app.modules.purchase.routers.scan_review import router as scan_review_router
from app.modules.purchase.routers.scan_transfer import router as scan_transfer_router


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

# ── ヘルスチェック（インライン）────────────────────────────────────────────
_health_router = APIRouter(tags=["system"])

class _HealthResponse(BaseModel):
    status: str
    version: str = "0.1.0"

@_health_router.get("/health", response_model=_HealthResponse)
async def health_check() -> _HealthResponse:
    return _HealthResponse(status="ok")

app.include_router(_health_router, prefix="/api/v1")

# ── 全モジュール登録 ──────────────────────────────────────────────────────
PREFIX = "/api/v1"

# auth
app.include_router(auth_router, prefix=PREFIX)

# customer / vendor
app.include_router(customer_router, prefix=PREFIX)
app.include_router(vendor_router, prefix=PREFIX)

# project (kanban を先に登録)
app.include_router(kanban_router, prefix=PREFIX)
app.include_router(project_router, prefix=PREFIX)
app.include_router(comments_router, prefix=PREFIX)

# estimate
app.include_router(qcds_router, prefix=PREFIX)
app.include_router(quote_core_router, prefix=PREFIX)
app.include_router(quote_versions_router, prefix=PREFIX)
app.include_router(quote_sections_router, prefix=PREFIX)
app.include_router(acknowledgments_router, prefix=PREFIX)
app.include_router(conditions_router, prefix=PREFIX)
app.include_router(approvals_router, prefix=PREFIX)

# report
app.include_router(orders_router, prefix=PREFIX)
app.include_router(invoices_router, prefix=PREFIX)
app.include_router(exports_router, prefix=PREFIX)
app.include_router(dashboard_router, prefix=PREFIX)

# admin
app.include_router(admin_router, prefix=PREFIX)
app.include_router(company_settings_router, prefix=PREFIX)
app.include_router(section_templates_router, prefix=PREFIX)
app.include_router(excel_import_router, prefix=PREFIX)

# schedule
app.include_router(gantt_router, prefix=PREFIX)
app.include_router(schedule_router, prefix=PREFIX)

# site
app.include_router(progress_router, prefix=PREFIX)
app.include_router(daily_reports_router, prefix=PREFIX)
app.include_router(attendance_router, prefix=PREFIX)

# purchase
app.include_router(purchase_router, prefix=PREFIX)
app.include_router(scan_upload_router, prefix=PREFIX)
app.include_router(scan_review_router, prefix=PREFIX)
app.include_router(scan_transfer_router, prefix=PREFIX)
