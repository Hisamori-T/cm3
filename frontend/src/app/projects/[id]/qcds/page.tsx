"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import type {
  DirectWorkInput,
  ExpenseSection,
  QCDSInput,
  QCDSResponse,
} from "@/types/qcds";
import type { ScanResultItem } from "@/types/scan";
import type { ProjectDetail } from "@/types/project";
import { Button } from "@/components/ui/button";
import { QCDSDirectWorkTable } from "@/modules/estimate/QCDSDirectWorkTable";
import {
  QCDSExpensePanel,
  type LocalExpenseItem,
  SYSTEM_CALC_MAP,
  computedFormulaStr,
} from "@/modules/estimate/QCDSExpensePanel";


// ───────────────────────────────────────────────
// ユーティリティ
// ───────────────────────────────────────────────
function yen(v: number | null | undefined) {
  if (v == null || v === 0) return "—";
  return `¥${Math.round(v).toLocaleString()}`;
}
function numStr(v: number | null | undefined) {
  if (v == null) return "—";
  return Math.round(v).toLocaleString();
}
function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}
function genKey() {
  return Math.random().toString(36).slice(2);
}

const EMPTY_WORK = (row_no: number): DirectWorkInput => ({
  row_no,
  work_type: null,
  vendor_name_snapshot: null,
  category: null,
  budget_amount: null,
  agreed_amount: null,
  settlement_amount: null,
  agreement_checked: false,
  payment_completed: false,
  note: null,
});


// ───────────────────────────────────────────────
// ページ本体
// ───────────────────────────────────────────────
export default function QCDSPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [qcds, setQcds] = useState<QCDSResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [projectPrice, setProjectPrice] = useState<number | null>(null);
  const [showRates, setShowRates] = useState(false);
  const [viewRevision, setViewRevision] = useState<number>(0);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [scanItems, setScanItems] = useState<Record<string, ScanResultItem[]>>({});
  const [checkedWorkIds, setCheckedWorkIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [works, setWorks] = useState<DirectWorkInput[]>(
    Array.from({ length: 30 }, (_, i) => EMPTY_WORK(i + 1)),
  );
  const [header, setHeader] = useState<Omit<QCDSInput, "direct_works" | "expense_items">>({
    spare_cost: null,
    industrial_waste_cost: null,
    labor_insurance_rate: 0.001973,
    construction_insurance_rate: 0.002095,
    special_insurance_rate: 0.000110,
    office_supplies: 2000,
    communication_cost: 10000,
    misc_cost: 5000,
    site_staff_salary_rate: 0.035,
    common_overhead_rate: null,
    shared_overhead_rate: 0.05,
    general_admin_rate: 0.035,
    target_operating_profit_rate: 0.10,
    actual_site_personnel_cost: null,
  });

  const [expenseItems, setExpenseItems] = useState<LocalExpenseItem[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const applyQcdsData = useCallback((data: QCDSResponse) => {
    setQcds(data);
    setViewRevision(data.revision);
    // 実際の行数と30行の大きい方を確保（行が30を超えても表示できる）
    const maxRow = data.direct_works.length > 0
      ? Math.max(30, ...data.direct_works.map(dw => dw.row_no))
      : 30;
    const filled = Array.from({ length: maxRow }, (_, i) => {
      const w = data.direct_works.find(x => x.row_no === i + 1);
      return w ? { ...w } : EMPTY_WORK(i + 1);
    });
    setWorks(filled);
    setHeader({
      spare_cost: data.spare_cost,
      industrial_waste_cost: data.industrial_waste_cost,
      labor_insurance_rate: data.labor_insurance_rate,
      construction_insurance_rate: data.construction_insurance_rate,
      special_insurance_rate: data.special_insurance_rate,
      office_supplies: data.office_supplies,
      communication_cost: data.communication_cost,
      misc_cost: data.misc_cost,
      site_staff_salary_rate: data.site_staff_salary_rate,
      common_overhead_rate: data.common_overhead_rate,
      shared_overhead_rate: data.shared_overhead_rate,
      general_admin_rate: data.general_admin_rate,
      target_operating_profit_rate: data.target_operating_profit_rate,
      actual_site_personnel_cost: data.actual_site_personnel_cost,
    });
    setExpenseItems(data.expense_items.map(ei => ({ ...ei, _key: ei.id })));
    setIsDirty(false);
  }, []);

  const loadQcds = useCallback(async (revision?: number) => {
    setIsLoading(true);
    try {
      const url = revision != null
        ? `/api/v1/projects/${id}/qcds?revision=${revision}`
        : `/api/v1/projects/${id}/qcds`;
      const [data, proj] = await Promise.all([
        apiFetch<QCDSResponse>(url),
        apiFetch<ProjectDetail>(`/api/v1/projects/${id}`),
      ]);
      applyQcdsData(data);
      // 工事価格: 案件の project_price が設定されていれば優先、なければ顧客見積合計を使用
      let pp = proj.project_price ?? null;
      if (!pp) {
        try {
          const quotes = await apiFetch<{ id: string; subtotal: number | null; total_amount: number | null }[]>(
            `/api/v1/projects/${id}/quotes`
          );
          if (quotes.length > 0 && quotes[0].subtotal) {
            pp = quotes[0].subtotal;
          }
        } catch { /* fallback to null */ }
      }
      setProjectPrice(pp);
    } catch { /* handled by apiFetch */ }
    finally { setIsLoading(false); }
  }, [id, applyQcdsData]);

  useEffect(() => {
    if (!authLoading && user) loadQcds();
  }, [authLoading, user, loadQcds]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // row_no を section 内で振り直す
      const renumbered = (() => {
        const counters: Record<string, number> = {};
        return expenseItems.map(item => {
          counters[item.section] = (counters[item.section] ?? 0) + 1;
          return { ...item, row_no: counters[item.section] };
        });
      })();

      const payload: QCDSInput = {
        ...header,
        revision: qcds?.revision ?? 0,
        direct_works: works.filter(
          w => w.work_type || w.vendor_name_snapshot || w.budget_amount != null
               || w.agreed_amount != null || w.settlement_amount != null,
        ),
        expense_items: renumbered.map(({ _key, ...rest }) => rest),
      };
      const updated = await apiFetch<QCDSResponse>(`/api/v1/projects/${id}/qcds`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setQcds(updated);
      setExpenseItems(updated.expense_items.map(ei => ({ ...ei, _key: ei.id })));
      setIsDirty(false);
    } finally { setIsSaving(false); }
  };

  const updateWork = (idx: number, patch: Partial<DirectWorkInput>) => {
    setWorks(prev => prev.map((w, i) => i === idx ? { ...w, ...patch } : w));
    setIsDirty(true);
  };

  const handleBulkDelete = async () => {
    if (checkedWorkIds.size === 0) return;
    if (!confirm(`選択した ${checkedWorkIds.size} 行を削除しますか？`)) return;
    setBulkDeleting(true);
    try {
      for (const workId of Array.from(checkedWorkIds)) {
        await apiFetch(`/api/v1/projects/${id}/qcds/direct-works/${workId}`, { method: "DELETE" });
      }
      setCheckedWorkIds(new Set());
      // calc を再計算するため再取得
      await loadQcds();
    } catch (e) {
      alert(`削除失敗: ${(e as Error).message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteWork = async (dbWork: { id: string; row_no: number }) => {
    if (!confirm("この行を削除しますか？")) return;
    try {
      await apiFetch(`/api/v1/projects/${id}/qcds/direct-works/${dbWork.id}`, { method: "DELETE" });
      // calc を再計算するため再取得
      await loadQcds();
    } catch (e) {
      alert(`削除失敗: ${(e as Error).message}`);
    }
  };
  const updateHeader = (patch: Partial<typeof header>) => {
    setHeader(p => ({ ...p, ...patch }));
    setIsDirty(true);
  };
  const updateExpenseItem = (key: string, patch: Partial<LocalExpenseItem>) => {
    setExpenseItems(prev => prev.map(ei => ei._key === key ? { ...ei, ...patch } : ei));
    setIsDirty(true);
  };
  const deleteExpenseItem = (key: string) => {
    setExpenseItems(prev => prev.filter(ei => ei._key !== key));
    setIsDirty(true);
  };
  const addExpenseItem = (section: ExpenseSection) => {
    const sectionItems = expenseItems.filter(e => e.section === section);
    const maxRow = sectionItems.reduce((m, e) => Math.max(m, e.row_no), 0);
    const newItem: LocalExpenseItem = {
      _key: genKey(),
      section,
      row_no: maxRow + 1,
      system_key: null,
      item_name: "",
      formula_description: null,
      amount_override: null,
      is_custom: true,
    };
    setExpenseItems(prev => [...prev, newItem]);
    setIsDirty(true);
  };

  async function toggleRow(workId: string, scanResultId: string) {
    const next = new Set(expandedRows);
    if (next.has(workId)) {
      next.delete(workId);
    } else {
      next.add(workId);
      if (!scanItems[scanResultId]) {
        try {
          const result = await apiFetch<{ items: ScanResultItem[] }>(`/api/v1/scan/results/${scanResultId}`);
          setScanItems(prev => ({ ...prev, [scanResultId]: result.items ?? [] }));
        } catch { /* ignore */ }
      }
    }
    setExpandedRows(next);
  }

  const calc = qcds?.calc;
  const price = projectPrice ?? 0;

  const aSubcontract = works.filter(w => w.category === "subcontract").reduce((s, w) => s + (w.budget_amount ?? 0), 0);
  const aMaterial    = works.filter(w => w.category === "material").reduce((s, w) => s + (w.budget_amount ?? 0), 0);
  const aOther       = works.filter(w => w.category === "other").reduce((s, w) => s + (w.budget_amount ?? 0), 0);
  const aTotal = aSubcontract + aMaterial + aOther;

  const directCost   = calc?.direct_cost_budget ?? aTotal;
  const siteOverhead = calc?.site_overhead_total ?? 0;
  const deptOverhead = (calc?.construction_dept_overhead ?? 0) + (calc?.shared_overhead ?? 0);
  const costI  = directCost + siteOverhead;
  const costII = costI + deptOverhead;
  const generalAdmin = calc?.general_admin_cost ?? 0;
  const totalBudget  = costII + generalAdmin;

  // 経費行をセクション別に分割
  const bSiteItems = expenseItems.filter(e => e.section === "B_site");
  const bDeptItems = expenseItems.filter(e => e.section === "B_dept");
  const cItems     = expenseItems.filter(e => e.section === "C");

  // セクション小計（表示用）
  // C区間: calc.general_admin_cost はカスタムC行の合算を含むため、カスタム行合計を差し引いて二重計上を防ぐ
  const calcSectionTotal = (items: LocalExpenseItem[]) => {
    const customAmt = items
      .filter(i => i.is_custom)
      .reduce((s, i) => s + (i.amount_override ?? 0), 0);
    return items.reduce((sum, item) => {
      if (item.is_custom) return sum + (item.amount_override ?? 0);
      if (!item.system_key || !calc) return sum;
      const rawCalc = SYSTEM_CALC_MAP[item.system_key]?.(calc) ?? 0;
      // general_admin_cost はバックエンドがカスタムC行を加算済み → 差し引いて基礎値を取得
      const effectiveCalc =
        item.system_key === "general_admin_cost" && customAmt > 0
          ? rawCalc - customAmt
          : rawCalc;
      return sum + (item.amount_override ?? effectiveCalc);
    }, 0);
  };

  const bSiteTotal = calcSectionTotal(bSiteItems);
  const bDeptTotal = calcSectionTotal(bDeptItems);
  const cTotal     = calcSectionTotal(cItems);
  const bTotal     = bSiteTotal + bDeptTotal;

  // 経費行テーブルのヘッダ
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

  // 行ナンバリング用カウンタ
  let cRowIdx = 0;

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${id}` },
        { label: "QCDS原価算定表" },
      ]}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isDirty && <span style={{ fontSize: 12, color: "var(--c-accent)" }}>未保存の変更あり</span>}
          <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>
      }
    >
      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <h1>QCDS 原価算定表</h1>
        {qcds && (
          <span className="meta">
            {new Date(qcds.updated_at).toLocaleDateString("ja-JP")} 更新
          </span>
        )}
      </div>

      {/* KPI strip */}
      <div className="qkpi" style={{ marginBottom: 12 }}>
        <div>
          <div className="k">工事価格（顧客）</div>
          <div className="v">
            <span className="yen">¥</span>
            {price > 0 ? price.toLocaleString() : "未設定"}
          </div>
          <div className="p">{price > 0 ? `税込 ¥${Math.round(price * 1.1).toLocaleString()}` : "—"}</div>
        </div>
        <div>
          <div className="k">直接工事費（A）</div>
          <div className="v">
            <span className="yen">¥</span>
            {directCost > 0 ? directCost.toLocaleString() : "—"}
          </div>
          <div className="p">{price > 0 && directCost > 0 ? `直工率 ${pct(directCost / price)}` : "—"}</div>
        </div>
        <div>
          <div className="k">経費（B）</div>
          <div className="v">
            <span className="yen">¥</span>
            {siteOverhead > 0 ? siteOverhead.toLocaleString() : "—"}
          </div>
          <div className="p">{price > 0 && siteOverhead > 0 ? pct(siteOverhead / price) : "—"}</div>
        </div>
        <div>
          <div className="k">実行予算 合計</div>
          <div className="v">
            <span className="yen">¥</span>
            {totalBudget > 0 ? totalBudget.toLocaleString() : "—"}
          </div>
          <div className="p">{price > 0 && totalBudget > 0 ? `実行比率 ${pct(totalBudget / price)}` : "—"}</div>
        </div>
        <div className="target">
          <div className="k">営業利益①</div>
          <div className="v">
            <span className="yen">¥</span>
            {calc ? calc.operating_profit.toLocaleString() : "—"}
          </div>
          <div className="p">{calc ? `営利率 ${pct(calc.operating_profit_rate)}` : "—"}</div>
        </div>
      </div>

      {/* Section A */}
      <div className="sec">
        <div className="sec-head">
          <span className="badge-letter">A</span>
          <div>
            <div className="tt">直接工事</div>
            <div className="sub">外注 / 資材 / その他 · 業者見積から自動取込可</div>
          </div>
          <div className="stat">
            <span><span className="k">外注計</span><span className="v">{aSubcontract > 0 ? yen(aSubcontract) : "—"}</span></span>
            <span><span className="k">資材計</span><span className="v">{aMaterial > 0 ? yen(aMaterial) : "—"}</span></span>
            <span><span className="k">その他計</span><span className="v">{aOther > 0 ? yen(aOther) : "—"}</span></span>
            <span>
              <span className="k">A 計</span>
              <span className="v" style={{ color: "var(--c-accent)" }}>
                {aTotal > 0 ? yen(aTotal) : "—"}
              </span>
            </span>
          </div>
        </div>

        <QCDSDirectWorkTable
          works={works}
          qcds={qcds}
          checkedWorkIds={checkedWorkIds}
          setCheckedWorkIds={setCheckedWorkIds}
          expandedRows={expandedRows}
          scanItems={scanItems}
          bulkDeleting={bulkDeleting}
          updateWork={updateWork}
          handleBulkDelete={handleBulkDelete}
          handleDeleteWork={handleDeleteWork}
          toggleRow={toggleRow}
        />

        <table className="qtbl" style={{ borderTop: "1.5px solid var(--c-border-strong)" }}>
          <tbody>
            <tr className="grand">
              <td style={{ width: "55%", borderRight: "1px solid var(--c-border)", paddingLeft: 14 }}>
                A 直接工事費合計　A = A-1 + A-2 + A-3
              </td>
              <td style={{ width: 140, textAlign: "right" }}>工事費率</td>
              <td className="num" style={{ width: 80 }}>
                {price > 0 && aTotal > 0 ? pct(aTotal / price) : "—"}
              </td>
              <td className="num" style={{ width: 120 }}>
                {aTotal > 0 ? `¥${aTotal.toLocaleString()}` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <QCDSExpensePanel
        bSiteItems={bSiteItems}
        bDeptItems={bDeptItems}
        bSiteTotal={bSiteTotal}
        bDeptTotal={bDeptTotal}
        bTotal={bTotal}
        calc={calc}
        header={header}
        price={price}
        updateExpenseItem={updateExpenseItem}
        deleteExpenseItem={deleteExpenseItem}
        addExpenseItem={addExpenseItem}
      />

      {/* Profit ladder */}
      <div className="sec">
        <div className="sec-head">
          <span className="badge-letter" style={{ background: "var(--c-status-progress)" }}>利</span>
          <div>
            <div className="tt">直工・工事原価 階段</div>
            <div className="sub">A + B から直工率・原価率・粗利率を自動計算</div>
          </div>
          <div className="stat">
            <span>
              <span className="k">粗利</span>
              <span className="v" style={{ color: "var(--c-accent)" }}>
                {calc ? yen(calc.operating_profit) : "—"}
              </span>
            </span>
            <span>
              <span className="k">粗利率</span>
              <span className="v" style={{ color: "var(--c-accent)" }}>
                {calc ? pct(calc.operating_profit_rate) : "—"}
              </span>
            </span>
          </div>
        </div>
        <div className="ladder">
          <div style={{ background: "var(--c-surface-2)", color: "var(--c-text)", fontWeight: 600, justifyContent: "center", fontSize: 11 }}>
            区分
          </div>
          <div className="col-header">直工</div>
          <div className="col-header">工事原価Ⅰ (A+B現場経費)</div>
          <div className="col-header">工事原価Ⅱ (A+B全部)</div>

          <div className="label-col">工事費</div>
          <div><div className="ll"><span className="nm">直工原価</span><span className="vv">{directCost > 0 ? `¥${directCost.toLocaleString()}` : "—"}</span></div></div>
          <div><div className="ll"><span className="nm">工事原価</span><span className="vv">{costI > 0 ? `¥${costI.toLocaleString()}` : "—"}</span></div></div>
          <div><div className="ll"><span className="nm">工事原価</span><span className="vv">{costII > 0 ? `¥${costII.toLocaleString()}` : "—"}</span></div></div>

          <div className="label-col">原価率</div>
          <div><div className="ll"><span className="nm">直工率</span><span className="vv">{price > 0 && directCost > 0 ? pct(directCost / price) : "—"}</span></div></div>
          <div><div className="ll"><span className="nm">原価率</span><span className="vv">{price > 0 && costI > 0 ? pct(costI / price) : "—"}</span></div></div>
          <div><div className="ll"><span className="nm">原価率</span><span className="vv">{price > 0 && costII > 0 ? pct(costII / price) : "—"}</span></div></div>

          <div className="label-col highlight">粗利益</div>
          <div className="highlight"><div className="ll"><span className="nm">直工利益</span><span className="vv">{price > 0 && directCost > 0 ? `¥${(price - directCost).toLocaleString()}` : "—"}</span></div></div>
          <div className="highlight"><div className="ll"><span className="nm">粗利益</span><span className="vv">{price > 0 && costI > 0 ? `¥${(price - costI).toLocaleString()}` : "—"}</span></div></div>
          <div className="highlight"><div className="ll"><span className="nm">粗利益</span><span className="vv">{price > 0 && costII > 0 ? `¥${(price - costII).toLocaleString()}` : "—"}</span></div></div>

          <div className="label-col highlight" style={{ borderBottom: "none" }}>粗利率</div>
          <div className="highlight" style={{ borderBottom: "none" }}>
            <div className="ll">
              <span className="nm">直工利益率</span>
              <span className="vv" style={{ color: "var(--c-accent)" }}>
                {price > 0 && directCost > 0 ? pct((price - directCost) / price) : "—"}
              </span>
            </div>
          </div>
          <div className="highlight" style={{ borderBottom: "none" }}>
            <div className="ll">
              <span className="nm">粗利率</span>
              <span className="vv" style={{ color: "var(--c-accent)" }}>
                {price > 0 && costI > 0 ? pct((price - costI) / price) : "—"}
              </span>
            </div>
          </div>
          <div className="highlight" style={{ borderBottom: "none" }}>
            <div className="ll">
              <span className="nm">粗利率</span>
              <span className="vv" style={{ color: "var(--c-accent)" }}>
                {price > 0 && costII > 0 ? pct((price - costII) / price) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section C + Scenario */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* ─── Section C: その他経費（一般管理費・編集可能） ─── */}
        <div className="sec" style={{ marginBottom: 0 }}>
          <div className="sec-head">
            <span className="badge-letter" style={{ background: "var(--c-status-billed)" }}>C</span>
            <div>
              <div className="tt">その他経費</div>
              <div className="sub">一般管理費・追加費用</div>
            </div>
            <div className="stat">
              <span>
                <span className="k">C 計</span>
                <span className="v">{cTotal > 0 ? yen(cTotal) : "—"}</span>
              </span>
            </div>
          </div>
          <table className="qtbl">
            {expenseTableHead}
            <tbody>
              {cItems.map(item => {
                cRowIdx++;
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
                    rowIndex={cRowIdx}
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
                    onClick={() => addExpenseItem("C")}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--c-accent)", fontSize: 11, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    ＋ 行を追加
                  </button>
                </td>
              </tr>
              <tr className="subtotal">
                <td colSpan={3} style={{ textAlign: "right" }}>C 計</td>
                <td className="num">{cTotal > 0 ? numStr(cTotal) : "—"}</td>
                <td />
              </tr>
              <tr className="grand">
                <td colSpan={3} style={{ textAlign: "right" }}>実行予算 合計 (A+B+C)</td>
                <td className="num">
                  {calc ? numStr(calc.total_cost + calc.general_admin_cost) : "—"}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── 顧客提出価格試算表 ─── */}
        <div className="sec" style={{ marginBottom: 0 }}>
          <div className="sec-head">
            <span className="badge-letter" style={{ background: "var(--c-status-done)" }}>$</span>
            <div>
              <div className="tt">顧客提出価格試算表</div>
              <div className="sub">実行比率ごとの工事価格・営業利益</div>
            </div>
          </div>
          <table className="scenario">
            <thead>
              <tr>
                <th>実行比率</th>
                <th>工事原価Ⅱ</th>
                <th>工事価格</th>
                <th>営業利益①</th>
                <th>営利率</th>
              </tr>
            </thead>
            <tbody>
              {[1.03, 1.00, 0.99, 0.98, 0.97].map(ratio => {
                const base = costII + generalAdmin;
                const scenarioPrice = base > 0 ? Math.round(base / ratio) : 0;
                const profitRate = 1 - ratio;
                const profit = Math.round(scenarioPrice * profitRate);
                const label =
                  ratio === 1.03 ? "103% → 粗利益 0"
                  : ratio === 1.00 ? "100% → 営利 0"
                  : `${Math.round((1 - ratio) * 100)}% 粗利`;
                return (
                  <tr key={ratio}>
                    <td>{label}</td>
                    <td>{base > 0 ? base.toLocaleString() : "—"}</td>
                    <td>{scenarioPrice > 0 ? scenarioPrice.toLocaleString() : "—"}</td>
                    <td>{profit !== 0 ? profit.toLocaleString() : "0"}</td>
                    <td>{(profitRate * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
              {price > 0 && (
                <tr className="on">
                  <td>
                    顧客提出
                    {price > 0 && costII + generalAdmin > 0
                      ? ` (${pct((costII + generalAdmin) / price)})`
                      : ""}
                  </td>
                  <td>{costII > 0 ? costII.toLocaleString() : "—"}</td>
                  <td>{price.toLocaleString()}</td>
                  <td>{calc ? calc.operating_profit.toLocaleString() : "—"}</td>
                  <td>{calc ? pct(calc.operating_profit_rate) : "—"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate settings (collapsible) */}
      <div className="sec" style={{ marginBottom: 0 }}>
        <div
          className="sec-head"
          style={{ cursor: "pointer" }}
          onClick={() => setShowRates(r => !r)}
        >
          <span className="badge-letter" style={{ background: "var(--c-text-muted)" }}>設</span>
          <div>
            <div className="tt">経費率・固定費設定</div>
            <div className="sub">各種率・固定費の調整（経費行の自動計算に反映）</div>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--c-text-muted)" }}>
            {showRates ? "▲ 閉じる" : "▼ 開く"}
          </span>
        </div>
        {showRates && (
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 24px" }}>
              {([
                { label: "現場担当者給与率", key: "site_staff_salary_rate", isPct: true },
                { label: "工事部経費率",     key: "common_overhead_rate",  isPct: true },
                { label: "共通経費率",       key: "shared_overhead_rate",  isPct: true },
                { label: "一般管理費率",     key: "general_admin_rate",    isPct: true },
                { label: "目標営業利益率",   key: "target_operating_profit_rate", isPct: true },
                { label: "労災保険料率",     key: "labor_insurance_rate",        isPct: true },
                { label: "工事保険料率",     key: "construction_insurance_rate", isPct: true },
                { label: "特殊保険料率",     key: "special_insurance_rate",      isPct: true },
                { label: "事務用品費",       key: "office_supplies",       isPct: false },
                { label: "通信交通費",       key: "communication_cost",    isPct: false },
                { label: "雑費",             key: "misc_cost",             isPct: false },
                { label: "実際の現場人件費", key: "actual_site_personnel_cost", isPct: false },
              ] as { label: string; key: keyof typeof header; isPct: boolean }[]).map(({ label, key, isPct }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <label style={{ flex: 1, color: "var(--c-text-muted)" }}>{label}</label>
                  <input
                    type="number"
                    step={isPct ? "0.0001" : "1"}
                    value={header[key] ?? ""}
                    onChange={e =>
                      updateHeader({ [key]: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    style={{
                      width: 80, height: 24, fontSize: 12, textAlign: "right",
                      border: "1px solid var(--c-border)", borderRadius: "var(--r-sm)",
                      paddingRight: 4, background: "var(--c-surface)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
