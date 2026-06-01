"use client";

import { Fragment } from "react";
import type {
  DirectWorkInput,
  QCDSResponse,
  QCDSCategory,
} from "@/types/qcds";
import type { ScanResultItem } from "@/types/scan";

// ───────────────────────────────────────────────
// 直接工事費 セクション定義
// ───────────────────────────────────────────────
const COLS: { category: QCDSCategory; label: string; subtotalLabel: string }[] = [
  { category: "subcontract", label: "外注業者名", subtotalLabel: "A-1 外注取決計" },
  { category: "material",    label: "資材業者名", subtotalLabel: "A-2 資材計" },
  { category: "other",       label: "その他",     subtotalLabel: "A-3 その他計" },
];

const EMPTY_MIN = 4;

function getColIndices(
  works: DirectWorkInput[],
  category: QCDSCategory,
): { idx: number; isFilled: boolean }[] {
  const filled = works
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.category === category || (category === "subcontract" && w.category == null && (w.vendor_name_snapshot || w.budget_amount != null)))
    .map(({ i }) => ({ idx: i, isFilled: true }));
  const available = works
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => !w.category && !w.vendor_name_snapshot && !w.budget_amount)
    .map(({ i }) => ({ idx: i, isFilled: false }));
  const needed = Math.max(0, EMPTY_MIN - filled.length);
  return [...filled, ...available.slice(0, needed)];
}

function TInput({
  val, onChange, isNum, placeholder = "",
}: {
  val: string | number | null | undefined;
  onChange: (v: string) => void;
  isNum?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={isNum ? "number" : "text"}
      value={val ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", border: "none", background: "transparent",
        fontFamily: isNum ? "var(--ff-mono)" : "inherit",
        fontSize: "inherit", padding: "0 4px", outline: "none",
        textAlign: isNum ? "right" : "left",
      }}
    />
  );
}

// ───────────────────────────────────────────────
// Props
// ───────────────────────────────────────────────
export interface QCDSDirectWorkTableProps {
  works: DirectWorkInput[];
  qcds: QCDSResponse | null;
  checkedWorkIds: Set<string>;
  setCheckedWorkIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedRows: Set<string>;
  scanItems: Record<string, ScanResultItem[]>;
  bulkDeleting: boolean;
  updateWork: (idx: number, patch: Partial<DirectWorkInput>) => void;
  handleBulkDelete: () => Promise<void>;
  handleDeleteWork: (dbWork: { id: string; row_no: number }) => Promise<void>;
  toggleRow: (workId: string, scanResultId: string) => Promise<void>;
}

// ───────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────
export function QCDSDirectWorkTable({
  works,
  qcds,
  checkedWorkIds,
  setCheckedWorkIds,
  expandedRows,
  scanItems,
  bulkDeleting,
  updateWork,
  handleBulkDelete,
  handleDeleteWork,
  toggleRow,
}: QCDSDirectWorkTableProps) {
  return (
    <>
      {/* 一括削除バー */}
      {checkedWorkIds.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 14px", marginBottom: 8,
          background: "color-mix(in oklab, var(--c-danger) 6%, var(--c-surface))",
          border: "1px solid color-mix(in oklab, var(--c-danger) 25%, var(--c-border))",
          borderRadius: "var(--r-md)", fontSize: 13,
        }}>
          <span style={{ fontWeight: 600, color: "var(--c-danger)" }}>{checkedWorkIds.size}行選択中</span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            style={{
              padding: "4px 14px", fontSize: 12, fontWeight: 600,
              background: "var(--c-danger)", color: "#fff",
              border: "none", borderRadius: "var(--r-md)", cursor: "pointer",
            }}
          >{bulkDeleting ? "削除中…" : "選択行を削除"}</button>
          <button
            onClick={() => setCheckedWorkIds(new Set())}
            style={{ padding: "4px 10px", fontSize: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer" }}
          >選択解除</button>
        </div>
      )}

      <div className="a-table">
        {COLS.map(({ category, label, subtotalLabel }) => {
          const colItems = getColIndices(works, category);
          const subtotal = colItems
            .filter(ci => ci.isFilled)
            .reduce((s, ci) => s + (works[ci.idx].budget_amount ?? 0), 0);
          return (
            <div key={category}>
              <table className="qtbl">
                <thead>
                  <tr>
                    <th style={{ width: 22, textAlign: "center", padding: "4px 2px" }}>
                      <input
                        type="checkbox"
                        title="このカラムの全行を選択"
                        checked={colItems.filter(ci => ci.isFilled && qcds?.direct_works.find(d => d.row_no === works[ci.idx].row_no))
                          .every(ci => {
                            const d = qcds?.direct_works.find(dw => dw.row_no === works[ci.idx].row_no);
                            return d && checkedWorkIds.has(d.id);
                          }) && colItems.filter(ci => ci.isFilled && qcds?.direct_works.find(d => d.row_no === works[ci.idx].row_no)).length > 0}
                        onChange={e => {
                          const dbIds = colItems
                            .filter(ci => ci.isFilled)
                            .map(ci => qcds?.direct_works.find(d => d.row_no === works[ci.idx].row_no)?.id)
                            .filter(Boolean) as string[];
                          setCheckedWorkIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) dbIds.forEach(id => next.add(id));
                            else dbIds.forEach(id => next.delete(id));
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th style={{ width: 24 }}>No</th>
                    <th>{label}</th>
                    <th className="num" style={{ width: 96 }}>予算</th>
                    <th style={{ width: 22 }} />
                  </tr>
                </thead>
                <tbody>
                  {colItems.map(({ idx, isFilled }, colI) => {
                    const w = works[idx];
                    const dbWork = qcds?.direct_works.find(d => d.row_no === w.row_no);
                    const hasScan = !!dbWork?.source_scan_result_id;
                    const isExpanded = dbWork ? expandedRows.has(dbWork.id) : false;
                    return (
                      <Fragment key={idx}>
                        <tr className={!isFilled ? "muted-row" : ""} style={{ background: (dbWork && checkedWorkIds.has(dbWork.id)) ? "color-mix(in oklab, var(--c-danger) 5%, var(--c-surface))" : undefined }}>
                          <td style={{ textAlign: "center", padding: "0 2px" }}>
                            {dbWork && isFilled && (
                              <input type="checkbox"
                                checked={checkedWorkIds.has(dbWork.id)}
                                onChange={e => setCheckedWorkIds(prev => {
                                  const next = new Set(prev);
                                  e.target.checked ? next.add(dbWork.id) : next.delete(dbWork.id);
                                  return next;
                                })}
                              />
                            )}
                          </td>
                          <td className="no">
                            {hasScan && dbWork ? (
                              <button
                                onClick={() => toggleRow(dbWork.id, dbWork.source_scan_result_id!)}
                                style={{
                                  background: "none", border: "none", cursor: "pointer",
                                  color: "var(--c-accent)", fontSize: 10, width: "100%",
                                }}
                              >
                                {isExpanded ? "▼" : "▶"}
                              </button>
                            ) : colI + 1}
                          </td>
                          <td className="editable">
                            <TInput
                              val={w.vendor_name_snapshot}
                              onChange={v => updateWork(idx, {
                                vendor_name_snapshot: v || null,
                                ...(v && !w.category ? { category } : {}),
                              })}
                            />
                          </td>
                          <td className="editable num">
                            <TInput
                              val={w.budget_amount}
                              onChange={v => updateWork(idx, {
                                budget_amount: v === "" ? null : Number(v),
                                ...(v && !w.category ? { category } : {}),
                              })}
                              isNum
                            />
                          </td>
                          <td style={{ textAlign: "center", padding: "0 2px" }}>
                            {dbWork && isFilled && (
                              <button
                                onClick={() => handleDeleteWork(dbWork)}
                                title="この行を削除"
                                style={{
                                  background: "none", border: "none", cursor: "pointer",
                                  color: "var(--c-text-subtle, var(--c-text-muted))",
                                  fontSize: 14, lineHeight: 1, padding: "2px 4px",
                                  borderRadius: "var(--r-sm)",
                                  opacity: 0.4,
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.color = "var(--c-danger)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; (e.currentTarget as HTMLButtonElement).style.color = "var(--c-text-muted)"; }}
                              >×</button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && dbWork && dbWork.source_scan_result_id && (
                          <tr key={`${idx}-scan`}>
                            <td
                              colSpan={3}
                              style={{ padding: "8px 12px", background: "var(--c-surface-2)" }}
                            >
                              {(scanItems[dbWork.source_scan_result_id] ?? []).length === 0 ? (
                                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                                  読み込み中…
                                </span>
                              ) : (
                                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr>
                                      {["品名", "数量", "単価", "金額"].map(h => (
                                        <th
                                          key={h}
                                          style={{
                                            padding: "2px 6px",
                                            textAlign: ["数量", "単価", "金額"].includes(h) ? "right" : "left",
                                            background: "var(--c-surface)",
                                            border: "1px solid var(--c-border)",
                                            fontWeight: 600,
                                            color: "var(--c-text-muted)",
                                          }}
                                        >
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {scanItems[dbWork.source_scan_result_id].map(item => (
                                      <tr key={item.id}>
                                        <td style={{ padding: "2px 6px", border: "1px solid var(--c-border)" }}>
                                          {item.item_name ?? "—"}
                                        </td>
                                        <td style={{ padding: "2px 6px", textAlign: "right", border: "1px solid var(--c-border)", fontFamily: "var(--ff-mono)" }}>
                                          {item.quantity ?? "—"}
                                        </td>
                                        <td style={{ padding: "2px 6px", textAlign: "right", border: "1px solid var(--c-border)", fontFamily: "var(--ff-mono)" }}>
                                          {item.unit_price?.toLocaleString() ?? "—"}
                                        </td>
                                        <td style={{ padding: "2px 6px", textAlign: "right", border: "1px solid var(--c-border)", fontFamily: "var(--ff-mono)", fontWeight: 600 }}>
                                          {item.amount != null ? `¥${item.amount.toLocaleString()}` : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  <tr className="subtotal">
                    <td />
                    <td colSpan={2} style={{ textAlign: "right" }}>{subtotalLabel}</td>
                    <td className="num">{subtotal > 0 ? subtotal.toLocaleString() : "—"}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </>
  );
}
