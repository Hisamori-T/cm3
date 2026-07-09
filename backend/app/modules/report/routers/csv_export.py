"""CSV出力エンドポイント。経理・管理者ロール限定。"""
from __future__ import annotations

import csv
import io
from datetime import date
from decimal import Decimal
from typing import Any
from urllib.parse import quote as urlquote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.shared.services.permissions import is_accounting_or_above

router = APIRouter(tags=["csv-export"])

CSV_MEDIA_TYPE = "text/csv; charset=utf-8-sig"


def _csv_response(rows: list[list[Any]], filename: str) -> StreamingResponse:
    """UTF-8 BOM 付き CSV をストリームで返す。"""
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_ALL)
    for row in rows:
        writer.writerow(row)
    content = "﻿" + buf.getvalue()  # BOM
    encoded = urlquote(filename, safe="")
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type=CSV_MEDIA_TYPE,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


def _fmt(v: Any) -> str:
    """値を文字列に変換。数値はカンマ区切りにして Excel の科学表記変換を防ぐ。"""
    if v is None:
        return ""
    if isinstance(v, date):
        return v.strftime("%Y/%m/%d")
    if isinstance(v, Decimal):
        # 小数点なしなら整数カンマ形式、あれば小数2桁
        if v == v.to_integral_value():
            return f"{int(v):,}"
        return f"{v:,.2f}"
    if isinstance(v, (int, float)):
        return f"{v:,}"
    return str(v)


def _require_csv_role(current_user: User) -> None:
    if not is_accounting_or_above(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSV出力は経理・管理者ロールのみ可能です")


# ── 案件一覧 ──────────────────────────────────────────────────────────────────

@router.get("/export/csv/projects")
async def export_projects_csv(
    from_date: str | None = Query(None, description="開始日 YYYY-MM-DD"),
    to_date:   str | None = Query(None, description="終了日 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """案件一覧 CSV（管理者・経理限定）。"""
    _require_csv_role(current_user)

    from app.models.project import Project
    q = select(Project).where(Project.deleted_at.is_(None)).order_by(Project.created_at)
    if from_date:
        q = q.where(func.date(Project.created_at) >= from_date)
    if to_date:
        q = q.where(func.date(Project.created_at) <= to_date)

    projects = (await db.execute(q)).scalars().all()

    header = ["工事番号", "件名", "顧客", "ステータス", "工事価格", "予定工期開始", "予定工期終了", "作成日"]
    rows: list[list[Any]] = [header]
    for p in projects:
        rows.append([
            _fmt(p.project_number),
            _fmt(p.project_name),
            _fmt(p.client_name),
            _fmt(p.status.value if p.status else ""),
            _fmt(p.project_price),
            _fmt(p.period_quote_start),
            _fmt(p.period_quote_end),
            _fmt(p.created_at.date() if p.created_at else None),
        ])
    return _csv_response(rows, "案件一覧.csv")
