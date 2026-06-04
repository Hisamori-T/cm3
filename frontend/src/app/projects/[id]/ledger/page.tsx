"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Edit2, RefreshCw, Save, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtYen, fmtDateISO, fmtDateTime } from "@/lib/format";
import {
  LedgerResponse,
  LedgerCostSummary,
  LedgerDirectWorkRead,
  LedgerExpenseItemRead,
  LedgerApprovalRead,
} from "@/types/ledger";

const MONTHS = ["4","5","6","7","8","9","10","11","12","1","2","3"];
const ROLE_LABELS = ["社長", "建築部長", "経理", "担当"];

function fmtPeriod(s: string | null, e: string | null): string {
  if (!s && !e) return "—";
  return `${fmtDateISO(s)} 〜 ${fmtDateISO(e)}`;
}

function TH({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{
      padding: "5px 8px", fontSize: 11, fontWeight: 600,
      background: "var(--c-surface-2)", color: "var(--c-text-muted)",
      border: "1px solid var(--c-border)", textAlign: "center", ...style,
    }}>
      {children}
    </th>
  );
}
function TD({ children, style, num }: { children: React.ReactNode; style?: React.CSSProperties; num?: boolean }) {
  return (
    <td style={{
      padding: "5px 8px", fontSize: 12, border: "1px solid var(--c-border)",
      textAlign: num ? "right" : undefined,
      fontFamily: num ? "var(--ff-mono)" : undefined, ...style,
    }}>
      {children}
    </td>
  );
}

/** 工事割出 3列集計行。 */
function CostRow({
  label, budget, agreed, settlement, accent, rate,
}: {
  label: string;
  budget: number | null;
  agreed: number | null;
  settlement: number | null;
  accent?: boolean;
  rate?: number;
}) {
  const pp = rate !== undefined;
  const rowStyle: React.CSSProperties = accent
    ? { background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))", fontWeight: 700 }
    : {};
  return (
    <tr style={rowStyle}>
      <TD style={{ fontWeight: accent ? 700 : undefined }}>{label}</TD>
      <TD num>{fmtYen(budget)}</TD>
      {pp && <TD num style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{rate !== undefined ? `${rate.toFixed(1)}` : "—"}</TD>}
      <TD num>{fmtYen(agreed)}</TD>
      {pp && <TD num style={{ fontSize: 11, color: "var(--c-text-muted)" }}>—</TD>}
      <TD num>{fmtYen(settlement)}</TD>
      {pp && <TD num style={{ fontSize: 11, color: "var(--c-text-muted)" }}>—</TD>}
    </tr>
  );
}

/** 手動入力テキストエリア（黄背景＝未入力 / 白＝入力済）。 */
function ManualTextArea({
  value,
  placeholder,
  onChange,
  rows = 2,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const isEmpty = !value.trim();
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      style={{
        width: "100%", padding: "6px 8px", fontSize: 12,
        border: `1px ${isEmpty ? "dashed" : "solid"} var(--c-border)`,
        borderRadius: "var(--r-sm)",
        background: isEmpty ? "var(--c-warn-bg, #fffbeb)" : "var(--c-surface)",
        resize: "vertical",
      }}
    />
  );
}

/** フィールドラベル + 内容。 */
function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12 }}>{children || "—"}</div>
    </div>
  );
}

/** 承認スタンプ枠。 */
function ApprovalStamp({
  approval,
  onApprove,
  onRevoke,
}: {
  approval: LedgerApprovalRead;
  onApprove: (roleLabel: string) => void;
  onRevoke: (roleLabel: string) => void;
}) {
  const approved = !!approval.approved_at;
  return (
    <div style={{
      border: `2px solid ${approved ? "var(--c-success)" : "var(--c-border)"}`,
      borderRadius: "var(--r-md)",
      padding: "8px 10px",
      minWidth: 90, textAlign: "center",
      background: approved ? "color-mix(in oklab, var(--c-success) 8%, var(--c-surface))" : "var(--c-surface)",
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
          <button
            onClick={() => onRevoke(approval.role_label)}
            style={{
              position: "absolute", top: 2, right: 2,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--c-text-muted)", display: "flex", padding: 2,
            }}
            title="押印取消"
          >
            <X size={10} />
          </button>
        </>
      ) : (
        <button
          onClick={() => onApprove(approval.role_label)}
          style={{
            width: "100%", padding: "4px 0", fontSize: 11,
            border: "1px dashed var(--c-border)",
            borderRadius: "var(--r-sm)", cursor: "pointer",
            background: "none", color: "var(--c-primary)",
          }}
        >
          押印
        </button>
      )}
    </div>
  );
}

/** 工事台帳ページ。 */
export default function LedgerPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 手動入力フォーム状態
  const [form, setForm] = useState({
    original_client_name: "",
    project_summary: "",
    payment_condition: "",
    period_actual_start: "",
    period_actual_end: "",
    prev_construction_year: "",
    prev_construction_other: "",
    prev_construction_self: false as boolean | null,
    information_history: "",
    client_requirements: "",
    target_profit_rate: "",
    target_profit_amount: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<LedgerResponse>(`/api/v1/projects/${projectId}/ledger`);
      setData(d);
      setForm({
        original_client_name: d.original_client_name || "",
        project_summary: d.project_summary || "",
        payment_condition: d.payment_condition || "",
        period_actual_start: d.period_actual_start || "",
        period_actual_end: d.period_actual_end || "",
        prev_construction_year: d.prev_construction_year?.toString() || "",
        prev_construction_other: d.prev_construction_other || "",
        prev_construction_self: d.prev_construction_self,
        information_history: d.information_history || "",
        client_requirements: d.client_requirements || "",
        target_profit_rate: d.target_profit_rate?.toString() || "",
        target_profit_amount: d.target_profit_amount?.toString() || "",
      });
    } catch {
      setMsg("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 3000); };

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/meta`, {
        method: "PATCH",
        body: JSON.stringify({
          original_client_name: form.original_client_name || null,
          project_summary: form.project_summary || null,
          payment_condition: form.payment_condition || null,
          period_actual_start: form.period_actual_start || null,
          period_actual_end: form.period_actual_end || null,
          prev_construction_year: form.prev_construction_year ? parseInt(form.prev_construction_year) : null,
          prev_construction_other: form.prev_construction_other || null,
          prev_construction_self: form.prev_construction_self,
          information_history: form.information_history || null,
          client_requirements: form.client_requirements || null,
          target_profit_rate: form.target_profit_rate ? parseFloat(form.target_profit_rate) : null,
          target_profit_amount: form.target_profit_amount ? parseFloat(form.target_profit_amount) : null,
        }),
      });
      showMsg("保存しました");
      setEditMode(false);
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  }

  async function handleApprove(roleLabel: string) {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/approve`, {
        method: "POST",
        body: JSON.stringify({ role_label: roleLabel }),
      });
      await load();
    } catch (e) { showMsg(`押印エラー: ${(e as Error).message}`); }
  }

  async function handleRevoke(roleLabel: string) {
    if (!confirm(`「${roleLabel}」の押印を取り消しますか？`)) return;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/ledger/approve/${encodeURIComponent(roleLabel)}`, { method: "DELETE" });
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

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
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--c-danger)" }}>データの取得に失敗しました</div>
      </AppShell>
    );
  }

  const cs = data.cost_summary;

  // 月別列に入力値のある月のみ表示（最低6ヶ月）
  const activeMths = MONTHS.filter(m =>
    data.direct_works.some(w => w.monthly_payments[m] != null && w.monthly_payments[m]! > 0)
  );
  const showMths = activeMths.length < 6 ? MONTHS.slice(0, 6) : activeMths;

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
            <span style={{ fontSize: 13, color: msg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
              {msg}
            </span>
          )}
          {editMode ? (
            <>
              <Button variant="default" size="sm" onClick={() => setEditMode(false)}
                style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}>
                <X size={13} /> キャンセル
              </Button>
              <Button variant="default" size="sm" onClick={handleSave} disabled={saving}
                style={{ background: "var(--c-primary)", color: "#fff" }}>
                <Save size={13} /> {saving ? "保存中…" : "保存"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="default" size="sm" onClick={load}
                style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}>
                <RefreshCw size={13} />
              </Button>
              <Button variant="default" size="sm" onClick={() => setEditMode(true)}
                style={{ background: "var(--c-primary)", color: "#fff" }}>
                <Edit2 size={13} /> 手動入力を編集
              </Button>
            </>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── 上部2カラム: 基本情報 + 案件情報&承認枠 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

          {/* 左: 基本情報 */}
          <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
              受注伺(案件)兼 工事台帳
            </h2>
            <div style={{
              display: "inline-block", padding: "2px 8px", fontSize: 11, fontWeight: 600,
              background: "var(--c-warn-bg, #fef9c3)", color: "#92400e",
              borderRadius: "var(--r-sm)", marginBottom: 4,
            }}>
              ✎ 手動入力必須
            </div>

            <FL label="見積書 No.">{data.quote_number}</FL>
            <FL label="工事番号">{data.project_number}</FL>
            <FL label="工事名">{data.project_name}</FL>
            <FL label="工事場所">{data.project_location}</FL>
            <FL label="発注者">{data.client_name}</FL>

            <div>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>元発注者</div>
              {editMode ? (
                <Input
                  value={form.original_client_name}
                  onChange={e => setForm(f => ({ ...f, original_client_name: e.target.value }))}
                  placeholder="✎ 未入力"
                  style={{ fontSize: 12 }}
                />
              ) : (
                <div style={{
                  fontSize: 12, padding: "4px 6px", borderRadius: "var(--r-sm)",
                  background: !data.original_client_name ? "var(--c-warn-bg, #fffbeb)" : "transparent",
                  border: !data.original_client_name ? "1px dashed var(--c-border)" : "none",
                  color: !data.original_client_name ? "var(--c-text-muted)" : undefined,
                }}>
                  {data.original_client_name || "✎ 未入力"}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <FL label="工期（見積）">{fmtPeriod(data.period_quote_start, data.period_quote_end)}</FL>
              <FL label="工期（契約）">{fmtPeriod(data.period_contract_start, data.period_contract_end)}</FL>
              <div>
                <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>工期（実施）✎</div>
                {editMode ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Input type="date" value={form.period_actual_start} onChange={e => setForm(f => ({ ...f, period_actual_start: e.target.value }))} style={{ fontSize: 11 }} />
                    <span style={{ fontSize: 11 }}>〜</span>
                    <Input type="date" value={form.period_actual_end} onChange={e => setForm(f => ({ ...f, period_actual_end: e.target.value }))} style={{ fontSize: 11 }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 12 }}>{fmtPeriod(data.period_actual_start, data.period_actual_end)}</div>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>支払条件</div>
              {editMode ? (
                <Input value={form.payment_condition} onChange={e => setForm(f => ({ ...f, payment_condition: e.target.value }))} style={{ fontSize: 12 }} />
              ) : (
                <div style={{ fontSize: 12 }}>{data.payment_condition || "—"}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>工事概要・情報経緯・発注者要望事項 ✎</div>
              {editMode ? (
                <ManualTextArea value={form.project_summary} onChange={v => setForm(f => ({ ...f, project_summary: v }))} rows={3} placeholder="工事概要" />
              ) : (
                <div style={{
                  fontSize: 12, padding: "4px 6px", borderRadius: "var(--r-sm)", whiteSpace: "pre-wrap",
                  background: !data.project_summary ? "var(--c-warn-bg, #fffbeb)" : undefined,
                  border: !data.project_summary ? "1px dashed var(--c-border)" : undefined,
                  color: !data.project_summary ? "var(--c-text-muted)" : undefined,
                }}>
                  {data.project_summary || "✎ 未入力"}
                </div>
              )}
            </div>

            {editMode && (
              <div>
                <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>情報経緯 ✎</div>
                <ManualTextArea value={form.information_history} onChange={v => setForm(f => ({ ...f, information_history: v }))} rows={2} />
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 4 }}>前施工区分 ✎</div>
              {editMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={form.prev_construction_self ?? false}
                      onChange={e => setForm(f => ({ ...f, prev_construction_self: e.target.checked }))} />
                    当社施工
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Input type="number" value={form.prev_construction_year} placeholder="施工年"
                      onChange={e => setForm(f => ({ ...f, prev_construction_year: e.target.value }))}
                      style={{ width: 80, fontSize: 12 }} />
                    <span style={{ fontSize: 11, alignSelf: "center" }}>年施工</span>
                    <Input value={form.prev_construction_other} placeholder="他社名"
                      onChange={e => setForm(f => ({ ...f, prev_construction_other: e.target.value }))}
                      style={{ fontSize: 12, flex: 1 }} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12 }}>
                  {data.prev_construction_self ? `当社（${data.prev_construction_year || "—"}年施工）` :
                    data.prev_construction_year ? `他社: ${data.prev_construction_other || "—"}` : "—"}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <FL label="当社担当（営業）">{data.sales_person_name}</FL>
              <FL label="当社担当（工事）">{data.construction_person_name}</FL>
            </div>
          </div>

          {/* 右: 案件/受注情報 + 承認枠 + 工事価格 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* 承認枠 */}
            <div className="card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>承認</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {ROLE_LABELS.map(label => {
                  const approval = data.approvals.find(a => a.role_label === label) ?? {
                    id: label, role_label: label, approver_id: null,
                    approver_name: null, approved_at: null, comment: null, display_order: 0,
                  };
                  return (
                    <ApprovalStamp
                      key={label}
                      approval={approval}
                      onApprove={handleApprove}
                      onRevoke={handleRevoke}
                    />
                  );
                })}
              </div>
            </div>

            {/* 案件/受注情報 */}
            <div className="card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>■ 案件</span>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>見積提出日</span>
                <span style={{ fontSize: 12 }}>{fmtDateISO(data.quote_issue_date)}</span>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>提出金額</span>
                <span style={{ fontSize: 12, fontFamily: "var(--ff-mono)", fontWeight: 700 }}>
                  {fmtYen(data.quote_total_amount)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)" }}>□ 受注</span>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>見積提出日</span>
                <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>—</span>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>決定金額</span>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>←手入力</span>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 10px", borderRadius: "var(--r-md)",
                background: "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))",
                border: "1px solid color-mix(in oklab, var(--c-primary) 20%, var(--c-border))",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>工事価格</span>
                <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "var(--ff-mono)", color: "var(--c-primary)" }}>
                  {fmtYen(data.project_price)}
                </span>
              </div>
            </div>

            {/* 目標営業利益 */}
            <div className="card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>目標営業利益 ✎</div>
              {editMode ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>利益率 (%)</div>
                    <Input type="number" step="0.1" value={form.target_profit_rate}
                      onChange={e => setForm(f => ({ ...f, target_profit_rate: e.target.value }))}
                      style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 2 }}>利益額</div>
                    <Input type="number" value={form.target_profit_amount}
                      onChange={e => setForm(f => ({ ...f, target_profit_amount: e.target.value }))}
                      style={{ fontSize: 12 }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>利益率: </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {data.target_profit_rate != null ? `${data.target_profit_rate}%` : "—"}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>利益額: </span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--ff-mono)" }}>
                      {fmtYen(data.target_profit_amount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 工事割出 3列集計 ── */}
        {cs && (
          <div className="card" style={{ padding: "12px 14px", overflowX: "auto" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>工事割出</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH style={{ width: 160, textAlign: "left" }}> </TH>
                  <TH>実行予算</TH>
                  <TH style={{ width: 50 }}>比率</TH>
                  <TH>取決見通</TH>
                  <TH style={{ width: 50 }}>比率</TH>
                  <TH>精算(支払)見通</TH>
                  <TH style={{ width: 50 }}>比率</TH>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <TD>直接工事費</TD>
                  <TD num>{fmtYen(cs.direct_cost_budget)}</TD>
                  <TD num style={{ fontSize: 11 }}>
                    {data.project_price ? `${((cs.direct_cost_budget / data.project_price) * 100).toFixed(1)}` : "—"}
                  </TD>
                  <TD num>{fmtYen(cs.direct_cost_agreed)}</TD>
                  <TD num style={{ fontSize: 11 }}>
                    {data.project_price ? `${((cs.direct_cost_agreed / data.project_price) * 100).toFixed(1)}` : "—"}
                  </TD>
                  <TD num>{fmtYen(cs.direct_cost_settlement)}</TD>
                  <TD num style={{ fontSize: 11 }}>—</TD>
                </tr>
                <tr>
                  <TD>現場経費</TD>
                  <TD num>{fmtYen(cs.site_overhead_total)}</TD>
                  <TD num style={{ fontSize: 11 }}>
                    {data.project_price ? `${((cs.site_overhead_total / data.project_price) * 100).toFixed(1)}` : "—"}
                  </TD>
                  <TD num>{fmtYen(cs.site_overhead_total)}</TD>
                  <TD num style={{ fontSize: 11 }}>—</TD>
                  <TD num>{fmtYen(cs.site_overhead_total)}</TD>
                  <TD num style={{ fontSize: 11 }}>—</TD>
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <TD style={{ fontWeight: 700 }}>計</TD>
                  <TD num>{fmtYen(cs.direct_cost_budget + cs.site_overhead_total)}</TD>
                  <TD num style={{ fontSize: 11 }}>
                    {data.project_price ? `${(((cs.direct_cost_budget + cs.site_overhead_total) / data.project_price) * 100).toFixed(1)}` : "—"}
                  </TD>
                  <TD num>{fmtYen(cs.direct_cost_agreed + cs.site_overhead_total)}</TD>
                  <TD num style={{ fontSize: 11 }}>—</TD>
                  <TD num>{fmtYen(cs.direct_cost_settlement + cs.site_overhead_total)}</TD>
                  <TD num style={{ fontSize: 11 }}>—</TD>
                </tr>
                <tr style={{ background: "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))" }}>
                  <TD style={{ fontSize: 11 }}>経費（共通経費・一般管理費）</TD>
                  <TD num>{fmtYen(cs.construction_dept_overhead + cs.general_admin_cost)}</TD>
                  <TD num style={{ fontSize: 11 }}>10.0</TD>
                  <TD num>{fmtYen(cs.construction_dept_overhead + cs.general_admin_cost)}</TD>
                  <TD num style={{ fontSize: 11 }}>10.0</TD>
                  <TD num>{fmtYen(cs.construction_dept_overhead + cs.general_admin_cost)}</TD>
                  <TD num style={{ fontSize: 11 }}>10.0</TD>
                </tr>
                <tr>
                  <TD>営業利益①</TD>
                  <TD num style={{ color: cs.operating_profit >= 0 ? "var(--c-success)" : "var(--c-danger)" }}>
                    {fmtYen(cs.operating_profit)}
                  </TD>
                  <TD num style={{ fontSize: 11 }}>{(cs.operating_profit_rate * 100).toFixed(1)}</TD>
                  <TD num>—</TD>
                  <TD num style={{ fontSize: 11 }}>—</TD>
                  <TD num>—</TD>
                  <TD num style={{ fontSize: 11 }}>—</TD>
                </tr>
                <tr>
                  <TD>目標営業利益</TD>
                  <TD num style={{ color: "var(--c-text-muted)", fontSize: 11 }}>
                    {data.target_profit_amount != null ? fmtYen(data.target_profit_amount) :
                      data.target_profit_rate != null && data.project_price != null
                        ? fmtYen(data.project_price * data.target_profit_rate / 100)
                        : fmtYen(cs.target_operating_profit)}
                  </TD>
                  <TD num style={{ fontSize: 11 }}>
                    {data.target_profit_rate != null ? `${data.target_profit_rate}` : "10.0"}
                  </TD>
                  <TD colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── 現場経費内訳 ── */}
        {data.expense_items.length > 0 && (
          <div className="card" style={{ padding: "12px 14px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              現場経費内訳
              <span style={{ fontSize: 10, fontWeight: 400, color: "var(--c-text-muted)", marginLeft: 8 }}>
                🔒 修正しないでください（QCDS から自動取得）
              </span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {data.expense_items.map((e, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "4px 8px", borderRadius: "var(--r-sm)",
                  background: "var(--c-surface-2)", fontSize: 12,
                }}>
                  <span style={{ color: "var(--c-text-muted)" }}>{e.item_name}</span>
                  <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 600 }}>{fmtYen(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 表4: 統合テーブル ── */}
        <div className="card" style={{ padding: "12px 14px", overflowX: "auto" }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            実行予算表 / 取決見通表 / 精算(支払)見通表
          </h3>
          {data.direct_works.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--c-text-muted)" }}>QCDS に工事費行を登録すると表示されます</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  <TH style={{ width: 32 }}>No</TH>
                  <TH style={{ width: 100 }}>支払先</TH>
                  <TH style={{ width: 70 }}>工種</TH>
                  <TH style={{ background: "color-mix(in oklab, #3b82f6 10%, var(--c-surface))" }}>実行予算</TH>
                  <TH style={{ background: "color-mix(in oklab, #f97316 10%, var(--c-surface))" }}>取決金額</TH>
                  <TH style={{ width: 28 }}>✓</TH>
                  <TH style={{ width: 80, background: "color-mix(in oklab, #f97316 10%, var(--c-surface))" }}>取決差額</TH>
                  {showMths.map(m => (
                    <TH key={m} style={{ width: 72, background: "color-mix(in oklab, #16a34a 8%, var(--c-surface))" }}>
                      {m}月
                    </TH>
                  ))}
                  <TH style={{ background: "color-mix(in oklab, #16a34a 10%, var(--c-surface))" }}>支払計</TH>
                  <TH style={{ width: 80 }}>残支払</TH>
                </tr>
              </thead>
              <tbody>
                {data.direct_works.map((w, i) => {
                  const payTotal = showMths.reduce((s, m) => s + (w.monthly_payments[m] ?? 0), 0);
                  const remaining = (w.agreed_amount ?? 0) - payTotal;
                  const diff = (w.budget_amount ?? 0) - (w.agreed_amount ?? 0);
                  return (
                    <tr key={w.id} style={{
                      background: w.payment_completed
                        ? "color-mix(in oklab, var(--c-success) 6%, var(--c-surface))"
                        : undefined,
                    }}>
                      <TD style={{ textAlign: "center", fontSize: 11, color: "var(--c-text-muted)" }}>{i + 1}</TD>
                      <TD>{w.vendor_name || "—"}</TD>
                      <TD style={{ fontSize: 11 }}>{w.work_type || "—"}</TD>
                      <TD num style={{ background: "color-mix(in oklab, #3b82f6 5%, var(--c-surface))" }}>
                        {fmtYen(w.budget_amount)}
                      </TD>
                      <TD num style={{ background: "color-mix(in oklab, #f97316 5%, var(--c-surface))" }}>
                        {fmtYen(w.agreed_amount)}
                      </TD>
                      <TD style={{ textAlign: "center", fontSize: 11 }}>
                        {w.agreement_checked ? "レ" : "□"}
                      </TD>
                      <TD num style={{ background: "color-mix(in oklab, #f97316 5%, var(--c-surface))", fontSize: 11 }}>
                        {diff !== 0 ? fmtYen(diff) : "—"}
                      </TD>
                      {showMths.map(m => (
                        <TD key={m} num style={{
                          background: "color-mix(in oklab, #16a34a 4%, var(--c-surface))", fontSize: 11,
                        }}>
                          {w.monthly_payments[m] != null && w.monthly_payments[m]! > 0
                            ? fmtYen(w.monthly_payments[m])
                            : ""}
                        </TD>
                      ))}
                      <TD num style={{ background: "color-mix(in oklab, #16a34a 8%, var(--c-surface))", fontWeight: 600 }}>
                        {payTotal > 0 ? fmtYen(payTotal) : "—"}
                      </TD>
                      <TD num style={{ color: remaining > 0 ? "var(--c-danger)" : "var(--c-text-muted)" }}>
                        {w.payment_completed ? (
                          <span style={{ color: "var(--c-success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
                            <CheckCircle2 size={11} /> 済
                          </span>
                        ) : (
                          w.agreed_amount ? fmtYen(remaining) : "—"
                        )}
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <TD colSpan={3} style={{ fontSize: 11, fontWeight: 700 }}>直接工事費 計</TD>
                  <TD num style={{ background: "color-mix(in oklab, #3b82f6 8%, var(--c-surface))" }}>
                    {fmtYen(data.direct_works.reduce((s, w) => s + (w.budget_amount ?? 0), 0))}
                  </TD>
                  <TD num style={{ background: "color-mix(in oklab, #f97316 8%, var(--c-surface))" }}>
                    {fmtYen(data.direct_works.reduce((s, w) => s + (w.agreed_amount ?? 0), 0))}
                  </TD>
                  <TD />
                  <TD num style={{ background: "color-mix(in oklab, #f97316 8%, var(--c-surface))" }}>
                    {fmtYen(
                      data.direct_works.reduce((s, w) => s + (w.budget_amount ?? 0) - (w.agreed_amount ?? 0), 0)
                    )}
                  </TD>
                  {showMths.map(m => (
                    <TD key={m} num style={{ background: "color-mix(in oklab, #16a34a 6%, var(--c-surface))", fontSize: 11 }}>
                      {fmtYen(data.direct_works.reduce((s, w) => s + (w.monthly_payments[m] ?? 0), 0)) === "¥0" ? "" :
                        fmtYen(data.direct_works.reduce((s, w) => s + (w.monthly_payments[m] ?? 0), 0))}
                    </TD>
                  ))}
                  <TD num style={{ background: "color-mix(in oklab, #16a34a 10%, var(--c-surface))" }}>
                    {fmtYen(data.direct_works.reduce((s, w) =>
                      s + showMths.reduce((ms, m) => ms + (w.monthly_payments[m] ?? 0), 0), 0
                    ))}
                  </TD>
                  <TD />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>
    </AppShell>
  );
}
