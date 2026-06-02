"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { fmtYen } from "@/lib/format";

const fmt = fmtYen;

// ───────────────────────────────────────────────
// 型定義（page.tsx でも使用するため export）
// ───────────────────────────────────────────────

export interface QuoteSection {
  id: string;
  section_letter: string;
  section_name: string;
  row_no: number;
  amount: number | null;
}

export interface QuoteItem {
  id: string;
  row_no: number;
  item_name: string | null;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  cost_price: number | null;
  unit_price: number | null;
  amount: number | null;
  remarks: string | null;
  version_id: string | null;
  section_id: string | null;
}

// ───────────────────────────────────────────────
// 明細行コンポーネント
// ───────────────────────────────────────────────

interface ItemRowProps {
  item: QuoteItem;
  onUpdate: (updated: QuoteItem) => void;
  onDelete: () => void;
  saving: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function ItemRow({ item, onUpdate, onDelete, saving, selected, onToggleSelect }: ItemRowProps) {
  const [local, setLocal] = useState<QuoteItem>(item);
  const prevId = useRef(item.id);

  useEffect(() => {
    if (prevId.current !== item.id) {
      setLocal(item);
      prevId.current = item.id;
    }
  }, [item]);

  const handleChange = (field: keyof QuoteItem, raw: string) => {
    const numFields: (keyof QuoteItem)[] = ["quantity", "unit_price", "cost_price", "amount"];
    const val = numFields.includes(field) ? (raw === "" ? null : parseFloat(raw)) : raw;
    const updated: QuoteItem = { ...local, [field]: val };
    if (field === "quantity" || field === "unit_price") {
      const q = field === "quantity" ? (val as number | null) : local.quantity;
      const u = field === "unit_price" ? (val as number | null) : local.unit_price;
      updated.amount = q != null && u != null ? Math.round(q * u) : null;
    }
    setLocal(updated);
  };

  const handleBlur = () => {
    if (JSON.stringify(local) !== JSON.stringify(item)) {
      onUpdate(local);
    }
  };

  const cellStyle: React.CSSProperties = {
    padding: "2px 4px",
    border: "none",
    borderBottom: "1px solid var(--c-border)",
    background: "transparent",
    fontSize: 12,
    color: "var(--c-text)",
    width: "100%",
  };

  const numStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: "right",
    fontFamily: "var(--ff-mono)",
  };

  return (
    <tr style={{ background: selected ? "color-mix(in oklab, var(--c-danger) 6%, var(--c-surface))" : "var(--c-surface)" }}>
      <td style={{ padding: "2px 4px", borderBottom: "1px solid var(--c-border)", textAlign: "center", fontSize: 11, color: "var(--c-text-muted)", width: 28 }}>
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect} style={{ cursor: "pointer" }} />
      </td>
      <td style={{ padding: 0, minWidth: 140 }}>
        <input style={cellStyle} value={local.item_name || ""} onChange={e => handleChange("item_name", e.target.value)} onBlur={handleBlur} disabled={saving} placeholder="工事項目" />
      </td>
      <td style={{ padding: 0, minWidth: 100 }}>
        <input style={cellStyle} value={local.spec || ""} onChange={e => handleChange("spec", e.target.value)} onBlur={handleBlur} disabled={saving} placeholder="仕様" />
      </td>
      <td style={{ padding: 0, width: 48 }}>
        <input style={{ ...cellStyle, textAlign: "center" }} value={local.unit || ""} onChange={e => handleChange("unit", e.target.value)} onBlur={handleBlur} disabled={saving} placeholder="単位" />
      </td>
      <td style={{ padding: 0, width: 64 }}>
        <input style={numStyle} type="number" value={local.quantity ?? ""} onChange={e => handleChange("quantity", e.target.value)} onBlur={handleBlur} disabled={saving} placeholder="0" />
      </td>
      <td style={{ padding: 0, width: 80 }}>
        <input style={numStyle} type="number" value={local.unit_price ?? ""} onChange={e => handleChange("unit_price", e.target.value)} onBlur={handleBlur} disabled={saving} placeholder="0" />
      </td>
      <td style={{ padding: "2px 6px", width: 88, textAlign: "right", fontFamily: "var(--ff-mono)", fontSize: 12, borderBottom: "1px solid var(--c-border)", fontWeight: 600 }}>
        {local.amount != null ? local.amount.toLocaleString() : "—"}
      </td>
      <td style={{ padding: 0, minWidth: 60 }}>
        <input style={cellStyle} value={local.remarks || ""} onChange={e => handleChange("remarks", e.target.value)} onBlur={handleBlur} disabled={saving} placeholder="備考" />
      </td>
      <td style={{ padding: "2px 4px", width: 28, borderBottom: "1px solid var(--c-border)" }}>
        <button
          onClick={onDelete}
          disabled={saving}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2, display: "flex" }}
          title="削除"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ───────────────────────────────────────────────
// セクションブロックコンポーネント
// ───────────────────────────────────────────────

export interface SectionBlockProps {
  section: QuoteSection;
  items: QuoteItem[];
  onDeleteSection: () => void;
  onUpdateSection: (letter: string, name: string) => void;
  onUpdateItem: (item: QuoteItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: (sectionId: string) => void;
  saving: boolean;
  sectionSelected?: boolean;
  selectedItemIds?: Set<string>;
  onToggleSection?: () => void;
  onToggleItem?: (id: string) => void;
}

export function SectionBlock({
  section,
  items,
  onDeleteSection,
  onUpdateSection,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  saving,
  sectionSelected,
  selectedItemIds,
  onToggleSection,
  onToggleItem,
}: SectionBlockProps) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editLetter, setEditLetter] = useState(section.section_letter);
  const [editName, setEditName] = useState(section.section_name);
  const sectionTotal = items.reduce((s, i) => s + (i.amount ?? 0), 0);

  useEffect(() => {
    setEditLetter(section.section_letter);
    setEditName(section.section_name);
  }, [section.section_letter, section.section_name]);

  const handleSaveEdit = () => {
    onUpdateSection(editLetter, editName);
    setEditing(false);
  };

  return (
    <div className="card" style={{ overflow: "hidden", marginBottom: 8, outline: sectionSelected ? "2px solid var(--c-danger)" : undefined }}>
      {/* ヘッダ */}
      <div
        onClick={() => !editing && setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          cursor: editing ? "default" : "pointer",
          borderBottom: open ? "1px solid var(--c-border)" : "none",
          background: sectionSelected ? "color-mix(in oklab, var(--c-danger) 6%, var(--c-surface-2))" : "var(--c-surface-2)",
        }}
      >
        <input
          type="checkbox"
          checked={items.length > 0 && items.every(i => selectedItemIds?.has(i.id))}
          onChange={e => { e.stopPropagation(); onToggleSection?.(); }}
          onClick={e => e.stopPropagation()}
          style={{ cursor: "pointer" }}
          title="この大項目の全明細を選択"
        />
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {editing ? (
          <>
            <input
              value={editLetter}
              onChange={e => setEditLetter(e.target.value.toUpperCase().slice(0, 3))}
              onClick={e => e.stopPropagation()}
              style={{ width: 36, fontSize: 13, fontWeight: 700, padding: "2px 4px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", textAlign: "center" }}
            />
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, fontSize: 13, padding: "2px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)" }}
            />
            <button
              onClick={e => { e.stopPropagation(); handleSaveEdit(); }}
              disabled={saving}
              style={{ background: "var(--c-primary)", border: "none", cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: "var(--r-md)", whiteSpace: "nowrap" }}
            >
              保存
            </button>
            <button
              onClick={e => { e.stopPropagation(); setEditLetter(section.section_letter); setEditName(section.section_name); setEditing(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 11, padding: "2px 4px" }}
            >
              取消
            </button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--c-primary)", minWidth: 24 }}>
              {section.section_letter}
            </span>
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{section.section_name}</span>
            <span style={{ fontSize: 12, fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)" }}>
              小計 {fmt(sectionTotal)}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setEditing(true); }}
              disabled={saving}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2, display: "flex" }}
              title="大項目を編集"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDeleteSection(); }}
              disabled={saving}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2, display: "flex" }}
              title="大項目を削除"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      {open && (
        <>
          {/* 明細テーブル */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--c-surface-2)" }}>
                  {["No", "工事項目", "仕様", "単位", "数量", "単価", "金額", "備考", ""].map((h, i) => (
                    <th key={i} style={{ padding: "4px 6px", fontSize: 10, fontWeight: 600, color: "var(--c-text-muted)", textAlign: i >= 4 && i <= 6 ? "right" : "left", borderBottom: "2px solid var(--c-border)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onUpdate={onUpdateItem}
                    onDelete={() => onDeleteItem(item.id)}
                    saving={saving}
                    selected={selectedItemIds?.has(item.id)}
                    onToggleSelect={() => onToggleItem?.(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {/* 行追加ボタン */}
          <div style={{ padding: "6px 12px", borderTop: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
            <button
              onClick={() => onAddItem(section.id)}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--c-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <Plus size={12} /> 行を追加
            </button>
          </div>
        </>
      )}
    </div>
  );
}
