"""QCDS派生フィールド計算サービス。設計書追補06 §3.4 の実装。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.models.qcds import QCDS, QCDSDirectWork

if TYPE_CHECKING:
    from app.models.qcds import QCDSExpenseItem


@dataclass
class DirectWorkTotals:
    """直接工事費合計（実行予算/取決見通/精算の3列）。"""
    budget: float = 0.0
    agreed: float = 0.0
    settlement: float = 0.0


@dataclass
class QCDSCalcResult:
    """QCDS全体の派生計算結果。UI表示と帳票出力に使用。"""

    # A: 直接工事費合計
    direct_cost_budget: float = 0.0
    direct_cost_agreed: float = 0.0
    direct_cost_settlement: float = 0.0

    # B: 現場経費
    labor_insurance: float = 0.0        # 労災保険
    construction_insurance: float = 0.0  # 工事保険
    stamp_cost: float = 0.0             # 請負に関する契約印紙代
    receipt_cost: float = 0.0           # 売り上げの領収書
    special_insurance: float = 0.0       # 特殊保険
    site_personnel_cost: float = 0.0     # 現場担当者給与
    fixed_overhead: float = 0.0          # 事務用品+通信交通+雑費+予備費+産廃
    site_overhead_total: float = 0.0     # B合計（現場経費+事業部小計+カスタム行）

    # C: 工事費合計 (A+B)
    construction_cost_total: float = 0.0

    # D: 工事部経費
    construction_dept_overhead: float = 0.0  # project_price × common_overhead_rate

    # E: 共通経費
    shared_overhead: float = 0.0  # project_price × shared_overhead_rate

    # F: 原価合計 (A+B+D+E)
    total_cost: float = 0.0

    # G: 一般管理費
    general_admin_cost: float = 0.0  # project_price × general_admin_rate

    # H: 営業利益
    operating_profit: float = 0.0      # project_price - F - G
    operating_profit_rate: float = 0.0  # H / project_price

    # I: 目標営業利益
    target_operating_profit: float = 0.0  # project_price × target_rate


def calculate_qcds(
    qcds: QCDS,
    direct_works: list[QCDSDirectWork],
    project_price: float,
    stamp_cost: float = 0.0,
    receipt_cost: float = 0.0,
) -> QCDSCalcResult:
    """QCDS全体の派生フィールドを同期計算する。

    保険料は現状QCDSモデル内の料率フィールドを使用（マスタテーブル連携はPhase 2）。
    労災・特殊保険: 工事価格（project_price）ベース。
    工事保険・賠償: 請負金（税込 = project_price × 1.1）ベース。
    overhead_rates（担当者給与・共通経費・一般管理費）の基準は project_price とする。
    """
    r = QCDSCalcResult()
    pp = project_price or 0.0

    # A: 直接工事費合計
    r.direct_cost_budget = sum(float(w.budget_amount or 0) for w in direct_works)
    r.direct_cost_agreed = sum(float(w.agreed_amount or 0) for w in direct_works)
    r.direct_cost_settlement = sum(float(w.settlement_amount or 0) for w in direct_works)

    # B-1: 保険料・印紙代
    r.labor_insurance = round(pp * float(qcds.labor_insurance_rate or 0))
    r.construction_insurance = round(pp * 1.1 * float(qcds.construction_insurance_rate or 0))
    r.stamp_cost = stamp_cost
    r.receipt_cost = receipt_cost
    r.special_insurance = round(pp * float(qcds.special_insurance_rate or 0))

    # B-2: 現場担当者給与（実績 or 工事価格ベース）
    if qcds.actual_site_personnel_cost:
        r.site_personnel_cost = float(qcds.actual_site_personnel_cost)
    else:
        r.site_personnel_cost = round(pp * float(qcds.site_staff_salary_rate or 0))

    # B-3: 固定費
    r.fixed_overhead = sum(float(v or 0) for v in [
        qcds.office_supplies,
        qcds.communication_cost,
        qcds.misc_cost,
        qcds.spare_cost,
        qcds.industrial_waste_cost,
    ])

    r.site_overhead_total = (
        r.labor_insurance
        + r.construction_insurance
        + r.stamp_cost
        + r.receipt_cost
        + r.special_insurance
        + r.site_personnel_cost
        + r.fixed_overhead
    )

    # C: 工事費合計 (A + B)  ※ A は取決見通→実行予算フォールバック
    eff_dc = r.direct_cost_agreed if r.direct_cost_agreed > 0 else r.direct_cost_budget
    r.construction_cost_total = eff_dc + r.site_overhead_total

    # D: 工事部経費（project_price ベース）
    r.construction_dept_overhead = round(pp * float(qcds.common_overhead_rate or 0))

    # E: 共通経費（project_price ベース）
    r.shared_overhead = round(pp * float(qcds.shared_overhead_rate or 0))

    # F: 原価合計
    r.total_cost = r.construction_cost_total + r.construction_dept_overhead + r.shared_overhead

    # G: 一般管理費（project_price ベース）
    r.general_admin_cost = round(pp * float(qcds.general_admin_rate or 0))

    # H: 営業利益
    r.operating_profit = pp - r.total_cost - r.general_admin_cost
    r.operating_profit_rate = r.operating_profit / pp if pp else 0.0

    # I: 目標営業利益
    r.target_operating_profit = round(pp * float(qcds.target_operating_profit_rate or 0))

    return r


# 標準項目キーと QCDSCalcResult フィールドのマッピング
_SYSTEM_FIELDS = {
    "labor_insurance",
    "construction_insurance",
    "stamp_cost",
    "receipt_cost",
    "special_insurance",
    "fixed_overhead",
    "site_personnel_cost",
    "construction_dept_overhead",
    "shared_overhead",
    "general_admin_cost",
}


def apply_expense_item_overrides(
    r: QCDSCalcResult,
    expense_items: list["QCDSExpenseItem"],
    project_price: float,
) -> None:
    """経費行の上書き値・カスタム行をQCDSCalcResultに反映し、依存合計値を再計算する。

    - system_key を持つ標準項目で amount_override が設定された場合は対応フィールドを置換する。
    - is_custom=True の行は section に応じて各合計に加算する。
    """
    if not expense_items:
        return

    # 標準項目の上書き適用
    any_override = False
    for item in expense_items:
        if (
            item.system_key
            and item.system_key in _SYSTEM_FIELDS
            and item.amount_override is not None
        ):
            setattr(r, item.system_key, float(item.amount_override))
            any_override = True

    # カスタム行の合計（セクション別）
    custom_b = sum(
        float(item.amount_override or 0)
        for item in expense_items
        if item.is_custom and item.section in ("B_site", "B_dept")
    )
    custom_c = sum(
        float(item.amount_override or 0)
        for item in expense_items
        if item.is_custom and item.section == "C"
    )

    if not any_override and custom_b == 0 and custom_c == 0:
        return

    pp = project_price or 0.0

    # site_overhead_total を再計算（カスタムB行を加算）
    r.site_overhead_total = (
        r.labor_insurance
        + r.construction_insurance
        + r.stamp_cost
        + r.receipt_cost
        + r.special_insurance
        + r.site_personnel_cost
        + r.fixed_overhead
        + custom_b
    )

    # 工事費合計を再計算（直接工事費は既存の計算値を参照）
    eff_dc = r.direct_cost_agreed if r.direct_cost_agreed > 0 else r.direct_cost_budget
    r.construction_cost_total = eff_dc + r.site_overhead_total

    # 原価合計を再計算
    r.total_cost = (
        r.construction_cost_total
        + r.construction_dept_overhead
        + r.shared_overhead
    )

    # 一般管理費 + カスタムC行
    r.general_admin_cost += custom_c

    # 営業利益を再計算
    r.operating_profit = pp - r.total_cost - r.general_admin_cost
    r.operating_profit_rate = r.operating_profit / pp if pp else 0.0
