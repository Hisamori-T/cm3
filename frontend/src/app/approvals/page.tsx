"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";

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
  project_id: string | null;
  quote_number: string | null;
  project_name: string | null;
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
  completed: ApprovalRequest[];
}

interface LedgerApprovalPending {
  approval_id: string;
  project_id: string;
  project_number: string;
  project_name: string;
  role_label: string;
  requested_by_name: string | null;
  requested_at: string | null;
}

/** ステップ進捗チップ */
function StepChips({ steps, myUserId }: { steps: ApprovalStep[]; myUserId?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {steps.map((s, i) => {
        const isDone = s.status === "approved";
        const isRej = s.status === "rejected";
        const isCur = s.status === "pending";
        const isMe = myUserId && s.approver_id === myUserId;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-subtle)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: "var(--r-pill)", fontSize: 11,
              background: isDone ? "color-mix(in oklab,var(--c-success) 14%,var(--c-surface))"
                : isRej ? "color-mix(in oklab,var(--c-danger) 14%,var(--c-surface))"
                : isCur ? "color-mix(in oklab,var(--c-warn) 14%,var(--c-surface))"
                : "var(--c-surface-2)",
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                background: isDone ? "var(--c-success)" : isRej ? "var(--c-danger)" : isCur ? "var(--c-warn)" : "var(--c-surface-3)",
                color: isDone || isRej || isCur ? "#fff" : "var(--c-text-muted)",
                display: "grid", placeItems: "center", fontSize: 8, fontWeight: 700,
              }}>{isDone ? "✓" : isRej ? "✕" : isCur ? "●" : s.step_no}</span>
              <span style={{ color: "var(--c-text-muted)", fontSize: 10, fontWeight: 600 }}>{s.role_label}</span>
              <span style={{
                fontFamily: "monospace", fontWeight: isMe && isCur ? 700 : 500,
                color: isMe && isCur ? "var(--c-warn)" : "var(--c-text-muted)",
              }}>{isMe && isCur ? "あなた" : s.approver_name.split(/[\s　]/)[0]}</span>
              {s.decided_at && (
                <span style={{ color: "var(--c-text-subtle)", fontFamily: "monospace", fontSize: 10 }}>
                  {new Date(s.decided_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 承認依頼カード（行全体クリックでquoteへ） */
function ApprovalCard({
  req, myUserId, showActions, onApprove, onReject, onWithdraw,
}: {
  req: ApprovalRequest; myUserId?: string;
  showActions: "approve" | "withdraw" | "none";
  onApprove?: (req: ApprovalRequest) => void;
  onReject?: (req: ApprovalRequest) => void;
  onWithdraw?: (req: ApprovalRequest) => void;
}) {
  const router = useRouter();
  const isRejected = req.status === "rejected";
  const isCompleted = req.status === "approved";

  const myStep = req.steps.find(s => s.approver_id === myUserId && s.status === "pending");
  const myRole = myStep?.role_label;

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (req.project_id && req.quote_id) {
      router.push(`/projects/${req.project_id}/quote/${req.quote_id}`);
    }
  };

  const elapsed = (() => {
    const diff = Date.now() - new Date(req.created_at).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "本日";
    if (days === 1) return "昨日";
    return `${days}日前`;
  })();

  return (
    <div
      onClick={handleClick}
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr auto auto",
        gap: 14, alignItems: "center",
        padding: "12px 16px",
        background: isRejected ? "color-mix(in oklab,var(--c-danger) 5%,var(--c-surface))"
          : isCompleted ? "color-mix(in oklab,var(--c-success) 4%,var(--c-surface))"
          : "var(--c-surface)",
        border: `1px solid ${isRejected ? "color-mix(in oklab,var(--c-danger) 30%,var(--c-border))" : "var(--c-border)"}`,
        borderLeft: `3px solid ${isRejected ? "var(--c-danger)" : isCompleted ? "var(--c-success)" : myRole ? "var(--c-warn)" : "transparent"}`,
        borderRadius: "var(--r-lg)", marginBottom: 8,
        cursor: req.project_id ? "pointer" : "default",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={e => { if (req.project_id) (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-2)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {/* アイコン */}
      <div style={{
        width: 36, height: 36, borderRadius: "var(--r-md)", flexShrink: 0,
        background: isRejected ? "var(--c-danger)" : isCompleted ? "var(--c-success)" : "color-mix(in oklab,var(--c-primary) 12%,var(--c-surface))",
        color: isRejected || isCompleted ? "#fff" : "var(--c-primary)",
        display: "grid", placeItems: "center",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <path d="M14 2v6h6"/>
        </svg>
      </div>

      {/* 情報 */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>
            {req.project_name || "見積書"}
          </span>
          {req.quote_number && (
            <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontFamily: "monospace", background: "var(--c-surface-2)", padding: "1px 6px", borderRadius: "var(--r-pill)" }}>
              {req.quote_number}
            </span>
          )}
          {myRole && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: "var(--r-pill)", background: "color-mix(in oklab,var(--c-warn) 18%,var(--c-surface))", color: "var(--c-warn)" }}>
              あなたの役割: {myRole}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>
          依頼者: {req.requester_name} · {elapsed}
        </div>
        {isRejected && req.steps.find(s => s.status === "rejected")?.comment && (
          <div style={{ fontSize: 11, color: "var(--c-danger)", marginTop: 3, lineHeight: 1.5 }}>
            ⚠️ {req.steps.find(s => s.status === "rejected")?.comment}
          </div>
        )}
        {req.request_comment && !isRejected && (
          <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2, fontStyle: "italic" }}>
            「{req.request_comment}」
          </div>
        )}
      </div>

      {/* ステップ進捗 */}
      <StepChips steps={req.steps} myUserId={myUserId} />

      {/* アクション */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {showActions === "approve" && (
          <>
            <button onClick={() => onReject?.(req)}
              style={{ padding: "5px 10px", fontSize: 11, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)" }}>
              差戻
            </button>
            <button onClick={() => onApprove?.(req)}
              style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: "var(--c-success)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              承認
            </button>
          </>
        )}
        {showActions === "withdraw" && (
          <button onClick={() => onWithdraw?.(req)}
            style={{ padding: "5px 10px", fontSize: 11, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)" }}>
            取下げ
          </button>
        )}
      </div>
    </div>
  );
}

/** 折りたたみセクション（見出しは常時表示） */
function Section({
  title, subtitle, count, colorVar, items, children, defaultOpen = true,
}: {
  title: string; subtitle: string; count: number; colorVar: string;
  items: React.ReactNode; children?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(count > 0 ? defaultOpen : false);
  return (
    <div style={{
      background: "var(--c-surface)", border: "1px solid var(--c-border)",
      borderRadius: "var(--r-lg)", marginBottom: 16, overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", background: "none", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid var(--c-border)" : "none",
          textAlign: "left",
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: "50%", background: colorVar, color: "#fff",
          display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>{count}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{subtitle}</div>
        </div>
        {children}
        <svg style={{ marginLeft: "auto", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: "12px 16px" }}>
          {count === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0", fontSize: 12, color: "var(--c-text-muted)" }}>
              該当する依頼はありません
            </div>
          ) : items}
        </div>
      )}
    </div>
  );
}

/** 承認待ち一覧ページ。 */
export default function ApprovalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MySummary | null>(null);
  const [ledgerPending, setLedgerPending] = useState<LedgerApprovalPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, lp] = await Promise.all([
        apiFetch<MySummary>("/api/v1/approvals/my"),
        apiFetch<LedgerApprovalPending[]>("/api/v1/ledger-approvals/pending-for-me").catch(() => []),
      ]);
      setData(d);
      setLedgerPending(lp);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      setRejectTarget(null); setRejectComment(""); load();
    } catch (e) { alert(`エラー: ${(e as Error).message}`); }
  };

  const handleWithdraw = async (req: ApprovalRequest) => {
    if (!confirm("この承認依頼を取り下げますか？")) return;
    try {
      await apiFetch(`/api/v1/approval-requests/${req.id}/withdraw`, { method: "POST" });
      load();
    } catch (e) { alert(`エラー: ${(e as Error).message}`); }
  };

  const totalPending = (data?.awaiting_my_approval.length ?? 0) + (data?.rejected.length ?? 0);

  return (
    <AppShell breadcrumbs={[{ label: "承認待ち" }]}>
      <div className="toolbar">
        <h1>承認待ち</h1>
        <span style={{ fontSize: 12, color: "var(--c-text-muted)", marginLeft: 8 }}>
          あなた宛の承認・あなたが依頼中の案件
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>読み込み中...</div>
      ) : (
        <>
          {/* ── 工事台帳 押印依頼 ── */}
          <Section
            title="工事台帳 押印依頼"
            subtitle="押印を依頼されています · タップで案件を開きます"
            count={ledgerPending.length}
            colorVar="var(--c-status-progress)"
            items={
              <div>
                {ledgerPending.map(lp => (
                  <div key={lp.approval_id}
                    onClick={() => router.push(`/projects/${lp.project_id}`)}
                    style={{
                      display: "grid", gridTemplateColumns: "auto 1fr auto",
                      gap: 14, alignItems: "center",
                      padding: "12px 16px",
                      background: "var(--c-surface)",
                      border: "1px solid var(--c-border)",
                      borderLeft: "3px solid var(--c-status-progress)",
                      borderRadius: "var(--r-lg)", marginBottom: 8,
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "color-mix(in oklab,var(--c-status-progress) 14%,var(--c-surface))", color: "var(--c-status-progress)", display: "grid", placeItems: "center" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 21h18M5 21V7l8-4 8 4v14M9 9h6M9 13h6M9 17h6"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{lp.project_name}</div>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>
                        {lp.project_number} · 【{lp.role_label}】の押印依頼
                        {lp.requested_by_name && ` · 依頼者: ${lp.requested_by_name}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                      {lp.requested_at ? new Date(lp.requested_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : ""}
                    </div>
                  </div>
                ))}
              </div>
            }
          />

          {/* ── あなたの承認待ち ── */}
          <Section
            title="あなたの承認待ち"
            subtitle="あなたの判断で進む案件 · タップで見積書を開きます"
            count={data?.awaiting_my_approval.length ?? 0}
            colorVar="var(--c-warn)"
            items={(data?.awaiting_my_approval ?? []).map(req => (
              <ApprovalCard key={req.id} req={req} myUserId={user?.id}
                showActions="approve" onApprove={handleApprove} onReject={setRejectTarget} />
            ))}
          />

          {/* ── あなたが依頼中 ── */}
          <Section
            title="依頼中"
            subtitle="他のメンバーの承認待ち"
            count={data?.requested_by_me.length ?? 0}
            colorVar="var(--c-primary)"
            items={(data?.requested_by_me ?? []).map(req => (
              <ApprovalCard key={req.id} req={req} myUserId={user?.id}
                showActions="withdraw" onWithdraw={handleWithdraw} />
            ))}
          />

          {/* ── 差戻された案件 ── */}
          <Section
            title="差戻し"
            subtitle="コメント確認後、見積書を修正して再依頼してください"
            count={data?.rejected.length ?? 0}
            colorVar="var(--c-danger)"
            items={(data?.rejected ?? []).map(req => (
              <ApprovalCard key={req.id} req={req} myUserId={user?.id} showActions="none" />
            ))}
          />

          {/* ── 完了済み ── */}
          <Section
            title="完了済み"
            subtitle="承認が完了した依頼 · タップで見積書を開きます"
            count={(data?.completed ?? []).length}
            colorVar="var(--c-success)"
            defaultOpen={false}
            items={(data?.completed ?? []).map(req => (
              <ApprovalCard key={req.id} req={req} myUserId={user?.id} showActions="none" />
            ))}
          />
        </>
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
              <div style={{ fontSize: 12, padding: "8px 12px", background: "color-mix(in oklab,var(--c-danger) 10%,var(--c-surface))", borderRadius: "var(--r-md)", borderLeft: "3px solid var(--c-danger)", marginBottom: 12, lineHeight: 1.6 }}>
                差し戻すと依頼者に通知されます。
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>差戻し理由 <span style={{ color: "var(--c-danger)" }}>（必須）</span></label>
              <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={4}
                placeholder="差戻しの理由を入力してください..."
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "8px 10px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", resize: "vertical" }} />
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
