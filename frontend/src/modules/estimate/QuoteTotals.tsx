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
  editingDiscount,
  setEditingDiscount,
  discountInput,
  setDiscountInput,
  handleSaveDiscount,
  sectionItems,
}: QuoteTotalsProps) {
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
