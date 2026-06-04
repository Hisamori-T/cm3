"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Edit2, RefreshCw, Save, Send, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtYen, fmtDateISO, fmtDateTime } from "@/lib/format";
import {
  LedgerResponse,
  LedgerDirectWorkRead,
  LedgerApprovalRead,
  LedgerExpenseItemRead,
} from "@/types/ledger";

// 月リスト（会計年度順）
const FISCAL_MONTHS = ["4","5","6","7","8","9","10","11","12","1","2","3"];
const ROLE_LABELS = ["社長", "建築部長", "経理", "担当"];

// 今月以前（支払計の対象）
const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;
function isPastOrCurrent(m: string): boolean {
  const month = parseInt(m);
  const monthYear = month >= 4 ? THIS_YEAR : THIS_YEAR + 1;
  if (monthYear < THIS_YEAR) return true;
  if (monthYear > THIS_YEAR) return false;
  return month <= THIS_MONTH;
}

function fmtPeriod(s: string | null, e: string | null) {
  if (!s && !e) return "—";
  return `${fmtDateISO(s)} 〜 ${fmtDateISO(e)}`;
}

function FL({ label, children, manual }: { label: string; children: React.ReactNode; manual?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>
        {label}{manual && <span style={{ color: "var(--c-warn)", marginLeft: 4 }}>✎</span>}
      </div>
      <div style={{ fontSize: 12 }}>{children || <span style={{ color: "var(--c-text-muted)" }}>—</span>}</div>
    </div>
  );
}

function ManualField({
  value, onSave, placeholder, multiline, rows,
}: {
  value: string | null;
  onSave: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const isEmpty = !value;

  if (!editing) {
    return (
      <div
        style={{
          fontSize: 12, padding: "4px 6px", borderRadius: "var(--r-sm)",
          background: isEmpty ? "var(--c-warn-bg, #fffbeb)" : "transparent",
          border: isEmpty ? "1px dashed var(--c-border)" : "none",
          color: isEmpty ? "var(--c-text-muted)" : undefined,
          display: "flex", alignItems: "flex-start", gap: 4, whiteSpace: "pre-wrap",
          cursor: "pointer",
        }}
        onClick={() => { setDraft(value || ""); setEditing(true); }}
        title="クリックして編集"
      >
        <span style={{ flex: 1 }}>{value || placeholder || "✎ クリックして入力"}</span>
        <Edit2 size={10} style={{ opacity: 0.4, marginTop: 2, flexShrink: 0 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={rows || 3}
          style={{
            width: "100%", padding: "6px 8px", fontSize: 12,
            border: "1px solid var(--c-primary)", borderRadius: "var(--r-sm)",
            background: "var(--c-surface)", resize: "vertical",
          }}
        />
      ) : (
        <Input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          style={{ fontSize: 12 }}
          onKeyDown={e => {
            if (e.key === "Enter") { onSave(draft); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
        />
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <Button size="sm" variant="default"
          style={{ background: "var(--c-primary)", color: "#fff", fontSize: 11 }}
          onClick={() => { onSave(draft); setEditing(false); }}>
          <Save size={11} /> 保存
        </Button>
        <Button size="sm" variant="default"
          style={{ background: "var(--c-surface-2)", color: "var(--c-text)", fontSize: 11 }}
          onClick={() => setEditing(false)}>
          <X size={11} /> キャンセル
        </Button>
      </div>
    </div>
  );
}

/** 承認スタンプ枠（押印依頼 + 押印） */
function ApprovalStamp({
  approval, users, onRequestApprove, onApprove, onRevoke, currentUserId,
}: {
  approval: LedgerApprovalRead;
  users: { id: string; full_name: string }[];
  onRequestApprove: (roleLabel: string, userId: string) => void;
  onApprove: (roleLabel: string) => void;
  onRevoke: (roleLabel: string) => void;
  currentUserId: string;
}) {
  const [showUserPicker, setShowUserPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const approved = !!approval.approved_at;
  const requested = !!approval.requested_at && !approved;
  const canApprove = approval.approver_user_id === currentUserId || !approval.approver_user_id;

  return (
    <div style={{
      border: `2px solid ${approved ? "var(--c-success)" : requested ? "var(--c-primary)" : "var(--c-border)"}`,
      borderRadius: "var(--r-md)", padding: "8px 10px", minWidth: 90, textAlign: "center",
      background: approved ? "color-mix(in oklab, var(--c-success) 8%, var(--c-surface))"
        : requested ? "color-mix(in oklab, var(--c-primary) 5%, var(--c-surface))"
        : "var(--c-surface)",
      position: "relative",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: "var(--c-text-muted)" }}>
        {approval.role_label}
      </div>

      {approved ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--c-success)" }}>
            {approval.approver_name}
          </div>
          <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginTop: 2 }}>
            {fmtDateISO(approval.approved_at)}
          </div>
          <button onClick={() => onRevoke(approval.role_label)} style={{
            position: "absolute", top: 2, right: 2, background: "none", border: "none",
            cursor: "pointer", color: "var(--c-text-muted)", display: "flex", padding: 2,
          }} title="押印取消"><X size={10} /></button>
        </>
      ) : requested ? (
        <>
          <div style={{ fontSize: 11, color: "var(--c-primary)", fontWeight: 600 }}>
            {approval.approver_user_name}
          </div>
          <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>承認待ち</div>
          {canApprove && (
            <button onClick={() => onApprove(approval.role_label)} style={{
              marginTop: 4, width: "100%", padding: "2px 0", fontSize: 10,
              background: "var(--c-primary)", color: "#fff",
              border: "none", borderRadius: "var(--r-sm)", cursor: "pointer",
            }}>押印する</button>
          )}
          <button onClick={() => onRevoke(approval.role_label)} style={{
            position: "absolute", top: 2, right: 2, background: "none", border: "none",
            cursor: "pointer", color: "var(--c-text-muted)", display: "flex", padding: 2,
          }} title="依頼取消"><X size={10} /></button>
        </>
      ) : (
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowUserPicker(v => !v)} style={{
            width: "100%", padding: "4px 0", fontSize: 11,
            border: "1px dashed var(--c-border)", borderRadius: "var(--r-sm)",
            cursor: "pointer", background: "none", color: "var(--c-primary)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <Send size={10} /> 押印依頼
          </button>
          {showUserPicker && (
            <div ref={pickerRef} style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
              background: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: "var(--r-md)", boxShadow: "0 4px 16px rgba(0,0,0,.12)",
              maxHeight: 200, overflowY: "auto", marginTop: 2,
            }}>
              {users.map(u => (
                <button key={u.id} onClick={() => { onRequestApprove(approval.role_label, u.id); setShowUserPicker(false); }}
                  style={{
                    display: "block", width: "100%", padding: "6px 10px", textAlign: "left",
                    fontSize: 12, border: "none", background: "none", cursor: "pointer",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--c-surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  {u.full_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** テーブル列 */
function TH({ children, style, colSpan }: { children?: React.ReactNode; style?: React.CSSProperties; colSpan?: number }) {
  return (
    <th colSpan={colSpan} style={{
      padding: "4px 6px", fontSize: 10, fontWeight: 600,
      background: "var(--c-surface-2)", color: "var(--c-text-muted)",
      border: "1px solid var(--c-border)", textAlign: "center", whiteSpace: "nowrap", ...style,
    }}>{children}</th>
  );
}
function TD({ children, style, num, colSpan }: { children?: React.ReactNode; style?: React.CSSProperties; num?: boolean; colSpan?: number }) {
  return (
    <td colSpan={colSpan} style={{
      padding: "4px 6px", fontSize: 12, border: "1px solid var(--c-border)",
      textAlign: num ? "right" : undefined,
      fontFamily: num ? "var(--ff-mono)" : undefined, ...style,
    }}>{children}</td>
  );
}

export default function LedgerPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // 支払開始月（表4のカラム開始位置）
  const [payStartMonth, setPayStartMonth] = useState<string>("4");

  // 取決金額インライン編集
  const [editingAgreed, setEditingAgreed] = useState<string | null>(null); // work.id
  const [agreedDraft, setAgreedDraft] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, me, usrs] = await Promise.all([
        apiFetch<LedgerResponse>(`/api/v1/projects/${projectId}/ledger`),
        apiFetch<{ id: string }>(`/api/v1/auth/me`),
        apiFetch<{ id: string; full_name: string }[]>(`/api/v1/auth/users`),
      ]);
      setData(d);
      setCurrentUserId(me.id);
      setUsers(usrs);
    } catch { setMsg({ text: "読み込みに失敗しました", ok: false }); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const showMsg = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };

  // 手動フィールド保存（プロジェクト/meta）
  const saveMeta = async (patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/meta`, {
        method: "PATCH", body: JSON.stringify(patch),
      });
      showMsg("保存しました");
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`, false); }
  };

  // 経費上書き保存
  const saveExpenseOverride = async (key: string, amount: number | null) => {
    await saveMeta({ expense_overrides: { [key]: amount } });
  };

  // 取決金額・チェック・月別支払い保存
  const saveDirectWork = async (workId: string, patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/direct-works/${workId}`, {
        method: "PATCH", body: JSON.stringify(patch),
      });
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`, false); }
  };

  // 押印依頼
  const handleRequestApprove = async (roleLabel: string, userId: string) => {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/request-approve`, {
        method: "POST",
        body: JSON.stringify({ role_label: roleLabel, approver_user_id: userId }),
      });
      showMsg("押印依頼を送りました");
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`, false); }
  };

  // 押印
  const handleApprove = async (roleLabel: string) => {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/approve`, {
        method: "POST", body: JSON.stringify({ role_label: roleLabel }),
      });
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`, false); }
  };

  // 押印取消
  const handleRevoke = async (roleLabel: string) => {
    if (!confirm(`「${roleLabel}」の押印・依頼をリセットしますか？`)) return;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/approve/${encodeURIComponent(roleLabel)}`, { method: "DELETE" });
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`, false); }
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "案件一覧", href: "/projects" }, { label: "工事台帳" }]}>
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--c-text-muted)" }}>読み込み中…</div>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell breadcrumbs={[{ label: "案件一覧", href: "/projects" }, { label: "工事台帳" }]}>
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--c-danger)" }}>データ取得失敗</div>
      </AppShell>
    );
  }

  const cs = data.cost_summary;

  // 表4: 支払開始月から6ヶ月分
  const startIdx = FISCAL_MONTHS.indexOf(payStartMonth);
  const showMths = startIdx >= 0
    ? [...FISCAL_MONTHS.slice(startIdx, startIdx + 6), ...FISCAL_MONTHS.slice(0, Math.max(0, startIdx + 6 - 12))].slice(0, 6)
    : FISCAL_MONTHS.slice(0, 6);

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: data.project_name, href: `/projects/${projectId}` },
        { label: "工事台帳" },
      ]}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {msg && (
            <span style={{ fontSize: 13, color: msg.ok ? "var(--c-success)" : "var(--c-danger)" }}>
              {msg.text}
            </span>
          )}
          <Button variant="default" size="sm" onClick={load}
            style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}>
            <RefreshCw size={13} />
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── 上部2カラム ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

          {/* 左: 基本情報（クリックで個別編集） */}
          <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>受注伺(案件)兼 工事台帳</div>

            <FL label="見積書 No.">{data.quote_number}</FL>
            <FL label="工事番号">{data.project_number}</FL>
            <FL label="工事名">{data.project_name}</FL>
            <FL label="工事場所">{data.project_location}</FL>
            <FL label="発注者">{data.client_name}</FL>

            <div>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>元発注者 ✎</div>
              <ManualField
                value={data.original_client_name}
                onSave={v => saveMeta({ original_client_name: v || null })}
                placeholder="手入力"
              />
            </div>

            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <FL label="工期（見積）">{fmtPeriod(data.period_quote_start, data.period_quote_end)}</FL>
              <FL label="工期（契約）">{fmtPeriod(data.period_contract_start, data.period_contract_end)}</FL>
              <div>
                <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>工期（実施）✎</div>
                <WorkPeriodEditor
                  start={data.period_actual_start}
                  end={data.period_actual_end}
                  onSave={(s, e) => saveMeta({ period_actual_start: s || null, period_actual_end: e || null })}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>支払条件 ✎</div>
              <ManualField
                value={data.payment_condition}
                onSave={v => saveMeta({ payment_condition: v || null })}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>工事概要 ✎</div>
              <ManualField
                value={data.project_summary}
                onSave={v => saveMeta({ project_summary: v || null })}
                multiline rows={3}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>情報経緯 ✎</div>
              <ManualField
                value={data.information_history}
                onSave={v => saveMeta({ information_history: v || null })}
                multiline rows={2}
              />
            </div>

            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 4 }}>前施工区分 ✎</div>
              <PrevConstructionEditor
                selfFlag={data.prev_construction_self}
                year={data.prev_construction_year}
                other={data.prev_construction_other}
                onSave={(s, y, o) => saveMeta({
                  prev_construction_self: s,
                  prev_construction_year: y || null,
                  prev_construction_other: o || null,
                })}
              />
            </div>

            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <FL label="当社担当（営業）">{data.sales_person_name}</FL>
              <FL label="当社担当（工事）">{data.construction_person_name}</FL>
            </div>
          </div>

          {/* 右 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* 承認枠 */}
            <div className="card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>承認</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {ROLE_LABELS.map(label => {
                  const approval = data.approvals.find(a => a.role_label === label) ?? {
                    id: label, role_label: label, approver_id: null, approver_name: null,
                    approved_at: null, comment: null, display_order: 0,
                    approver_user_id: null, approver_user_name: null,
                    requested_by_name: null, requested_at: null,
                  } as LedgerApprovalRead;
                  return (
                    <ApprovalStamp
                      key={label}
                      approval={approval}
                      users={users}
                      onRequestApprove={handleRequestApprove}
                      onApprove={handleApprove}
                      onRevoke={handleRevoke}
                      currentUserId={currentUserId}
                    />
                  );
                })}
              </div>
            </div>

            {/* 案件/受注/工事価格 */}
            <div className="card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* ■ 案件（顧客見積から自動取得） */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 700, minWidth: 20 }}>■</span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>案件</span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>見積提出日</span>
                <span style={{ fontWeight: 600 }}>{fmtDateISO(data.quote_issue_date)}</span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>提出金額</span>
                <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 700 }}>{fmtYen(data.quote_total_amount)}</span>
                {data.quote_number && (
                  <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{data.quote_number}</span>
                )}
              </div>
              {/* □ 受注（注文請書から自動取得） */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 700, minWidth: 20, color: data.ack_issue_date ? undefined : "var(--c-text-muted)" }}>□</span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>受注</span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>見積提出日</span>
                <span style={{ fontWeight: 600 }}>
                  {data.ack_issue_date ? fmtDateISO(data.ack_issue_date) : "—"}
                </span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>決定金額</span>
                <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 700 }}>
                  {data.ack_total_amount ? fmtYen(data.ack_total_amount) : <span style={{ color: "var(--c-text-muted)" }}>←手入力</span>}
                </span>
              </div>
              {/* 工事価格 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 10px", borderRadius: "var(--r-md)",
                background: "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))",
                border: "1px solid color-mix(in oklab, var(--c-primary) 20%, var(--c-border))",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>工事価格</span>
                <span style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--ff-mono)", color: "var(--c-primary)" }}>
                  {fmtYen(data.project_price)}
                </span>
                {data.ack_total_amount && (
                  <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>注文請書より自動取得</span>
                )}
              </div>
            </div>

            {/* 目標営業利益 */}
            <div className="card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>目標営業利益 ✎</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>利益率 (%)</div>
                  <ManualField
                    value={data.target_profit_rate != null ? String(data.target_profit_rate) : null}
                    onSave={v => saveMeta({ target_profit_rate: v ? parseFloat(v) : null })}
                    placeholder="10.0"
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>利益額</div>
                  <ManualField
                    value={data.target_profit_amount != null ? String(data.target_profit_amount) : null}
                    onSave={v => saveMeta({ target_profit_amount: v ? parseFloat(v) : null })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 工事割出 3列 ── */}
        {cs && (
          <div className="card" style={{ padding: "12px 14px", overflowX: "auto" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>工事割出</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH style={{ width: 160, textAlign: "left" }}> </TH>
                  <TH>実行予算</TH><TH style={{ width: 45 }}>比率</TH>
                  <TH>取決見通</TH><TH style={{ width: 45 }}>比率</TH>
                  <TH>精算(支払)見通</TH><TH style={{ width: 45 }}>比率</TH>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "直接工事費", b: cs.direct_cost_budget, a: cs.direct_cost_agreed, s: cs.direct_cost_settlement },
                  { label: "現場経費", b: cs.site_overhead_total, a: cs.site_overhead_total, s: cs.site_overhead_total },
                ].map(row => {
                  const pp = data.project_price || 1;
                  return (
                    <tr key={row.label}>
                      <TD>{row.label}</TD>
                      <TD num>{fmtYen(row.b)}</TD>
                      <TD num style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{((row.b / pp) * 100).toFixed(1)}</TD>
                      <TD num>{fmtYen(row.a)}</TD>
                      <TD num style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{((row.a / pp) * 100).toFixed(1)}</TD>
                      <TD num>{fmtYen(row.s)}</TD>
                      <TD num style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{((row.s / pp) * 100).toFixed(1)}</TD>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700 }}>
                  <TD style={{ fontWeight: 700 }}>計</TD>
                  {[
                    cs.direct_cost_budget + cs.site_overhead_total,
                    cs.direct_cost_agreed + cs.site_overhead_total,
                    cs.direct_cost_settlement + cs.site_overhead_total,
                  ].map((v, i) => {
                    const pp = data.project_price || 1;
                    return [
                      <TD key={`v${i}`} num>{fmtYen(v)}</TD>,
                      <TD key={`r${i}`} num style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{((v / pp) * 100).toFixed(1)}</TD>,
                    ];
                  })}
                </tr>
                <tr style={{ background: "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))" }}>
                  <TD style={{ fontSize: 11 }}>経費（共通+一般管理費）</TD>
                  {[1,2,3].map(i => [
                    <TD key={`v${i}`} num>{fmtYen(cs.construction_dept_overhead + cs.general_admin_cost)}</TD>,
                    <TD key={`r${i}`} num style={{ fontSize: 10 }}>10.0</TD>,
                  ])}
                </tr>
                <tr>
                  <TD>営業利益①</TD>
                  <TD num style={{ color: cs.operating_profit >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
                    {fmtYen(cs.operating_profit)}
                  </TD>
                  <TD num style={{ fontSize: 10 }}>{(cs.operating_profit_rate * 100).toFixed(1)}</TD>
                  <TD num>—</TD><TD /><TD num>—</TD><TD />
                </tr>
                <tr>
                  <TD>目標営業利益</TD>
                  <TD num style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                    {data.target_profit_amount
                      ? fmtYen(data.target_profit_amount)
                      : data.target_profit_rate && data.project_price
                      ? fmtYen(data.project_price * data.target_profit_rate / 100)
                      : fmtYen(cs.target_operating_profit)}
                  </TD>
                  <TD num style={{ fontSize: 10 }}>
                    {data.target_profit_rate != null ? String(data.target_profit_rate) : "10.0"}
                  </TD>
                  <TD colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── 現場経費内訳（QCDS自動計算 + 個別編集） ── */}
        {data.expense_items.length > 0 && (
          <div className="card" style={{ padding: "12px 14px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              現場経費内訳
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--c-text-muted)", marginLeft: 8 }}>
                QCDSから自動取得（クリックで手動上書き可）
              </span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {data.expense_items.map(e => (
                <ExpenseItemCell
                  key={e.system_key}
                  item={e}
                  onSave={amt => saveExpenseOverride(e.system_key, amt)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── 表4: 統合テーブル ── */}
        <div className="card" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700 }}>
              実行予算表 / 取決見通表 / 精算(支払)見通表
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <label style={{ color: "var(--c-text-muted)" }}>支払開始月:</label>
              <select
                value={payStartMonth}
                onChange={e => setPayStartMonth(e.target.value)}
                style={{
                  padding: "2px 6px", fontSize: 11, border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-sm)", background: "var(--c-surface)",
                }}
              >
                {FISCAL_MONTHS.map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
          </div>

          {data.direct_works.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--c-text-muted)" }}>QCDSに工事費行を登録すると表示されます</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr>
                    <TH style={{ width: 28 }}>No</TH>
                    <TH style={{ width: 90 }}>支払先</TH>
                    <TH style={{ width: 60 }}>工種</TH>
                    <TH style={{ background: "color-mix(in oklab, #3b82f6 10%, var(--c-surface))" }}>実行予算</TH>
                    <TH style={{ background: "color-mix(in oklab, #f97316 10%, var(--c-surface))" }}>取決金額 ✎</TH>
                    <TH style={{ width: 28 }}>✓</TH>
                    <TH style={{ width: 70, background: "color-mix(in oklab, #f97316 10%, var(--c-surface))" }}>取決差額</TH>
                    {showMths.map(m => (
                      <TH key={m} style={{ width: 68, background: isPastOrCurrent(m) ? "color-mix(in oklab, #16a34a 10%, var(--c-surface))" : "color-mix(in oklab, #16a34a 5%, var(--c-surface))" }}>
                        {m}月{isPastOrCurrent(m) ? "" : " ✎"}
                      </TH>
                    ))}
                    <TH style={{ background: "color-mix(in oklab, #16a34a 12%, var(--c-surface))" }}>支払計</TH>
                    <TH style={{ width: 70 }}>残支払</TH>
                  </tr>
                </thead>
                <tbody>
                  {data.direct_works.map((w, i) => {
                    // 支払計: 今月以前の月のみ合計
                    const payTotal = showMths
                      .filter(m => isPastOrCurrent(m))
                      .reduce((s, m) => s + (w.monthly_payments[m] ?? 0), 0);
                    const remaining = (w.agreed_amount ?? 0) - payTotal;
                    const diff = (w.budget_amount ?? 0) - (w.agreed_amount ?? 0);
                    const isEditingThisAgreed = editingAgreed === w.id;

                    return (
                      <tr key={w.id} style={{
                        background: w.payment_completed
                          ? "color-mix(in oklab, var(--c-success) 5%, var(--c-surface))"
                          : undefined,
                      }}>
                        <TD style={{ textAlign: "center", fontSize: 10, color: "var(--c-text-muted)" }}>{i + 1}</TD>
                        <TD>{w.vendor_name || "—"}</TD>
                        <TD style={{ fontSize: 11 }}>{w.work_type || "—"}</TD>
                        <TD num style={{ background: "color-mix(in oklab, #3b82f6 5%, var(--c-surface))" }}>
                          {fmtYen(w.budget_amount)}
                        </TD>
                        {/* 取決金額: インライン編集 */}
                        <td style={{
                          padding: "2px 4px", border: "1px solid var(--c-border)",
                          background: "color-mix(in oklab, #f97316 5%, var(--c-surface))",
                        }}>
                          {isEditingThisAgreed ? (
                            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                              <input
                                autoFocus
                                type="number"
                                value={agreedDraft}
                                onChange={e => setAgreedDraft(e.target.value)}
                                onBlur={() => {
                                  saveDirectWork(w.id, { agreed_amount: agreedDraft ? parseFloat(agreedDraft) : null });
                                  setEditingAgreed(null);
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    saveDirectWork(w.id, { agreed_amount: agreedDraft ? parseFloat(agreedDraft) : null });
                                    setEditingAgreed(null);
                                  }
                                  if (e.key === "Escape") setEditingAgreed(null);
                                }}
                                style={{ width: 80, padding: "1px 4px", fontSize: 11, textAlign: "right" }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{ textAlign: "right", fontFamily: "var(--ff-mono)", fontSize: 12, cursor: "pointer", padding: "2px 4px" }}
                              onClick={() => { setAgreedDraft(w.agreed_amount != null ? String(w.agreed_amount) : ""); setEditingAgreed(w.id); }}
                            >
                              {w.agreed_amount != null ? fmtYen(w.agreed_amount) : <span style={{ color: "var(--c-text-muted)", fontSize: 10 }}>✎ 入力</span>}
                            </div>
                          )}
                        </td>
                        {/* 取決済チェック */}
                        <td style={{ textAlign: "center", border: "1px solid var(--c-border)" }}>
                          <input
                            type="checkbox"
                            checked={w.agreement_checked}
                            onChange={e => saveDirectWork(w.id, { agreement_checked: e.target.checked })}
                            style={{ cursor: "pointer", width: 14, height: 14 }}
                          />
                        </td>
                        <TD num style={{ background: "color-mix(in oklab, #f97316 5%, var(--c-surface))", fontSize: 11 }}>
                          {diff !== 0 ? fmtYen(diff) : "—"}
                        </TD>
                        {/* 月別支払い: 手動入力 */}
                        {showMths.map(m => (
                          <MonthPayCell
                            key={m}
                            workId={w.id}
                            month={m}
                            value={w.monthly_payments[m]}
                            isPast={isPastOrCurrent(m)}
                            onSave={(v) => saveDirectWork(w.id, { [`payment_month_${m}`]: v })}
                          />
                        ))}
                        <TD num style={{ background: "color-mix(in oklab, #16a34a 8%, var(--c-surface))", fontWeight: 600 }}>
                          {payTotal > 0 ? fmtYen(payTotal) : "—"}
                        </TD>
                        <TD num style={{ color: remaining > 0 ? "var(--c-danger)" : "var(--c-text-muted)", fontSize: 11 }}>
                          {w.payment_completed ? (
                            <span style={{ color: "var(--c-success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
                              <CheckCircle2 size={11} /> 済
                            </span>
                          ) : w.agreed_amount ? fmtYen(remaining) : "—"}
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <TD colSpan={3} style={{ fontWeight: 700, fontSize: 11 }}>直接工事費 計</TD>
                    <TD num style={{ background: "color-mix(in oklab, #3b82f6 8%, var(--c-surface))" }}>
                      {fmtYen(data.direct_works.reduce((s, w) => s + (w.budget_amount ?? 0), 0))}
                    </TD>
                    <TD num style={{ background: "color-mix(in oklab, #f97316 8%, var(--c-surface))" }}>
                      {fmtYen(data.direct_works.reduce((s, w) => s + (w.agreed_amount ?? 0), 0))}
                    </TD>
                    <TD />
                    <TD num style={{ background: "color-mix(in oklab, #f97316 8%, var(--c-surface))" }}>
                      {fmtYen(data.direct_works.reduce((s, w) => s + (w.budget_amount ?? 0) - (w.agreed_amount ?? 0), 0))}
                    </TD>
                    {showMths.map(m => (
                      <TD key={m} num style={{ background: "color-mix(in oklab, #16a34a 6%, var(--c-surface))", fontSize: 11 }}>
                        {(() => {
                          const total = data.direct_works.reduce((s, w) => s + (w.monthly_payments[m] ?? 0), 0);
                          return total > 0 ? fmtYen(total) : "";
                        })()}
                      </TD>
                    ))}
                    <TD num style={{ background: "color-mix(in oklab, #16a34a 10%, var(--c-surface))" }}>
                      {fmtYen(data.direct_works.reduce((s, w) =>
                        s + showMths.filter(m => isPastOrCurrent(m)).reduce((ms, m) => ms + (w.monthly_payments[m] ?? 0), 0), 0
                      ))}
                    </TD>
                    <TD />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ── サブコンポーネント ──────────────────────────────────────────

/** 現場経費セル（クリックで上書き編集） */
function ExpenseItemCell({ item, onSave }: { item: LedgerExpenseItemRead; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(item.display_amount));
  const isOverridden = item.override_amount != null;

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "4px 8px", borderRadius: "var(--r-sm)",
      background: isOverridden ? "color-mix(in oklab, var(--c-warn) 8%, var(--c-surface))" : "var(--c-surface-2)",
      border: isOverridden ? "1px solid color-mix(in oklab, var(--c-warn) 30%, transparent)" : "none",
      fontSize: 12,
    }}>
      <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>
        {item.item_name}
        {isOverridden && <span style={{ fontSize: 9, marginLeft: 4, color: "var(--c-warn)" }}>✎上書き</span>}
      </span>
      {editing ? (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            autoFocus
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{ width: 80, padding: "1px 4px", fontSize: 11, textAlign: "right" }}
            onBlur={() => { onSave(draft ? parseFloat(draft) : null); setEditing(false); }}
            onKeyDown={e => {
              if (e.key === "Enter") { onSave(draft ? parseFloat(draft) : null); setEditing(false); }
              if (e.key === "Escape") setEditing(false);
            }}
          />
          {isOverridden && (
            <button onClick={() => { onSave(null); setEditing(false); }}
              style={{ fontSize: 9, border: "none", background: "none", cursor: "pointer", color: "var(--c-danger)" }}>
              リセット
            </button>
          )}
        </div>
      ) : (
        <span
          style={{ fontFamily: "var(--ff-mono)", fontWeight: 600, cursor: "pointer" }}
          onClick={() => { setDraft(String(item.display_amount)); setEditing(true); }}
        >
          {fmtYen(item.display_amount)}
        </span>
      )}
    </div>
  );
}

/** 月別支払セル（インライン編集） */
function MonthPayCell({ workId, month, value, isPast, onSave }: {
  workId: string; month: string; value: number | null; isPast: boolean; onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  const bg = isPast
    ? "color-mix(in oklab, #16a34a 8%, var(--c-surface))"
    : "color-mix(in oklab, #16a34a 4%, var(--c-surface))";

  return (
    <td style={{ padding: "2px 4px", border: "1px solid var(--c-border)", background: bg, textAlign: "right", width: 68 }}>
      {editing ? (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { onSave(draft ? parseFloat(draft) : null); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === "Enter") { onSave(draft ? parseFloat(draft) : null); setEditing(false); }
            if (e.key === "Tab") { onSave(draft ? parseFloat(draft) : null); setEditing(false); }
            if (e.key === "Escape") setEditing(false);
          }}
          style={{ width: "100%", padding: "1px 2px", fontSize: 11, textAlign: "right", background: "white" }}
        />
      ) : (
        <div
          onClick={() => { setDraft(value != null ? String(value) : ""); setEditing(true); }}
          style={{ fontSize: 11, fontFamily: "var(--ff-mono)", cursor: "pointer", minHeight: 20 }}
        >
          {value != null && value > 0 ? fmtYen(value) : ""}
        </div>
      )}
    </td>
  );
}

/** 工期（実施）エディタ */
function WorkPeriodEditor({ start, end, onSave }: {
  start: string | null; end: string | null; onSave: (s: string, e: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [s, setS] = useState(start || "");
  const [e, setE] = useState(end || "");
  const isEmpty = !start && !end;

  if (!editing) {
    return (
      <div
        onClick={() => { setS(start || ""); setE(end || ""); setEditing(true); }}
        style={{
          fontSize: 12, cursor: "pointer", padding: "3px 6px", borderRadius: "var(--r-sm)",
          background: isEmpty ? "var(--c-warn-bg, #fffbeb)" : "transparent",
          border: isEmpty ? "1px dashed var(--c-border)" : "none",
          color: isEmpty ? "var(--c-text-muted)" : undefined,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span>{isEmpty ? "✎ クリックして入力" : `${fmtDateISO(start)} 〜 ${fmtDateISO(end)}`}</span>
        <Edit2 size={10} style={{ opacity: 0.4 }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Input type="date" value={s} onChange={ev => setS(ev.target.value)} style={{ fontSize: 11 }} />
        <span>〜</span>
        <Input type="date" value={e} onChange={ev => setE(ev.target.value)} style={{ fontSize: 11 }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Button size="sm" variant="default"
          style={{ background: "var(--c-primary)", color: "#fff", fontSize: 11 }}
          onClick={() => { onSave(s, e); setEditing(false); }}>
          <Save size={11} /> 保存
        </Button>
        <Button size="sm" variant="default"
          style={{ background: "var(--c-surface-2)", color: "var(--c-text)", fontSize: 11 }}
          onClick={() => setEditing(false)}>
          <X size={11} /> キャンセル
        </Button>
      </div>
    </div>
  );
}

/** 前施工区分エディタ */
function PrevConstructionEditor({ selfFlag, year, other, onSave }: {
  selfFlag: boolean | null; year: number | null; other: string | null;
  onSave: (self: boolean | null, year: string, other: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sf, setSf] = useState<boolean | null>(selfFlag);
  const [yr, setYr] = useState(year ? String(year) : "");
  const [ot, setOt] = useState(other || "");
  const isEmpty = selfFlag == null && !year && !other;

  if (!editing) {
    return (
      <div
        onClick={() => { setSf(selfFlag); setYr(year ? String(year) : ""); setOt(other || ""); setEditing(true); }}
        style={{
          fontSize: 12, cursor: "pointer", padding: "3px 6px", borderRadius: "var(--r-sm)",
          background: isEmpty ? "var(--c-warn-bg, #fffbeb)" : "transparent",
          border: isEmpty ? "1px dashed var(--c-border)" : "none",
          color: isEmpty ? "var(--c-text-muted)" : undefined,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span>
          {isEmpty
            ? "✎ クリックして入力"
            : selfFlag
            ? `当社（${year || "—"}年施工）`
            : `他社: ${other || "—"}`}
        </span>
        <Edit2 size={10} style={{ opacity: 0.4 }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <input type="checkbox" checked={sf ?? false} onChange={e => setSf(e.target.checked)} />
        当社施工
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <Input type="number" value={yr} placeholder="施工年"
          onChange={e => setYr(e.target.value)} style={{ width: 80, fontSize: 12 }} />
        <span style={{ fontSize: 11, alignSelf: "center" }}>年施工</span>
        <Input value={ot} placeholder="他社名" onChange={e => setOt(e.target.value)} style={{ fontSize: 12, flex: 1 }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Button size="sm" variant="default"
          style={{ background: "var(--c-primary)", color: "#fff", fontSize: 11 }}
          onClick={() => { onSave(sf, yr, ot); setEditing(false); }}>
          <Save size={11} /> 保存
        </Button>
        <Button size="sm" variant="default"
          style={{ background: "var(--c-surface-2)", color: "var(--c-text)", fontSize: 11 }}
          onClick={() => setEditing(false)}>
          <X size={11} /> キャンセル
        </Button>
      </div>
    </div>
  );
}
