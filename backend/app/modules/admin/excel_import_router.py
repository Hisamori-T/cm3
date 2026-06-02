"""Excel工事台帳インポート API。

1案件 = 1ブック（工事台帳シート + QCDS/表紙/内訳書/注文書・請書/請求書）。
新規インポート時に関連レコード（QCDS・見積書・注文書・注文請書・請求書）を一括作成する。
既存案件の上書き時は案件基本情報のみ更新し関連レコードは変更しない。
"""
from __future__ import annotations

import uuid
from typing import Literal

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.acknowledgment import Acknowledgment
from app.models.invoice import Invoice, InvoiceItem
from app.models.order import Order
from app.models.project import Project
from app.models.qcds import QCDS, QCDSDirectWork, QCDSExpenseItem
from app.models.quote import Quote, QuoteItem, QuoteSection
from app.models.user import User
from app.services.excel_import import ExcelImportRow, parse_excel
from app.services.project_number import generate_project_number

logger = structlog.get_logger()
router = APIRouter()

MAX_UPLOAD_MB = 20

# インポート時に作成する標準経費項目（qcds.py の _DEFAULT_EXPENSE_ITEMS と同一）
_IMPORT_EXPENSE_ITEMS: list[tuple[str, int, str, str, str]] = [
    ("B_site", 1, "labor_insurance",            "労災保険料",                   "工事価格 × 料率"),
    ("B_site", 2, "construction_insurance",     "工事保険・賠償責任保険",        "請負金(税込) × 料率"),
    ("B_site", 3, "stamp_cost",                 "請負に関する契約印紙代",         "契約金額(税込)→第2号文書 自動計算"),
    ("B_site", 4, "receipt_cost",               "売り上げの領収書",               "受取金額(税込)→第17号文書 自動計算"),
    ("B_site", 5, "special_insurance",          "特殊保険",                       "工事価格 × 料率"),
    ("B_site", 6, "fixed_overhead",             "事務用品・通信交通費・雑費",      "固定費計"),
    ("B_dept", 7, "site_personnel_cost",        "現場担当者給与",                  "工事価格 × 給与率"),
    ("B_dept", 8, "construction_dept_overhead", "工事部経費（共通）",              "工事価格 × 工事部経費率"),
    ("B_dept", 9, "shared_overhead",            "共通経費",                        "工事価格 × 共通経費率"),
    ("C",      10, "general_admin_cost",        "一般管理費",                      "工事価格 × 一般管理費率"),
]
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


# ---------------------------------------------------------------------------
# レスポンス型
# ---------------------------------------------------------------------------

class ImportPreviewRow(BaseModel):
    """プレビュー1行: 既存案件との照合結果と関連データ件数。"""
    row_index: int
    project_name: str
    project_number: str | None
    client_name: str | None
    project_price: float | None
    period_contract_start: str | None
    period_contract_end: str | None
    conflict: Literal["none", "number_exists", "name_exists", "deleted_exists"]
    existing_id: str | None
    deleted_existing_id: str | None = None  # 削除済み案件が一致する場合のID
    # 関連シートデータ件数
    qcds_direct_work_count: int
    quote_section_count: int
    quote_item_count: int
    has_order: bool
    has_invoice: bool


class ImportConfirmRow(BaseModel):
    row_index: int
    overwrite: bool
    deleted_action: Literal["new", "restore"] = "new"


class ImportConfirmRequest(BaseModel):
    rows: list[ImportConfirmRow]


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]


# セッション保持用（サーバー再起動でクリアされる簡易ストア）
_import_sessions: dict[str, list[ExcelImportRow]] = {}


# ---------------------------------------------------------------------------
# プレビュー
# ---------------------------------------------------------------------------

@router.post("/excel/preview", response_model=list[ImportPreviewRow])
async def preview_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Excelファイルをアップロードして案件データのプレビューを返す。
    セッションIDを X-Import-Session レスポンスヘッダに返す。
    """
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="インポートは管理者またはマネージャーのみ実行可能です")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"ファイルサイズが{MAX_UPLOAD_MB}MBを超えています")

    try:
        rows = parse_excel(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Excelファイルの解析に失敗しました: {e}")

    if not rows:
        raise HTTPException(status_code=422, detail="案件データが見つかりませんでした（工事名セルが空）")

    previews: list[ImportPreviewRow] = []
    for i, row in enumerate(rows):
        conflict: Literal["none", "number_exists", "name_exists", "deleted_exists"] = "none"
        existing_id: str | None = None
        deleted_existing_id: str | None = None

        if row.project_number:
            # アクティブ案件を検索
            existing = (await db.execute(
                select(Project).where(
                    Project.project_number == row.project_number,
                    Project.deleted_at.is_(None),
                )
            )).scalar_one_or_none()
            if existing:
                conflict = "number_exists"
                existing_id = str(existing.id)
            else:
                # 削除済み案件を検索
                deleted = (await db.execute(
                    select(Project).where(
                        Project.project_number == row.project_number,
                        Project.deleted_at.is_not(None),
                    )
                )).scalar_one_or_none()
                if deleted:
                    conflict = "deleted_exists"
                    deleted_existing_id = str(deleted.id)

        if conflict == "none" and row.project_name:
            existing = (await db.execute(
                select(Project).where(
                    Project.project_name == row.project_name,
                    Project.deleted_at.is_(None),
                )
            )).scalar_one_or_none()
            if existing:
                conflict = "name_exists"
                existing_id = str(existing.id)
            else:
                deleted = (await db.execute(
                    select(Project).where(
                        Project.project_name == row.project_name,
                        Project.deleted_at.is_not(None),
                    )
                )).scalar_one_or_none()
                if deleted and conflict == "none":
                    conflict = "deleted_exists"
                    deleted_existing_id = str(deleted.id)

        q = row.quote
        previews.append(ImportPreviewRow(
            row_index=i,
            project_name=row.project_name or "",
            project_number=row.project_number,
            client_name=row.client_name,
            project_price=row.project_price,
            period_contract_start=str(row.period_contract_start) if row.period_contract_start else None,
            period_contract_end=str(row.period_contract_end) if row.period_contract_end else None,
            conflict=conflict,
            existing_id=existing_id,
            deleted_existing_id=deleted_existing_id,
            qcds_direct_work_count=len(row.qcds_direct_works),
            quote_section_count=len(q.sections) if q else 0,
            quote_item_count=sum(len(s.items) for s in q.sections) + len(q.unsectioned_items) if q else 0,
            has_order=row.order is not None and row.order.total_amount is not None,
            has_invoice=row.invoice is not None and row.invoice.total_amount is not None,
        ))

    session_id = str(uuid.uuid4())
    _import_sessions[session_id] = rows
    logger.info("excel_import_preview", session_id=session_id, row_count=len(rows))

    return JSONResponse(
        content=[p.model_dump() for p in previews],
        headers={"X-Import-Session": session_id},
    )


# ---------------------------------------------------------------------------
# インポート実行
# ---------------------------------------------------------------------------

@router.post("/excel/import", response_model=ImportResult)
async def confirm_import(
    body: ImportConfirmRequest,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportResult:
    """プレビュー確認後、実際にインポートを実行する。
    新規案件: Project + QCDS + Quote(大項目・明細) + Order + Acknowledgment + Invoice を一括作成。
    既存上書き: 案件基本情報のみ更新（関連レコードは保持）。
    """
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="インポートは管理者またはマネージャーのみ実行可能です")

    rows = _import_sessions.get(session_id)
    if rows is None:
        raise HTTPException(status_code=404, detail="セッションが見つかりません。再度アップロードしてください")

    created = updated = skipped = 0
    errors: list[str] = []

    for conf in body.rows:
        if conf.row_index >= len(rows):
            continue
        row = rows[conf.row_index]

        try:
            async with db.begin_nested():  # セーブポイント：失敗行のみロールバック
                from datetime import date as _date

                # 番号で検索（削除済み含む — UniqueViolation 防止のため）
                existing: Project | None = None
                if row.project_number:
                    existing = (await db.execute(
                        select(Project).where(
                            Project.project_number == row.project_number,
                        )
                    )).scalar_one_or_none()

                # 番号で見つからなければ名前でも検索（アクティブ案件のみ）
                if existing is None and row.project_name:
                    existing = (await db.execute(
                        select(Project).where(
                            Project.project_name == row.project_name,
                            Project.deleted_at.is_(None),
                        )
                    )).scalar_one_or_none()

                # 削除済み案件: ユーザー選択に応じて復元または新規作成
                if existing is not None and existing.deleted_at is not None:
                    if conf.deleted_action == "restore":
                        existing.deleted_at = None
                        _apply_row(existing, row)
                        await _create_related_records(existing, row, db)
                        created += 1
                    else:
                        # 新規作成: 削除済み案件とは別に作成（番号は自動採番で重複回避）
                        auto_number = await generate_project_number(
                            current_user.employee_number or 1,
                            _date.today(),
                            db,
                        )
                        proj = Project(
                            project_name=row.project_name or "",
                            project_number=auto_number,
                            created_by=current_user.id,
                        )
                        _apply_row(proj, row)
                        proj.project_number = auto_number
                        db.add(proj)
                        await db.flush()
                        await _create_related_records(proj, row, db)
                        created += 1
                    continue

                # アクティブ案件の上書き
                if existing is not None and conf.overwrite:
                    _apply_row(existing, row)
                    updated += 1
                    continue

                # アクティブ案件のスキップ
                if existing is not None:
                    skipped += 1
                    continue

                # 新規案件の作成
                auto_number = row.project_number or await generate_project_number(
                    current_user.employee_number or 1,
                    _date.today(),
                    db,
                )
                proj = Project(
                    project_name=row.project_name or "",
                    project_number=auto_number,
                    created_by=current_user.id,
                )
                _apply_row(proj, row)
                db.add(proj)
                await db.flush()
                await _create_related_records(proj, row, db)
                created += 1

        except Exception as e:
            errors.append(f"行 {conf.row_index + 1} ({row.project_name}): {e}")

    await db.commit()
    del _import_sessions[session_id]
    logger.info("excel_import_done", created=created, updated=updated, skipped=skipped, errors=len(errors))
    return ImportResult(created=created, updated=updated, skipped=skipped, errors=errors)


async def _create_related_records(proj: Project, row: ExcelImportRow, db: AsyncSession) -> None:
    """新規案件に対してQCDS・見積書・注文書・注文請書・請求書を一括作成する。"""
    project_id = proj.id
    project_number = proj.project_number

    # QCDS + 直接工事費 + 経費項目（既存があればスキップ）
    existing_qcds = (await db.execute(
        select(QCDS)
        .where(QCDS.project_id == project_id, QCDS.revision == 0)
        .limit(1)
    )).scalar_one_or_none()
    if existing_qcds is None:
        qcds = QCDS(project_id=project_id)
        db.add(qcds)
        await db.flush()

        # A セクション: 直接工事費
        if row.qcds_direct_works:
            from app.models.enums import QCDSCategory
            for dw in row.qcds_direct_works:
                db.add(QCDSDirectWork(
                    qcds_id=qcds.id,
                    row_no=dw.row_no,
                    vendor_name_snapshot=dw.vendor_name,
                    budget_amount=dw.budget_amount,
                    category=QCDSCategory(dw.category) if dw.category else QCDSCategory.subcontract,
                ))

        # B/C セクション: 経費項目（Excel値を amount_override として保存）
        # overrides に値があれば Excel の金額（0 含む）、なければ None（自動計算）
        overrides = row.qcds_expense_overrides
        for section, row_no, key, item_name, formula in _IMPORT_EXPENSE_ITEMS:
            db.add(QCDSExpenseItem(
                id=uuid.uuid4(),
                qcds_id=qcds.id,
                section=section,
                row_no=row_no,
                system_key=key,
                item_name=item_name,
                formula_description=formula,
                amount_override=overrides.get(key),
                is_custom=False,
            ))

    # 顧客見積書（表紙 + 内訳書）
    quote_id: uuid.UUID | None = None
    if row.quote:
        q = row.quote
        quote = Quote(
            project_id=project_id,
            quote_number=q.quote_number or f"{project_number}-見1",
            issue_date=q.issue_date,
            validity_days=q.validity_days,
            project_name_snapshot=q.project_name_snapshot or proj.project_name,
            project_location_snapshot=q.project_location_snapshot or proj.project_location,
            payment_condition=q.payment_condition or proj.payment_condition,
            remarks=q.remarks,
            subtotal=q.subtotal,
            tax_amount=q.tax_amount,
            total_amount=q.total_amount,
            discount_amount=q.discount_amount,
        )
        db.add(quote)
        await db.flush()
        quote_id = quote.id

        # 大項目 + 明細
        global_item_row = 1
        for sec in q.sections:
            qs = QuoteSection(
                quote_id=quote_id,
                section_letter=sec.letter,
                section_name=sec.name,
                row_no=sec.row_no,
            )
            db.add(qs)
            await db.flush()
            for item in sec.items:
                db.add(QuoteItem(
                    quote_id=quote_id,
                    section_id=qs.id,
                    row_no=global_item_row,
                    item_name=item.item_name,
                    spec=item.spec,
                    unit=item.unit,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    amount=item.amount,
                    remarks=item.remarks,
                ))
                global_item_row += 1
        for item in q.unsectioned_items:
            db.add(QuoteItem(
                quote_id=quote_id,
                section_id=None,
                row_no=global_item_row,
                item_name=item.item_name,
                spec=item.spec,
                unit=item.unit,
                quantity=item.quantity,
                unit_price=item.unit_price,
                amount=item.amount,
                remarks=item.remarks,
            ))
            global_item_row += 1

    # 注文書 + 注文請書
    if row.order and row.order.total_amount is not None:
        od = row.order
        order = Order(
            project_id=project_id,
            order_number=f"{project_number}-注1",
            amount_excl_tax=od.amount_excl_tax,
            tax_amount=od.tax_amount,
            total_amount=od.total_amount,
            payment_condition=od.payment_condition,
            client_company=od.client_company,
            quote_id=quote_id,
            linked_to_quote=quote_id is not None,
        )
        db.add(order)
        await db.flush()

        ack = Acknowledgment(
            order_id=order.id,
            project_id=project_id,
            acknowledgment_number=f"{project_number}-請書1",
            amount_excl_tax=od.amount_excl_tax,
            tax_amount=od.tax_amount,
            total_amount=od.total_amount,
            payment_condition=od.payment_condition,
        )
        db.add(ack)

    # 請求書 + 明細
    if row.invoice and row.invoice.total_amount is not None:
        inv_data = row.invoice
        invoice = Invoice(
            project_id=project_id,
            invoice_number=f"{project_number}-請1",
            current_purchase=inv_data.current_purchase,
            tax_amount=inv_data.tax_amount,
            total_amount=inv_data.total_amount,
            quote_id=quote_id,
            linked_to_quote=quote_id is not None,
        )
        db.add(invoice)
        await db.flush()
        for item in inv_data.items:
            db.add(InvoiceItem(
                invoice_id=invoice.id,
                row_no=item.row_no,
                item_name=item.item_name,
                amount=item.amount,
            ))


def _apply_row(proj: Project, row: ExcelImportRow) -> None:
    """ExcelImportRow の値を Project モデルに適用する。"""
    if row.project_name:
        proj.project_name = row.project_name
    if row.project_number:
        proj.project_number = row.project_number
    if row.client_name is not None:
        proj.client_name = row.client_name
    if row.original_client_name is not None:
        proj.original_client_name = row.original_client_name
    if row.project_location is not None:
        proj.project_location = row.project_location
    if row.project_price is not None:
        proj.project_price = row.project_price
    if row.payment_condition is not None:
        proj.payment_condition = row.payment_condition
    if row.client_contact_company is not None:
        proj.client_contact_company = row.client_contact_company
    if row.client_contact_person is not None:
        proj.client_contact_person = row.client_contact_person
    if row.order_type is not None:
        proj.order_type = row.order_type
    if row.contract_type is not None:
        proj.contract_type = row.contract_type
    if row.period_quote_start is not None:
        proj.period_quote_start = row.period_quote_start
    if row.period_quote_end is not None:
        proj.period_quote_end = row.period_quote_end
    if row.period_contract_start is not None:
        proj.period_contract_start = row.period_contract_start
    if row.period_contract_end is not None:
        proj.period_contract_end = row.period_contract_end
    if row.period_actual_start is not None:
        proj.period_actual_start = row.period_actual_start
    if row.period_actual_end is not None:
        proj.period_actual_end = row.period_actual_end
