"""QCDS エンドポイント: GET / PUT /api/v1/projects/{project_id}/qcds。"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import UserRole
from app.models.master import StampTaxTable
from app.models.project import Project
from app.models.qcds import QCDS, QCDSDirectWork, QCDSExpenseItem
from app.models.user import User
from app.schemas.qcds import (
    ExpenseItemRead,
    QCDSInput,
    QCDSResponse,
    DirectWorkRead,
    QCDSCalcFields,
)
from app.services.qcds_calculator import (
    apply_expense_item_overrides,
    calculate_qcds,
)

router = APIRouter(tags=["qcds"])
logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# 標準経費行のデフォルト定義
# ---------------------------------------------------------------------------

# (section, row_no, system_key, item_name, formula_description)
_DEFAULT_EXPENSE_ITEMS: list[tuple[str, int, str, str, str]] = [
    ("B_site", 1, "labor_insurance",         "労災保険料",                   "工事価格 × 料率"),
    ("B_site", 2, "construction_insurance",  "工事保険・賠償責任保険",        "請負金(税込) × 料率"),
    ("B_site", 3, "stamp_cost",              "請負に関する契約印紙代",         "契約金額(税込)→第2号文書 自動計算"),
    ("B_site", 4, "receipt_cost",            "売り上げの領収書",               "受取金額(税込)→第17号文書 自動計算"),
    ("B_site", 5, "special_insurance",       "特殊保険",                       "工事価格 × 料率"),
    ("B_site", 6, "fixed_overhead",          "事務用品・通信交通費・雑費",      "固定費計"),
    ("B_dept", 7, "site_personnel_cost",     "現場担当者給与",                  "工事価格 × 給与率"),
    ("B_dept", 8, "construction_dept_overhead", "工事部経費（共通）",           "工事価格 × 工事部経費率"),
    ("B_dept", 9, "shared_overhead",         "共通経費",                        "工事価格 × 共通経費率"),
    ("C",      10, "general_admin_cost",     "一般管理費",                      "工事価格 × 一般管理費率"),
]

# 新たに追加された標準項目キー（既存QCDS への差分追加用）
_NEW_STANDARD_KEYS = {"stamp_cost", "receipt_cost"}


async def _ensure_expense_items(qcds: QCDS, db: AsyncSession) -> None:
    """標準項目が不足している場合に追加する。

    - expense_items が空 → 全標準項目を新規作成
    - expense_items が存在するが新規標準項目が欠落 → 差分のみ追加
    """
    existing_result = await db.execute(
        select(QCDSExpenseItem).where(QCDSExpenseItem.qcds_id == qcds.id)
    )
    existing_items = existing_result.scalars().all()
    existing_keys = {item.system_key for item in existing_items if item.system_key}

    if not existing_items:
        # 全新規作成
        items_to_add = _DEFAULT_EXPENSE_ITEMS
    else:
        # 差分のみ追加（新しく定義された標準キーのみ）
        items_to_add = [
            row for row in _DEFAULT_EXPENSE_ITEMS
            if row[2] in _NEW_STANDARD_KEYS and row[2] not in existing_keys
        ]

    if not items_to_add:
        return

    for section, row_no, system_key, item_name, formula in items_to_add:
        db.add(QCDSExpenseItem(
            id=uuid.uuid4(),
            qcds_id=qcds.id,
            section=section,
            row_no=row_no,
            system_key=system_key,
            item_name=item_name,
            formula_description=formula,
            amount_override=None,
            is_custom=False,
        ))
    await db.flush()
    await db.refresh(qcds, ["expense_items"])


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

async def _lookup_stamp_tax(project_price: float, db: AsyncSession) -> tuple[float, float]:
    """税込金額から第2号文書（契約）・第17号文書（領収書）の印紙税を取得する。"""
    tax_incl = round(project_price * 1.1)

    async def _find(table_type: str) -> float:
        result = await db.execute(
            select(StampTaxTable)
            .where(
                StampTaxTable.table_type == table_type,
                StampTaxTable.min_amount <= tax_incl,
                or_(StampTaxTable.max_amount.is_(None), StampTaxTable.max_amount >= tax_incl),
            )
            .order_by(StampTaxTable.min_amount.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return float(row.tax_amount) if row else 0.0

    stamp = await _find("contract")
    receipt = await _find("receipt")
    return stamp, receipt


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    p = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")
    return p


def _build_response(
    qcds: QCDS,
    project_price: float,
    stamp_cost: float = 0.0,
    receipt_cost: float = 0.0,
) -> QCDSResponse:
    calc = calculate_qcds(qcds, qcds.direct_works, project_price, stamp_cost, receipt_cost)
    if qcds.expense_items:
        apply_expense_item_overrides(calc, qcds.expense_items, project_price)

    works = [
        DirectWorkRead(
            id=w.id,
            row_no=w.row_no,
            work_type=w.work_type,
            vendor_id=w.vendor_id,
            vendor_name_snapshot=w.vendor_name_snapshot,
            vendor_name=w.vendor.vendor_name if w.vendor else None,
            category=w.category,
            budget_amount=float(w.budget_amount) if w.budget_amount is not None else None,
            agreed_amount=float(w.agreed_amount) if w.agreed_amount is not None else None,
            settlement_amount=float(w.settlement_amount) if w.settlement_amount is not None else None,
            agreement_checked=w.agreement_checked,
            payment_month_4=float(w.payment_month_4) if w.payment_month_4 is not None else None,
            payment_month_5=float(w.payment_month_5) if w.payment_month_5 is not None else None,
            payment_month_6=float(w.payment_month_6) if w.payment_month_6 is not None else None,
            payment_month_7=float(w.payment_month_7) if w.payment_month_7 is not None else None,
            payment_month_8=float(w.payment_month_8) if w.payment_month_8 is not None else None,
            payment_month_9=float(w.payment_month_9) if w.payment_month_9 is not None else None,
            payment_month_10=float(w.payment_month_10) if w.payment_month_10 is not None else None,
            payment_month_11=float(w.payment_month_11) if w.payment_month_11 is not None else None,
            payment_month_12=float(w.payment_month_12) if w.payment_month_12 is not None else None,
            payment_month_1=float(w.payment_month_1) if w.payment_month_1 is not None else None,
            payment_month_2=float(w.payment_month_2) if w.payment_month_2 is not None else None,
            payment_month_3=float(w.payment_month_3) if w.payment_month_3 is not None else None,
            payment_completed=w.payment_completed,
            note=w.note,
            source_scan_result_id=w.source_scan_result_id,
        )
        for w in sorted(qcds.direct_works, key=lambda x: x.row_no)
    ]
    expense_reads = [
        ExpenseItemRead.model_validate(e)
        for e in sorted(qcds.expense_items, key=lambda x: (x.section, x.row_no))
    ]
    return QCDSResponse(
        id=qcds.id,
        project_id=qcds.project_id,
        revision=qcds.revision,
        spare_cost=float(qcds.spare_cost) if qcds.spare_cost is not None else None,
        industrial_waste_cost=float(qcds.industrial_waste_cost) if qcds.industrial_waste_cost is not None else None,
        labor_insurance_rate=float(qcds.labor_insurance_rate),
        construction_insurance_rate=float(qcds.construction_insurance_rate),
        special_insurance_rate=float(qcds.special_insurance_rate),
        office_supplies=float(qcds.office_supplies),
        communication_cost=float(qcds.communication_cost),
        misc_cost=float(qcds.misc_cost),
        site_staff_salary_rate=float(qcds.site_staff_salary_rate),
        common_overhead_rate=float(qcds.common_overhead_rate) if qcds.common_overhead_rate is not None else None,
        shared_overhead_rate=float(qcds.shared_overhead_rate),
        general_admin_rate=float(qcds.general_admin_rate),
        target_operating_profit_rate=float(qcds.target_operating_profit_rate),
        actual_site_personnel_cost=float(qcds.actual_site_personnel_cost) if qcds.actual_site_personnel_cost is not None else None,
        created_at=qcds.created_at,
        updated_at=qcds.updated_at,
        direct_works=works,
        expense_items=expense_reads,
        calc=QCDSCalcFields(**calc.__dict__),
    )


# ---------------------------------------------------------------------------
# エンドポイント
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/qcds", response_model=QCDSResponse)
async def get_qcds(
    project_id: uuid.UUID,
    revision: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QCDSResponse:
    """案件の QCDS を返す。revision 指定時はそのリビジョンを返す。未登録の場合はデフォルト値で新規作成して返す。"""
    project = await _get_project_or_404(project_id, db)

    base_opts = (
        selectinload(QCDS.direct_works).selectinload(QCDSDirectWork.vendor),
        selectinload(QCDS.expense_items),
    )
    if revision is not None:
        # 指定 revision を取得。重複があっても最新を返す
        stmt = (
            select(QCDS)
            .options(*base_opts)
            .where(QCDS.project_id == project_id, QCDS.revision == revision)
            .order_by(QCDS.created_at.desc())
            .limit(1)
        )
    else:
        # revision 未指定 → 最大リビジョンを返す
        stmt = (
            select(QCDS)
            .options(*base_opts)
            .where(QCDS.project_id == project_id)
            .order_by(QCDS.revision.desc(), QCDS.created_at.desc())
            .limit(1)
        )

    result = await db.execute(stmt)
    qcds = result.scalars().first()

    # revision 指定で見つからなかった場合は 404
    if revision is not None and qcds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="指定したリビジョンが見つかりません")

    if qcds is None:
        qcds = QCDS(id=uuid.uuid4(), project_id=project_id)
        db.add(qcds)
        await db.flush()
        await _ensure_expense_items(qcds, db)
        await db.commit()
        await db.refresh(qcds, ["direct_works", "expense_items"])
    else:
        # 既存QCDSに不足している標準項目を差分追加（移行前データ対応 + 新規標準項目追加）
        await _ensure_expense_items(qcds, db)
        # 自動計算行に誤って amount_override=0 が設定されている場合は None にリセット
        _auto_keys = {row[2] for row in _DEFAULT_EXPENSE_ITEMS}
        await db.execute(
            update(QCDSExpenseItem)
            .where(
                QCDSExpenseItem.qcds_id == qcds.id,
                QCDSExpenseItem.system_key.in_(_auto_keys),
                QCDSExpenseItem.amount_override == 0,
                QCDSExpenseItem.is_custom.is_(False),
            )
            .values(amount_override=None)
        )
        await db.commit()
        await db.refresh(qcds, ["expense_items"])

    project_price = float(project.project_price or 0)
    if project_price == 0:
        from app.models.quote import Quote
        q_row = (await db.execute(
            select(Quote).where(Quote.project_id == project_id)
            .order_by(Quote.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        if q_row and q_row.subtotal:
            project_price = float(q_row.subtotal)

    stamp_cost, receipt_cost = await _lookup_stamp_tax(project_price, db)
    return _build_response(qcds, project_price, stamp_cost, receipt_cost)


@router.put("/projects/{project_id}/qcds", response_model=QCDSResponse)
async def upsert_qcds(
    project_id: uuid.UUID,
    body: QCDSInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QCDSResponse:
    """QCDS ヘッダ・直接工事費行・経費行を一括保存する。"""
    project = await _get_project_or_404(project_id, db)

    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    result = await db.execute(
        select(QCDS)
        .options(
            selectinload(QCDS.direct_works).selectinload(QCDSDirectWork.vendor),
            selectinload(QCDS.expense_items),
        )
        .where(QCDS.project_id == project_id, QCDS.revision == body.revision)
    )
    qcds = result.scalar_one_or_none()

    if qcds is None:
        qcds = QCDS(id=uuid.uuid4(), project_id=project_id)
        db.add(qcds)

    # ヘッダ更新
    for field_name in [
        "revision", "spare_cost", "industrial_waste_cost",
        "labor_insurance_rate", "construction_insurance_rate", "special_insurance_rate",
        "office_supplies", "communication_cost", "misc_cost",
        "site_staff_salary_rate", "common_overhead_rate", "shared_overhead_rate",
        "general_admin_rate", "target_operating_profit_rate", "actual_site_personnel_cost",
    ]:
        value = getattr(body, field_name)
        if value is not None:
            setattr(qcds, field_name, value)

    await db.flush()

    # 直接工事費行: row_no でupsert
    existing_map: dict[int, QCDSDirectWork] = {w.row_no: w for w in qcds.direct_works}
    for work_in in body.direct_works:
        if work_in.row_no in existing_map:
            w = existing_map[work_in.row_no]
        else:
            w = QCDSDirectWork(id=uuid.uuid4(), qcds_id=qcds.id, row_no=work_in.row_no)
            db.add(w)
        for fname in [
            "work_type", "vendor_id", "vendor_name_snapshot", "category",
            "budget_amount", "agreed_amount", "settlement_amount", "agreement_checked",
            "payment_month_4", "payment_month_5", "payment_month_6", "payment_month_7",
            "payment_month_8", "payment_month_9", "payment_month_10", "payment_month_11",
            "payment_month_12", "payment_month_1", "payment_month_2", "payment_month_3",
            "payment_completed", "note",
        ]:
            setattr(w, fname, getattr(work_in, fname))

    # 経費行: クライアントから送られた場合は全置換
    if body.expense_items is not None:
        await db.execute(
            delete(QCDSExpenseItem).where(QCDSExpenseItem.qcds_id == qcds.id)
        )
        for i, ei in enumerate(body.expense_items):
            db.add(QCDSExpenseItem(
                id=ei.id or uuid.uuid4(),
                qcds_id=qcds.id,
                section=ei.section,
                row_no=ei.row_no if ei.row_no else i + 1,
                system_key=ei.system_key,
                item_name=ei.item_name,
                formula_description=ei.formula_description,
                amount_override=ei.amount_override,
                is_custom=ei.is_custom,
            ))

    await db.commit()

    # vendor + expense_items まで含めて再クエリ
    result2 = await db.execute(
        select(QCDS)
        .options(
            selectinload(QCDS.direct_works).selectinload(QCDSDirectWork.vendor),
            selectinload(QCDS.expense_items),
        )
        .where(QCDS.id == qcds.id)
    )
    qcds = result2.scalar_one()

    # expense_items が空のまま（送られなかった場合）はデフォルト作成
    if not qcds.expense_items:
        await _ensure_expense_items(qcds, db)
        await db.commit()
        await db.refresh(qcds, ["expense_items"])

    logger.info("qcds_saved", project_id=str(project_id), user_id=str(current_user.id))
    project_price = float(project.project_price or 0)
    if project_price == 0:
        from app.models.quote import Quote
        q_row = (await db.execute(
            select(Quote).where(Quote.project_id == project_id)
            .order_by(Quote.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        if q_row and q_row.subtotal:
            project_price = float(q_row.subtotal)
    stamp_cost, receipt_cost = await _lookup_stamp_tax(project_price, db)
    return _build_response(qcds, project_price, stamp_cost, receipt_cost)


@router.post("/projects/{project_id}/qcds/new-revision", response_model=QCDSResponse)
async def create_new_revision(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QCDSResponse:
    """現在の最新 QCDS を複製して次のリビジョン（下書き）を作成して返す。"""
    project = await _get_project_or_404(project_id, db)

    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    # 最新リビジョンを取得
    result = await db.execute(
        select(QCDS)
        .options(
            selectinload(QCDS.direct_works).selectinload(QCDSDirectWork.vendor),
            selectinload(QCDS.expense_items),
        )
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
        .limit(1)
    )
    src = result.scalar_one_or_none()
    next_rev = (src.revision + 1) if src else 1

    # 同じリビジョンが既に存在する場合はそれを返す
    existing = (await db.execute(
        select(QCDS)
        .options(
            selectinload(QCDS.direct_works).selectinload(QCDSDirectWork.vendor),
            selectinload(QCDS.expense_items),
        )
        .where(QCDS.project_id == project_id, QCDS.revision == next_rev)
    )).scalar_one_or_none()
    if existing:
        pp = float(project.project_price or 0)
        if pp == 0:
            from app.models.quote import Quote
            q_row = (await db.execute(
                select(Quote).where(Quote.project_id == project_id)
                .order_by(Quote.created_at.desc()).limit(1)
            )).scalar_one_or_none()
            if q_row and q_row.subtotal:
                pp = float(q_row.subtotal)
        sc, rc = await _lookup_stamp_tax(pp, db)
        return _build_response(existing, pp, sc, rc)

    # 新リビジョンを複製作成
    new_qcds = QCDS(
        id=uuid.uuid4(),
        project_id=project_id,
        revision=next_rev,
    )
    if src:
        for field in [
            "spare_cost", "industrial_waste_cost",
            "labor_insurance_rate", "construction_insurance_rate", "special_insurance_rate",
            "office_supplies", "communication_cost", "misc_cost",
            "site_staff_salary_rate", "common_overhead_rate", "shared_overhead_rate",
            "general_admin_rate", "target_operating_profit_rate", "actual_site_personnel_cost",
        ]:
            setattr(new_qcds, field, getattr(src, field))
    db.add(new_qcds)
    await db.flush()

    # 直接工事費行を複製
    if src:
        for w in src.direct_works:
            db.add(QCDSDirectWork(
                id=uuid.uuid4(), qcds_id=new_qcds.id, row_no=w.row_no,
                work_type=w.work_type, vendor_id=w.vendor_id, vendor_name_snapshot=w.vendor_name_snapshot,
                category=w.category, budget_amount=w.budget_amount, agreed_amount=w.agreed_amount,
                settlement_amount=w.settlement_amount, agreement_checked=w.agreement_checked,
                payment_month_4=w.payment_month_4, payment_month_5=w.payment_month_5,
                payment_month_6=w.payment_month_6, payment_month_7=w.payment_month_7,
                payment_month_8=w.payment_month_8, payment_month_9=w.payment_month_9,
                payment_month_10=w.payment_month_10, payment_month_11=w.payment_month_11,
                payment_month_12=w.payment_month_12, payment_month_1=w.payment_month_1,
                payment_month_2=w.payment_month_2, payment_month_3=w.payment_month_3,
                payment_completed=w.payment_completed, note=w.note,
            ))

    await _ensure_expense_items(new_qcds, db)
    await db.commit()
    await db.refresh(new_qcds, ["direct_works", "expense_items"])

    logger.info("qcds_new_revision", project_id=str(project_id), revision=next_rev, user_id=str(current_user.id))
    project_price = float(project.project_price or 0)
    if project_price == 0:
        from app.models.quote import Quote
        q_row = (await db.execute(
            select(Quote).where(Quote.project_id == project_id)
            .order_by(Quote.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        if q_row and q_row.subtotal:
            project_price = float(q_row.subtotal)
    stamp_cost, receipt_cost = await _lookup_stamp_tax(project_price, db)
    return _build_response(new_qcds, project_price, stamp_cost, receipt_cost)


@router.delete("/projects/{project_id}/qcds/direct-works/{work_id}", status_code=204)
async def delete_direct_work(
    project_id: uuid.UUID,
    work_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """QCDS 直接工事費の 1 行を削除する。"""
    await _get_project_or_404(project_id, db)
    work = (await db.execute(
        select(QCDSDirectWork)
        .join(QCDS, QCDS.id == QCDSDirectWork.qcds_id)
        .where(QCDSDirectWork.id == work_id, QCDS.project_id == project_id)
    )).scalar_one_or_none()
    if work is None:
        raise HTTPException(status_code=404, detail="行が見つかりません")
    await db.delete(work)
    await db.commit()
