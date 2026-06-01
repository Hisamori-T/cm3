"use client";

// ───────────────────────────────────────────────
// 型（page.tsx でも使用するため export）
// ───────────────────────────────────────────────

export interface EstimateVersion {
  id: string;
  version_no: number;
  vendor_id: string | null;
  vendor_name_snapshot: string | null;
  markup_rate: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionCardProps {
  version: EstimateVersion;
  isSelected: boolean;
  onClick: () => void;
  onQcdsReflect: () => void;
  onQuoteReflect: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

// ───────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────

export function VersionCard({
  version: v,
  isSelected,
  onClick,
  onQcdsReflect,
  onQuoteReflect,
  onToggleActive,
  onDelete,
}: VersionCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--c-border)",
        cursor: "pointer",
        background: isSelected ? "var(--c-primary-50)" : "transparent",
        borderLeft: isSelected ? "3px solid var(--c-primary)" : "3px solid transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: isSelected ? "var(--c-primary)" : "var(--c-text)",
        }}>
          版 {v.version_no}
        </span>
        <span style={{
          fontSize: 10, padding: "1px 6px", borderRadius: "var(--r-pill)",
          background: v.is_active ? "var(--c-success-bg)" : "var(--c-surface-2)",
          color: v.is_active ? "var(--c-success)" : "var(--c-text-muted)",
        }}>
          {v.is_active ? "適用中" : "非適用"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--c-text)", marginBottom: 2 }}>
        {v.vendor_name_snapshot || "（業者未設定）"}
      </div>
      <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
        掛率: ×{Number(v.markup_rate).toFixed(2)}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onQcdsReflect}
          style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-primary)" }}
        >QCDSに反映</button>
        <button
          onClick={onQuoteReflect}
          style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-accent)" }}
        >顧客見積に反映</button>
        <button
          onClick={onToggleActive}
          style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-text-muted)" }}
        >{v.is_active ? "非適用に" : "適用に"}</button>
        <button
          onClick={onDelete}
          style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-danger)" }}
        >削除</button>
      </div>
    </div>
  );
}
