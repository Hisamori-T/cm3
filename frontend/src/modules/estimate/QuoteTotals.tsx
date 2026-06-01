"use client";

import { fmtYen } from "@/lib/format";
import type { QuoteSection, QuoteItem } from "@/modules/estimate/SectionBlock";

const fmt = fmtYen;

export interface QuoteTotalsProps {
  quoteNumber: string | null;
  sections: QuoteSection[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  grossMarginRate: number | null;
  grossProfit: number | null;
  grossProfitMsg: string | null;
  qcdsCost: number | null;
  editingDiscount: boolean;
  setEditingDiscount: (v: boolean) => void;
  discountInput: string;
  setDiscountInput: (v: string) => void;
  handleSaveDiscount: () => void;
  sectionItems: (sectionId: string) => QuoteItem[];
}

export function QuoteTotals({
  quoteNumber,
  sections,
  subtotal,
  discount,
  tax,
  total,
  grossMarginRate,
  grossProfit,
  grossProfitMsg,
  qcdsCost,
  editingDiscount,
  setEditingDiscount,
  discountInput,
  setDiscountInput,
  handleSaveDiscount,
  sectionItems,
}: QuoteTotalsProps) {
  return (
    <>
      {/* 合計カード */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 8 }}>
        {/* 青ヘッダ */}
        <div style={{
          background: "var(--c-primary)", color: "#fff",
          padding: "10px 14px",
        }}>
          <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2 }}>見積番号</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--ff-mono)" }}>
            {quoteNumber || "（未採番）"}
          </div>
        </div>

        {/* 金額行 */}
        <div style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>小計</span>
            <span style={{ fontSize: 13, fontFamily: "var(--ff-mono)", fontWeight: 600 }}>{fmt(subtotal)}</span>
          </div>
          {/* 値引き（常時表示・クリックで編集） */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--c-danger)" }}>値引</span>
            {editingDiscount ? (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--c-danger)" }}>−¥</span>
                <input
                  autoFocus
                  type="number"
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  onBlur={handleSaveDiscount}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveDiscount(); if (e.key === "Escape") setEditingDiscount(false); }}
                  style={{ width: 90, fontSize: 12, fontFamily: "var(--ff-mono)", textAlign: "right", padding: "1px 4px", border: "1px solid var(--c-danger)", borderRadius: "var(--r-md)", background: "var(--c-surface)" }}
                />
              </div>
            ) : (
              <button
                onClick={() => { setDiscountInput(String(discount)); setEditingDiscount(true); }}
                style={{ fontSize: 13, fontFamily: "var(--ff-mono)", color: discount > 0 ? "var(--c-danger)" : "var(--c-text-muted)", background: "none", border: "1px dashed transparent", borderRadius: "var(--r-md)", padding: "1px 4px", cursor: "pointer" }}
                title="クリックして値引額を編集"
              >
                {discount > 0 ? `−${fmt(discount)}` : "＋ 値引を追加"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>消費税（10%）</span>
            <span style={{ fontSize: 13, fontFamily: "var(--ff-mono)" }}>{fmt(tax)}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            borderTop: "2px solid var(--c-primary)", paddingTop: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>合計（税込）</span>
            <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-primary)" }}>{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* 粗利ゲージ */}
      <div className="card" style={{ padding: "10px 14px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>粗利率</span>
          {grossMarginRate !== null ? (
            <span style={{
              fontSize: 14, fontWeight: 700, fontFamily: "var(--ff-mono)",
              color: grossMarginRate >= 25 ? "var(--c-success)" : grossMarginRate >= 15 ? "var(--c-warning, #f59e0b)" : "var(--c-danger)",
            }}>
              {grossMarginRate.toFixed(1)}%
            </span>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)" }}>---</span>
          )}
        </div>
        {grossMarginRate !== null ? (
          <>
            <div style={{ height: 6, borderRadius: 3, background: "var(--c-surface-2)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${Math.min(100, Math.max(0, grossMarginRate))}%`,
                background: grossMarginRate >= 25 ? "var(--c-success)" : grossMarginRate >= 15 ? "#f59e0b" : "var(--c-danger)",
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>原価（QCDS） {fmt(qcdsCost)}</span>
              <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>粗利 {fmt(grossProfit)}</span>
            </div>
          </>
        ) : grossProfitMsg ? (
          <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>{grossProfitMsg}</div>
        ) : null}
      </div>

      {/* 大項目別内訳 */}
      {sections.length > 0 && (
        <div className="card" style={{ padding: "10px 14px", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>大項目別内訳</div>
          {sections.map(section => {
            const secTotal = sectionItems(section.id).reduce((s, i) => s + (i.amount ?? 0), 0);
            const pct = subtotal > 0 ? (secTotal / subtotal) * 100 : 0;
            return (
              <div key={section.id} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 11 }}>
                    <span style={{ fontWeight: 700, color: "var(--c-primary)", marginRight: 4 }}>{section.section_letter}</span>
                    {section.section_name}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--ff-mono)" }}>{fmt(secTotal)}</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "var(--c-surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: "var(--c-primary)", opacity: 0.5 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
