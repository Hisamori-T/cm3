"use client";

import type {
  ExpenseItemInput,
  ExpenseSection,
  QCDSCalcFields,
} from "@/types/qcds";

// ───────────────────────────────────────────────
// ローカル型（page.tsx でも使用するため export）
// ───────────────────────────────────────────────
export interface LocalExpenseItem extends ExpenseItemInput {
  _key: string;
}

// ───────────────────────────────────────────────
// 自動計算マッピング
// ───────────────────────────────────────────────
export const SYSTEM_CALC_MAP: Record<string, (c: QCDSCalcFields) => number> = {
  labor_insurance:              c => c.labor_insurance,
  construction_insurance:       c => c.construction_insurance,
  stamp_cost:                   c => c.stamp_cost,
  receipt_cost:                 c => c.receipt_cost,
  special_insurance:            c => c.special_insurance,
  fixed_overhead:               c => c.fixed_overhead,
  site_personnel_cost:          c => c.site_personnel_cost,
  construction_dept_overhead:   c => c.construction_dept_overhead,
  shared_overhead:              c => c.shared_overhead,
  general_admin_cost:           c => c.general_admin_cost,
};

type HeaderForFormula = {
  labor_insurance_rate?: number;
  construction_insurance_rate?: number;
  special_insurance_rate?: number;
  office_supplies?: number;
  communication_cost?: number;
  misc_cost?: number;
  spare_cost?: number | null;
  industrial_waste_cost?: number | null;
  site_staff_salary_rate?: number;
  common_overhead_rate?: number | null;
  shared_overhead_rate?: number;
  general_admin_rate?: number;
};

export function computedFormulaStr(
  systemKey: string,
  calc: QCDSCalcFields,
  header: HeaderForFormula,
  projectPrice: number,
): string {
  const pp = projectPrice;
  const taxIncl = Math.round(pp * 1.1);
  const r = (v: number) =>
    `${(v * 100).toFixed(4).replace(/\.?0+$/, "")}%`;
  const n = (v: number) => Math.round(v).toLocaleString();
  switch (systemKey) {
    case "labor_insurance":
      return `工事価格 ¥${n(pp)} × ${r(header.labor_insurance_rate ?? 0)}`;
    case "construction_insurance":
      return `請負金(税込) ¥${n(taxIncl)} × ${r(header.construction_insurance_rate ?? 0)}`;
    case "stamp_cost":
      return `契約金額(税込) ¥${n(taxIncl)} → 第2号文書 自動計算`;
    case "receipt_cost":
      return `受取金額(税込) ¥${n(taxIncl)} → 第17号文書 自動計算`;
    case "special_insurance":
      return `工事価格 ¥${n(pp)} × ${r(header.special_insurance_rate ?? 0)}`;
    case "fixed_overhead":
      return `事務${n(header.office_supplies ?? 0)} + 通信${n(header.communication_cost ?? 0)} + 雑費${n(header.misc_cost ?? 0)}` +
        (header.spare_cost ? ` + 予備費${n(header.spare_cost)}` : "") +
        (header.industrial_waste_cost ? ` + 産廃${n(header.industrial_waste_cost)}` : "");
    case "site_personnel_cost":
      return `工事価格 ¥${n(pp)} × ${r(header.site_staff_salary_rate ?? 0)}`;
    case "construction_dept_overhead":
      return header.common_overhead_rate
        ? `工事価格 ¥${n(pp)} × ${r(header.common_overhead_rate)}`
        : "工事部経費率 未設定";
    case "shared_overhead":
      return `工事価格 ¥${n(pp)} × ${r(header.shared_overhead_rate ?? 0)}`;
    case "general_admin_cost":
      return `工事価格 ¥${n(pp)} × ${r(header.general_admin_rate ?? 0)}`;
    default:
      return "";
  }
}

// ───────────────────────────────────────────────
// 経費行サブコンポーネント
// ───────────────────────────────────────────────
export function ExpenseRow({
  item,
  rowIndex,
  calcValue,
  effectiveFormula,
  onChange,
  onDelete,
}: {
  item: LocalExpenseItem;
  rowIndex: number;
  calcValue?: number;
  effectiveFormula?: string;
  onChange: (patch: Partial<LocalExpenseItem>) => void;
  onDelete?: () => void;
}) {
  const isSystem = !!item.system_key;
  const hasOverride = item.amount_override !== null && item.amount_override !== undefined;
  const displayAmt = hasOverride ? item.amount_override! : (calcValue ?? null);
  const isAutoCalc = isSystem && !hasOverride;

  return (
    <tr>
      <td className="no" style={{ fontSize: 11 }}>{rowIndex}</td>
      <td className="editable">
        <input
          type="text"
          value={item.item_name}
          onChange={e => onChange({ item_name: e.target.value })}
          style={{
            border: "none", background: "transparent", outline: "none",
            width: "100%", fontSize: 12, color: "var(--c-text)",
          }}
        />
      </td>
      <td className="editable">
        {effectiveFormula && (
          <div style={{
            fontSize: 10,
            color: "var(--c-accent)",
            fontFamily: "var(--ff-mono)",
            marginBottom: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {effectiveFormula}
          </div>
        )}
        <input
          type="text"
          value={item.formula_description ?? ""}
          placeholder={isSystem ? "（メモを追加）" : "計算式メモ"}
          onChange={e => onChange({ formula_description: e.target.value || null })}
          style={{
            border: "none", background: "transparent", outline: "none",
            width: "100%", fontSize: 11,
            color: effectiveFormula ? "var(--c-text-subtle)" : "var(--c-text)",
            fontStyle: effectiveFormula ? "italic" : "normal",
          }}
        />
      </td>
      <td
        className={isAutoCalc ? "computed num" : "editable num"}
        style={{ position: "relative" }}
      >
        {isAutoCalc ? (
          <button
            title="クリックして手動上書き"
            onClick={() => onChange({ amount_override: calcValue ?? 0 })}
            style={{
              background: "none", border: "none", cursor: "pointer",
              width: "100%", textAlign: "right", fontSize: 12,
              fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)",
              padding: "0 2px",
            }}
          >
            {displayAmt != null ? Math.round(displayAmt).toLocaleString() : "—"}
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <input
              type="number"
              value={item.amount_override ?? ""}
              placeholder={isSystem && calcValue != null ? String(Math.round(calcValue)) : "0"}
              onChange={e => onChange({ amount_override: e.target.value === "" ? null : Number(e.target.value) })}
              style={{
                border: "none", background: "transparent", outline: "none",
                flex: 1, fontSize: 12, textAlign: "right",
                fontFamily: "var(--ff-mono)", color: "var(--c-text)",
                minWidth: 0,
              }}
            />
            {isSystem && (
              <button
                title="自動計算に戻す"
                onClick={() => onChange({ amount_override: null })}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--c-text-subtle)", fontSize: 10, padding: "0 2px",
                  flexShrink: 0,
                }}
              >
                ↺
              </button>
            )}
          </div>
        )}
      </td>
      <td style={{ width: 24, padding: "0 2px", borderRight: "none" }}>
        {item.is_custom && onDelete && (
          <button
            onClick={onDelete}
            title="行を削除"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--c-text-subtle)", fontSize: 13, lineHeight: 1,
              display: "flex", alignItems: "center",
            }}
          >
            ×
          </button>
        )}
      </td>
    </tr>
  );
}

// ───────────────────────────────────────────────
// Props
// ───────────────────────────────────────────────
export interface QCDSExpensePanelProps {
  bSiteItems: LocalExpenseItem[];
  bDeptItems: LocalExpenseItem[];
  bSiteTotal: number;
  bDeptTotal: number;
  bTotal: number;
  calc: QCDSCalcFields | undefined;
  header: HeaderForFormula;
  price: number;
  updateExpenseItem: (key: string, patch: Partial<LocalExpenseItem>) => void;
  deleteExpenseItem: (key: string) => void;
  addExpenseItem: (section: ExpenseSection) => void;
}

// ───────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────
export function QCDSExpensePanel({
  bSiteItems,
  bDeptItems,
  bSiteTotal,
  bDeptTotal,
  bTotal,
  calc,
  header,
  price,
  updateExpenseItem,
  deleteExpenseItem,
  addExpenseItem,
}: QCDSExpensePanelProps) {
  const numStr = (v: number | null | undefined) => {
    if (v == null) return "—";
    return Math.round(v).toLocaleString();
  };
  const yen = (v: number | null | undefined) => {
    if (v == null || v === 0) return "—";
    return `¥${Math.round(v).toLocaleString()}`;
  };

  const expenseTableHead = (
    <thead>
      <tr>
        <th style={{ width: 32 }}>No</th>
        <th>振替項目</th>
        <th style={{ width: 180 }}>計算式</th>
        <th className="num" style={{ width: 110 }}>金額</th>
        <th style={{ width: 24 }} />
      </tr>
    </thead>
  );

  let bSiteRowIdx = 0;
  let bDeptRowIdx = 0;

  return (
    <div className="sec">
      <div className="sec-head">
        <span className="badge-letter" style={{ background: "var(--c-accent)" }}>B</span>
        <div>
          <div className="tt">経費関係</div>
          <div className="sub">
            振替項目・計算式は自由編集可。金額列の灰色値はクリックで上書き可。＋ボタンで行追加。
          </div>
        </div>
        <div className="stat">
          <span>
            <span className="k">B 計</span>
            <span className="v" style={{ color: "var(--c-accent)" }}>
              {bTotal > 0 ? yen(bTotal) : "—"}
            </span>
          </span>
        </div>
      </div>

      <table className="qtbl">
        {expenseTableHead}
        <tbody>
          {/* ■ 現場経費 */}
          <tr className="section-head"><td colSpan={5}>■ 現場経費</td></tr>
          {bSiteItems.map(item => {
            bSiteRowIdx++;
            const cval = item.system_key && calc
              ? (SYSTEM_CALC_MAP[item.system_key]?.(calc) ?? 0)
              : undefined;
            const ef = item.system_key && calc
              ? computedFormulaStr(item.system_key, calc, header, price)
              : undefined;
            return (
              <ExpenseRow
                key={item._key}
                item={item}
                rowIndex={bSiteRowIdx}
                calcValue={cval}
                effectiveFormula={ef || undefined}
                onChange={patch => updateExpenseItem(item._key, patch)}
                onDelete={() => deleteExpenseItem(item._key)}
              />
            );
          })}
          <tr>
            <td colSpan={5} style={{ padding: "4px 8px", borderBottom: "none" }}>
              <button
                onClick={() => addExpenseItem("B_site")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--c-accent)", fontSize: 11, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                ＋ 行を追加（現場経費）
              </button>
            </td>
          </tr>
          <tr className="subtotal">
            <td colSpan={3} style={{ textAlign: "right" }}>現場経費 小計</td>
            <td className="num">{bSiteTotal > 0 ? numStr(bSiteTotal) : "—"}</td>
            <td />
          </tr>
          {/* ■ 事業部経費 */}
          <tr className="section-head"><td colSpan={5}>■ 事業部経費</td></tr>
          {bDeptItems.map(item => {
            bDeptRowIdx++;
            const cval = item.system_key && calc
              ? (SYSTEM_CALC_MAP[item.system_key]?.(calc) ?? 0)
              : undefined;
            const ef = item.system_key && calc
              ? computedFormulaStr(item.system_key, calc, header, price)
              : undefined;
            return (
              <ExpenseRow
                key={item._key}
                item={item}
                rowIndex={bDeptRowIdx}
                calcValue={cval}
                effectiveFormula={ef || undefined}
                onChange={patch => updateExpenseItem(item._key, patch)}
                onDelete={() => deleteExpenseItem(item._key)}
              />
            );
          })}
          <tr>
            <td colSpan={5} style={{ padding: "4px 8px", borderBottom: "none" }}>
              <button
                onClick={() => addExpenseItem("B_dept")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--c-accent)", fontSize: 11, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                ＋ 行を追加（事業部経費）
              </button>
            </td>
          </tr>
          <tr className="subtotal">
            <td colSpan={3} style={{ textAlign: "right" }}>事業部経費 小計</td>
            <td className="num">{bDeptTotal > 0 ? numStr(bDeptTotal) : "—"}</td>
            <td />
          </tr>
          <tr className="grand">
            <td colSpan={3} style={{ textAlign: "right", paddingRight: 14 }}>
              B 経費関係合計
            </td>
            <td className="num">{bTotal > 0 ? numStr(bTotal) : "—"}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
