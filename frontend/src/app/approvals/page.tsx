"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { fmtYen } from "@/lib/format";

interface ApprovalStep {
  id: string;
  step_no: number;
  approver_id: string;
  approver_name: string;
  role_label: string;
  required: boolean;
  status: string;
  comment: string | null;
  decided_at: string | null;
}

interface ApprovalRequest {
  id: string;
  quote_id: string;
  requester_id: string;
  requester_name: string;
  status: string;
  request_comment: string | null;
  created_at: string;
  steps: ApprovalStep[];
}

interface MySummary {
  awaiting_my_approval: ApprovalRequest[];
  requested_by_me: ApprovalRequest[];
  rejected: ApprovalRequest[];
}

type TabKey = "awaiting" | "requested" | "rejected";

/** ステップ進捗を簡易表示。 */
function StepProgress({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {steps.map(s => {
        const isDone = s.status === "approved";
        const isCur = s.status === "pending";
        const isRej = s.status === "rejected";
        return (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: "var(--r-pill)",
            background: isDone ? "color-mix(in oklab,var(--c-success) 14%,var(--c-surface))"
              : isRej ? "color-mix(in oklab,var(--c-danger) 14%,var(--c-surface))"
              : isCur ? "color-mix(in oklab,var(--c-warn) 14%,var(--c-surface))"
              : "var(--c-surface-2)",
            fontSize: 11,
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: "50%",
              background: isDone ? "var(--c-success)" : isRej ? "var(--c-danger)" : isCur ? "var(--c-warn)" : "var(--c-surface-3)",
              color: isDone || isRej || isCur ? "#fff" : "var(--c-text-muted)",
              display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700,
            }}>{isDone ? "✓" : isRej ? "✕" : isCur ? "●" : s.step_no}</span>
            {s.role_label}
            <small style={{ color: "var(--c-text-muted)", fontFamily: "monospace" }}>{s.approver_name.split(/[\s　]/)[0]}</small>
          </div>
        );
      })}
    </div>
  );
}

/** 承認依頼カード。 */
function ApprovalCard({
  req,
  showActions,
  onApprove,
  onReject,
  onWithdraw,
}: {
  req: ApprovalRequest;
  showActions: "approve" | "withdraw" | "none";
  onApprove?: (req: ApprovalRequest) => void;
  onReject?: (req: ApprovalRequest) => void;
  onWithdraw?: (req: ApprovalRequest) => void;
}) {
  const isRejected = req.status === "rejected";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto",
      gap: 16, alignItems: "center",
      padding: "14px 18px", background: "var(--c-surface)",
      border: `1px solid ${isRejected ? "color-mix(in oklab,var(--c-danger) 35%,var(--c-border))" : "var(--c-border)"}`,
      borderLeft: isRejected ? "3px solid var(--c-danger)" : "3px solid transparent",
      borderRadius: "var(--r-lg)", marginBottom: 10, cursor: "pointer",
    }}>
      {/* アイコン */}
      <div style={{
        width: 38, height: 38, borderRadius: "var(--r-md)",
        background: isRejected ? "var(--c-danger)" : "color-mix(in oklab,var(--c-primary) 12%,var(--c-surface))",
        color: isRejected ? "#fff" : "var(--c-primary)",
        display: "grid", placeItems: "center",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <path d="M14 2v6h6"/>
        </svg>
      </div>

      {/* 案件情報 */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>見積書 承認依頼</div>
        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>
          依頼者: {req.requester_name} · {new Date(req.created_at).toLocaleDateString("ja-JP")}
        </div>
        {isRejected && req.steps.find(s => s.status === "rejected")?.comment && (
          <div style={{ fontSize: 11, color: "var(--c-danger)", marginTop: 4 }}>
            ⚠️ {req.steps.find(s => s.status === "rejected")?.comment}
          </div>
        )}
        {req.request_comment && !isRejected && (
          <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2, fontStyle: "italic" }}>「{req.request_comment}」</div>
        )}
      </div>

      {/* ステップ進捗 */}
      <StepProgress steps={req.steps} />

      {/* アクションボタン */}
      <div style={{ display: "flex", gap: 6 }}>
        {showActions === "approve" && (
          <>
            <button onClick={() => onReject?.(req)}
              style={{ padding: "5px 12px", fontSize: 12, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)" }}>
              差戻
            </button>
            <button onClick={() => onApprove?.(req)}
              style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, background: "var(--c-success)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              承認
            </button>
          </>
        )}
        {showActions === "withdraw" && (
          <button onClick={() => onWithdraw?.(req)}
            style={{ padding: "5px 12px", fontSize: 12, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)" }}>
            取下げ
          </button>
        )}
      </div>
    </div>
  );
}

/** 承認待ち一覧ページ。 */
export default function ApprovalsPage() {
  const [tab, setTab] = useState<TabKey>("awaiting");
  const [data, setData] = useState<MySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<MySummary>("/api/v1/approvals/my");
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (req: ApprovalRequest) => {
    try {
      await apiFetch(`/api/v1/approval-requests/${req.id}/decide`, {
        method: "POST", body: JSON.stringify({ action: "approve" }),
      });
      load();
    } catch (e) { alert(`エラー: ${(e as Error).message}`); }
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || !rejectComment.trim()) { alert("差戻し理由を入力してください"); return; }
    try {
      await apiFetch(`/api/v1/approval-requests/${rejectTarget.id}/decide`, {
        method: "POST", body: JSON.stringify({ action: "reject", comment: rejectComment }),
      });
      setRejectTarget(null);
      setRejectComment("");
      load();
    } catch (e) { alert(`エラー: ${(e as Error).message}`); }
  };

  const handleWithdraw = async (req: ApprovalRequest) => {
    if (!confirm("この承認依頼を取り下げますか？")) return;
    try {
      await apiFetch(`/api/v1/approval-requests/${req.id}/withdraw`, { method: "POST" });
      load();
    } catch (e) { alert(`エラー: ${(e as Error).message}`); }
  };

  const tabs: { key: TabKey; label: string; count: number; danger?: boolean }[] = [
    { key: "awaiting", label: "あなた宛", count: data?.awaiting_my_approval.length ?? 0 },
    { key: "requested", label: "依頼中", count: data?.requested_by_me.length ?? 0 },
    { key: "rejected", label: "差戻し中", count: data?.rejected.length ?? 0, danger: true },
  ];

  const currentItems =
    tab === "awaiting" ? (data?.awaiting_my_approval ?? []) :
    tab === "requested" ? (data?.requested_by_me ?? []) :
    (data?.rejected ?? []);

  return (
    <AppShell breadcrumbs={[{ label: "承認待ち" }]}>
      <div className="toolbar">
        <h1>承認待ち</h1>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)", marginLeft: 8 }}>
          あなた宛の承認・あなたが依頼中の案件
        </span>
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-border)", marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              background: "transparent", border: "none", padding: "9px 14px", cursor: "pointer",
              fontSize: 13, fontWeight: tab === t.key ? 600 : 500,
              color: tab === t.key ? "var(--c-primary)" : "var(--c-text-muted)",
              borderBottom: tab === t.key ? "2px solid var(--c-primary)" : "2px solid transparent",
              marginBottom: -1, display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: 11, padding: "0 6px", borderRadius: "var(--r-pill)",
                background: tab === t.key ? (t.danger ? "var(--c-danger)" : "var(--c-primary)") : "var(--c-surface-2)",
                color: tab === t.key ? "#fff" : "var(--c-text-muted)",
                fontFamily: "monospace", fontWeight: 600,
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>読み込み中...</div>
      ) : currentItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", display: "block" }}>
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
          </svg>
          <p>該当する承認依頼はありません</p>
        </div>
      ) : (
        <div>
          {currentItems.map(req => (
            <ApprovalCard
              key={req.id}
              req={req}
              showActions={tab === "awaiting" ? "approve" : tab === "requested" ? "withdraw" : "none"}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              onWithdraw={handleWithdraw}
            />
          ))}
        </div>
      )}

      {/* 差戻しモーダル */}
      {rejectTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setRejectTarget(null)}>
          <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", boxShadow: "0 20px 60px rgba(0,0,0,.3)", width: 480, overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--c-border)", fontWeight: 700, fontSize: 14, color: "var(--c-danger)" }}>
              見積書を差し戻す
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, padding: "8px 12px", background: "var(--c-danger-bg, color-mix(in oklab,var(--c-danger) 10%,var(--c-surface)))", borderRadius: "var(--r-md)", borderLeft: "3px solid var(--c-danger)", marginBottom: 12, lineHeight: 1.6 }}>
                差し戻すと見積書は draft 状態に戻り、依頼者に通知されます。
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>差戻し理由 <span style={{ color: "var(--c-danger)" }}>（必須）</span></label>
              <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={4}
                placeholder="差戻しの理由を入力してください..."
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "8px 10px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", resize: "vertical" }}
              />
            </div>
            <div style={{ padding: "10px 20px", borderTop: "1px solid var(--c-border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setRejectTarget(null); setRejectComment(""); }}
                style={{ padding: "6px 16px", fontSize: 12, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleRejectSubmit}
                style={{ padding: "6px 20px", fontSize: 12, fontWeight: 700, background: "var(--c-danger)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer" }}>
                差し戻す
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
