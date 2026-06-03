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

function TotalsRow({
  label, value, major, danger,
}: { label: string; value: string; major?: boolean; danger?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 14px",
      fontSize: 13,
      borderBottom: "1px solid var(--c-border)",
      background: major ? "var(--c-surface-2)" : "transparent",
      fontWeight: major ? 700 : 400,
    }}>
      <span style={{ color: danger ? "var(--c-danger)" : major ? "var(--c-text)" : "var(--c-text-muted)", fontSize: 12 }}>{label}</span>
      <span style={{ fontFamily: "var(--ff-mono)", fontWeight: major ? 700 : 600, fontSize: major ? 15 : 13, color: danger ? "var(--c-danger)" : "inherit", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
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
  const gmr = grossMarginRate ?? 0;
  const gmColor = gmr >= 25 ? "var(--c-success)" : gmr >= 15 ? "var(--c-warn)" : "var(--c-danger)";

  return (
    <>
      {/* 合計カード — totals (quote.html 準拠) */}
      <div style={{
        background: "var(--c-surface)", border: "1px solid var(--c-border)",
        borderRadius: "var(--r-lg)", overflow: "hidden",
      }}>
        {/* 御見積金額ヘッダー（濃紺） */}
        <div style={{ background: "var(--c-primary)", color: "#fff", padding: "11px 14px" }}>
          <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: "0.04em", fontWeight: 600 }}>御見積金額（税込）</div>
          <div style={{ fontFamily: "var(--ff-mono)", fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {fmt(total)}
          </div>
          {quoteNumber && (
            <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--ff-mono)", marginTop: 4 }}>
              {quoteNumber}
            </div>
          )}
        </div>

        {/* 小計 */}
        <TotalsRow label="小計（税抜）" value={fmt(subtotal)} />

        {/* 値引き */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px", fontSize: 13, borderBottom: "1px solid var(--c-border)",
        }}>
          <span style={{ fontSize: 12, color: "var(--c-danger)" }}>値引</span>
          {editingDiscount ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--c-danger)" }}>−¥</span>
              <input
                autoFocus
                type="number"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                onBlur={handleSaveDiscount}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSaveDiscount();
                  if (e.key === "Escape") setEditingDiscount(false);
                }}
                style={{
                  width: 90, fontSize: 12, fontFamily: "var(--ff-mono)",
                  textAlign: "right", padding: "1px 4px",
                  border: "1px solid var(--c-danger)", borderRadius: "var(--r-md)",
                  background: "var(--c-surface)",
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => { setDiscountInput(String(discount)); setEditingDiscount(true); }}
              style={{
                fontSize: 13, fontFamily: "var(--ff-mono)",
                color: discount > 0 ? "var(--c-danger)" : "var(--c-text-muted)",
                background: "none", border: "1px dashed transparent",
                borderRadius: "var(--r-md)", padding: "1px 4px", cursor: "pointer",
              }}
              title="クリックして値引額を編集"
            >
              {discount > 0 ? `−${fmt(discount)}` : "＋ 値引を追加"}
            </button>
          )}
        </div>

        {/* 消費税 */}
        <TotalsRow label="消費税（10%）" value={fmt(tax)} />

        {/* 合計 major */}
        <TotalsRow label="合計（税込）" value={fmt(total)} major />

        {/* 粗利ゲージ — accent（ティール）背景 */}
        <div style={{
          padding: "12px 14px", borderBottom: "1px solid var(--c-border)",
          background: "color-mix(in oklab, var(--c-accent, #0E7C7B) 6%, var(--c-surface))",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 600, letterSpacing: "0.04em" }}>
              予想営業利益率
            </span>
            {grossMarginRate !== null ? (
              <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, fontSize: 18, color: gmColor }}>
                {grossMarginRate.toFixed(1)}%
              </span>
            ) : (
              <span style={{ fontFamily: "var(--ff-mono)", fontSize: 18, fontWeight: 700, color: "var(--c-text-muted)" }}>—</span>
            )}
          </div>
          {grossMarginRate !== null ? (
            <>
              <div style={{ height: 6, background: "var(--c-surface-3)", borderRadius: "var(--r-pill)", marginTop: 6, position: "relative", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, gmr / 30 * 100))}%`, background: gmColor, borderRadius: "var(--r-pill)", transition: "width 0.4s ease" }} />
                {/* 目標ライン @ 10% */}
                <div style={{ position: "absolute", top: -3, bottom: -3, width: 2, left: "33.3%", background: "var(--c-text)", opacity: 0.4 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--c-text-subtle)", fontFamily: "var(--ff-mono)", marginTop: 3 }}>
                <span>0%</span>
                <span>目標 10%</span>
                <span>30%</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 6 }}>
                原価（QCDS） <strong>{fmt(qcdsCost)}</strong> &nbsp;·&nbsp; 粗利 <strong>{fmt(grossProfit)}</strong>
              </div>
            </>
          ) : grossProfitMsg ? (
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 4 }}>{grossProfitMsg}</div>
          ) : null}
        </div>

        {/* 大項目別内訳 */}
        {sections.length > 0 && (
          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 8 }}>
              大項目別内訳
            </div>
            {sections.map(section => {
              const secTotal = sectionItems(section.id).reduce((s, i) => s + (i.amount ?? 0), 0);
              return (
                <div key={section.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                  <span>
                    <span style={{ fontWeight: 700, color: "var(--c-primary)", marginRight: 4 }}>{section.section_letter}</span>
                    {section.section_name}
                  </span>
                  <span style={{ fontFamily: "var(--ff-mono)", fontVariantNumeric: "tabular-nums" }}>{fmt(secTotal)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
