"use client";

export interface MarkupApplyConfirmProps {
  vendorName: string | null;
  oldRate: number;
  newRate: number;
  affectedCount: number;
  manualEditCount: number;
  hasApproval: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onRateOnly: () => void;
  onRateAndApply: () => void;
}

/** 掛け率変更・顧客見積再反映の確認ダイアログ。 */
export function MarkupApplyConfirmModal({
  vendorName,
  oldRate,
  newRate,
  affectedCount,
  manualEditCount,
  hasApproval,
  isSaving,
  onCancel,
  onRateOnly,
  onRateAndApply,
}: MarkupApplyConfirmProps) {
  const rateChanged = Math.abs(oldRate - newRate) > 0.0001;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--c-surface)", borderRadius: "var(--r-lg)",
          boxShadow: "0 20px 60px rgba(0,0,0,.3)", width: 440, padding: "20px 24px",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
          掛け率変更の確認
        </div>

        {/* 業者名 */}
        <div style={{ fontSize: 12, color: "var(--c-text-muted)", marginBottom: 12 }}>
          {vendorName || "（業者未設定）"}
        </div>

        {/* 掛け率変更表示 */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "var(--c-surface-2)", borderRadius: "var(--r-md)",
            padding: "10px 14px", marginBottom: 12,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>現在</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)" }}>
              ×{oldRate.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: 16, color: "var(--c-text-muted)" }}>→</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>変更後</div>
            <div
              style={{
                fontSize: 18, fontWeight: 700, fontFamily: "var(--ff-mono)",
                color: rateChanged ? "var(--c-primary)" : "var(--c-text)",
              }}
            >
              ×{newRate.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 顧客見積への影響 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>顧客見積への影響</div>

          <div
            style={{
              fontSize: 12, padding: "8px 12px",
              background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
              borderRadius: "var(--r-md)", marginBottom: 6, color: "var(--c-text)",
            }}
          >
            対象明細: <strong>{affectedCount}件</strong>
            <span style={{ color: "var(--c-text-muted)", marginLeft: 8 }}>
              （この版から反映済みの顧客明細）
            </span>
          </div>

          {manualEditCount > 0 && (
            <div
              style={{
                fontSize: 12, padding: "8px 12px",
                background: "color-mix(in oklab, var(--c-warning, #f59e0b) 10%, var(--c-surface))",
                borderRadius: "var(--r-md)", marginBottom: 6,
                color: "color-mix(in oklab, var(--c-warning, #f59e0b) 70%, var(--c-text))",
              }}
            >
              手動編集された明細 {manualEditCount}件 が上書きされます
            </div>
          )}

          {hasApproval && (
            <div
              style={{
                fontSize: 12, padding: "8px 12px",
                background: "color-mix(in oklab, var(--c-danger) 8%, var(--c-surface))",
                borderRadius: "var(--r-md)", marginBottom: 6, color: "var(--c-danger)",
              }}
            >
              承認スタンプがリセットされ、承認依頼が取り下げられます
            </div>
          )}
        </div>

        {/* ボタン */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              padding: "6px 14px", fontSize: 12,
              background: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: "var(--r-md)", cursor: "pointer",
            }}
          >キャンセル</button>
          <button
            onClick={onRateOnly}
            disabled={isSaving}
            style={{
              padding: "6px 14px", fontSize: 12,
              background: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: "var(--r-md)", cursor: isSaving ? "wait" : "pointer",
              color: "var(--c-text)",
            }}
          >掛け率のみ更新</button>
          <button
            onClick={onRateAndApply}
            disabled={isSaving || affectedCount === 0}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 600,
              background: affectedCount === 0 ? "var(--c-surface-2)" : "var(--c-primary)",
              color: affectedCount === 0 ? "var(--c-text-muted)" : "#fff",
              border: "none", borderRadius: "var(--r-md)",
              cursor: isSaving || affectedCount === 0 ? "not-allowed" : "pointer",
            }}
          >{isSaving ? "処理中..." : "掛け率更新 + 顧客見積へ反映"}</button>
        </div>
      </div>
    </div>
  );
}
