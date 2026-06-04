"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ClipboardCheck, Download, FileText, Plus, Stamp, Trash2, Unlink } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { fmtYen, fmtDateISO } from "@/lib/format";
import { OrderCreate, OrderRead } from "@/types/order";
import { AcknowledgmentRead } from "@/types/acknowledgment";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft:     { background: "var(--c-surface-2)",                                                          color: "var(--c-text-muted)" },
  sent:      { background: "color-mix(in oklab, var(--c-primary) 14%, var(--c-surface))",                 color: "var(--c-primary)" },
  signed:    { background: "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))",                 color: "var(--c-success)" },
  cancelled: { background: "color-mix(in oklab, var(--c-danger) 14%, var(--c-surface))",                  color: "var(--c-danger)" },
};
const STATUS_LABEL: Record<string, string> = {
  draft: "下書き", sent: "発行済み", signed: "サイン受領済", cancelled: "キャンセル",
};

const DEFAULT_TERMS = `1. 工事の範囲は別紙設計図書のとおりとする。
2. 工事の変更は、甲乙協議のうえ書面にて行う。
3. 天候その他不可抗力による工期延長は、別途協議する。
4. 保証期間は完工後1年間とする。`;

// ── 進捗ステップバー ─────────────────────────────────────────────────────
const STEPS = [
  { key: "draft",  label: "下書き" },
  { key: "sent",   label: "送付済" },
  { key: "signed", label: "先方押印" },
  { key: "ack",    label: "受領済" },   // 注文請書発行済み（calculated）
] as const;

function StepsBar({ status, hasAck, issueDate }: { status: string; hasAck: boolean; issueDate: string | null }) {
  const stepIdx = status === "signed" && hasAck ? 3
    : status === "signed"   ? 2
    : status === "sent"     ? 1
    : status === "cancelled"? -1
    : 0;

  return (
    <div style={{
      display: "flex", alignItems: "stretch", gap: 0,
      background: "var(--c-surface)", border: "1px solid var(--c-border)",
      borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 12,
    }}>
      {STEPS.map((step, i) => {
        const done   = i < stepIdx;
        const active = i === stepIdx;
        const future = i > stepIdx;
        return (
          <div key={step.key} style={{
            flex: 1, padding: "10px 14px",
            borderRight: i < STEPS.length - 1 ? "1px solid var(--c-border)" : undefined,
            background: active ? "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))" : undefined,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {/* アイコン */}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: done ? "var(--c-success)"
                : active ? "var(--c-primary)"
                : "var(--c-surface-2)",
              color: done || active ? "#fff" : "var(--c-text-muted)",
              fontSize: 11, fontWeight: 700,
            }}>
              {done ? <Check size={12} /> : i + 1}
            </div>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: done ? "var(--c-success)" : active ? "var(--c-primary)" : "var(--c-text-muted)",
              }}>
                {step.label}
              </div>
              {done && issueDate && i === 0 && (
                <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{fmtDateISO(issueDate)}</div>
              )}
              {active && step.key === "signed" && !hasAck && (
                <div style={{ fontSize: 10, color: "var(--c-primary)" }}>注文請書発行待ち</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ラベル付きフィールド ────────────────────────────────────────────────
function LI({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, color: "var(--c-text-muted)", marginBottom: 3, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── 空状態 ───────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", gap: 12, color: "var(--c-text-muted)" }}>
      <FileText size={36} strokeWidth={1.5} />
      <p style={{ fontSize: 14, fontWeight: 600 }}>注文書がありません</p>
      <Button variant="default" size="sm" onClick={onNew}
        style={{ background: "var(--c-primary)", color: "#fff", marginTop: 4 }}>
        <Plus size={13} /> 新規作成
      </Button>
    </div>
  );
}

/** 注文書管理画面 — スクショ準拠 2カラムレイアウト */
export default function OrderPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRead[]>([]);
  const [selected, setSelected] = useState<OrderRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [issuingAck, setIssuingAck] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [hasAck, setHasAck] = useState(false);

  const canIssueOrder = ["admin", "super_admin", "accounting", "manager"].includes(user?.role ?? "");

  const [issueDate, setIssueDate]           = useState("");
  const [clientCompany, setClientCompany]   = useState("");
  const [clientPerson, setClientPerson]     = useState("");
  const [clientAddress, setClientAddress]   = useState("");
  const [taxRegNumber, setTaxRegNumber]     = useState("");
  const [amountExclTax, setAmountExclTax]   = useState("");
  const [periodStart, setPeriodStart]       = useState("");
  const [periodEnd, setPeriodEnd]           = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [workContent, setWorkContent]       = useState("添付工事内訳書の通り");
  const [notes, setNotes]                   = useState("");
  const [terms, setTerms]                   = useState(DEFAULT_TERMS);

  useEffect(() => { loadOrders(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadOrders(keepSelectedId?: string) {
    setLoading(true);
    try {
      const data = await apiFetch<OrderRead[]>(`/api/v1/projects/${projectId}/orders`);
      setOrders(data);
      if (data.length > 0) {
        const toSelect = keepSelectedId ? (data.find(o => o.id === keepSelectedId) ?? data[0]) : data[0];
        selectOrder(toSelect);
        // 注文請書があるか確認
        try {
          const acks = await apiFetch<{ id: string }[]>(`/api/v1/projects/${projectId}/acknowledgments`);
          setHasAck(acks.length > 0);
        } catch { setHasAck(false); }
      } else {
        setSelected(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function selectOrder(o: OrderRead) {
    setSelected(o);
    setIssueDate(o.issue_date || "");
    setClientCompany(o.client_company || "");
    setClientPerson(o.client_person || "");
    setClientAddress(o.client_address || "");
    setTaxRegNumber("");  // モデルにないフィールド（表示用のみ）
    setAmountExclTax(o.amount_excl_tax?.toString() || "");
    setPeriodStart(o.construction_period_start || "");
    setPeriodEnd(o.construction_period_end || "");
    setPaymentCondition(o.payment_condition || "");
    setWorkContent(o.work_content ?? "添付工事内訳書の通り");
    setNotes(o.notes || "");
    setTerms(o.terms_and_conditions || DEFAULT_TERMS);
  }

  function clearForm() {
    setSelected(null);
    setIssueDate(""); setClientCompany(""); setClientPerson(""); setClientAddress("");
    setTaxRegNumber(""); setAmountExclTax(""); setPeriodStart(""); setPeriodEnd("");
    setPaymentCondition(""); setWorkContent("添付工事内訳書の通り"); setNotes(""); setTerms(DEFAULT_TERMS);
  }

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 4000); };

  async function handleSave() {
    setSaving(true);
    const body: OrderCreate = {
      issue_date: issueDate || null,
      client_company: clientCompany || null,
      client_person: clientPerson || null,
      client_address: clientAddress || null,
      amount_excl_tax: amountExclTax ? parseFloat(amountExclTax) : null,
      construction_period_start: periodStart || null,
      construction_period_end: periodEnd || null,
      payment_condition: paymentCondition || null,
      work_content: workContent || null,
      notes: notes || null,
      terms_and_conditions: terms || null,
    };
    try {
      if (selected) {
        await apiFetch(`/api/v1/projects/${projectId}/orders/${selected.id}`, {
          method: "PATCH", body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/api/v1/projects/${projectId}/orders`, {
          method: "POST", body: JSON.stringify(body),
        });
      }
      showMsg("保存しました");
      await loadOrders(selected?.id);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  }

  async function handleIssueAcknowledgment(orderId?: string) {
    const targetId = orderId ?? selected?.id;
    if (!targetId) return;
    setIssuingAck(true);
    try {
      const ack = await apiFetch<AcknowledgmentRead>(
        `/api/v1/projects/${projectId}/orders/${targetId}/issue-acknowledgment`,
        { method: "POST" }
      );
      showMsg(`注文請書 ${ack.acknowledgment_number} を発行しました`);
      await loadOrders(targetId);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setIssuingAck(false); }
  }

  async function handleUnlink() {
    if (!selected) return;
    setUnlinking(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/orders/${selected.id}/unlink`, { method: "PATCH" });
      showMsg("見積連動を解除しました");
      await loadOrders(selected.id);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setUnlinking(false); }
  }

  async function handleDeleteSelected() {
    if (checkedIds.size === 0) return;
    if (!confirm(`選択した ${checkedIds.size} 件の注文書を削除しますか？\n※関連する注文請書も削除されます。`)) return;
    setDeleting(true);
    try {
      await Promise.all([...checkedIds].map(id =>
        apiFetch(`/api/v1/projects/${projectId}/orders/${id}`, { method: "DELETE" })
      ));
      setCheckedIds(new Set());
      await loadOrders(selected && !checkedIds.has(selected.id) ? selected.id : undefined);
      showMsg("削除しました");
    } catch (e) { showMsg(`削除エラー: ${(e as Error).message}`); }
    finally { setDeleting(false); }
  }

  async function handleStatusChange(newStatus: string) {
    if (!selected) return;
    const currentId = selected.id;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/orders/${currentId}`, {
        method: "PATCH", body: JSON.stringify({ status: newStatus }),
      });
      if (newStatus === "sent") {
        await handleIssueAcknowledgment(currentId);
        return;
      }
      showMsg("ステータスを更新しました");
      await loadOrders(currentId);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  async function handleApplyFromProject() {
    setApplying(true);
    try {
      const proj = await apiFetch<{
        project_name: string; client_name: string | null;
        project_location: string | null; period_start: string | null;
        period_end: string | null; payment_condition: string | null;
      }>(`/api/v1/projects/${projectId}`);
      const quotes = await apiFetch<{ items?: { subtotal: number | null; total_amount: number | null }[] }>(
        `/api/v1/projects/${projectId}/quotes`
      ).catch(() => ({ items: [] }));
      const latestQuote = Array.isArray(quotes) ? quotes[0] : (quotes.items ?? [])[0];
      setIssueDate(new Date().toISOString().slice(0, 10));
      if (proj.client_name) setClientCompany(proj.client_name);
      if (proj.project_location) setClientAddress(proj.project_location);
      if (proj.project_name) setWorkContent(proj.project_name);
      if (proj.period_start) setPeriodStart(proj.period_start);
      if (proj.period_end) setPeriodEnd(proj.period_end);
      if (proj.payment_condition) setPaymentCondition(proj.payment_condition);
      if (latestQuote?.subtotal) setAmountExclTax(String(Math.round(latestQuote.subtotal)));
      showMsg("案件情報を適用しました。内容をご確認ください。");
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setApplying(false); }
  }

  const taxAmount   = amountExclTax ? Math.floor(parseFloat(amountExclTax) * 0.10) : null;
  const totalAmount = amountExclTax && taxAmount !== null ? parseFloat(amountExclTax) + taxAmount : null;
  const isLinked    = selected?.linked_to_quote && selected?.quote_id;
  const canIssueAck = selected?.status === "signed" && !hasAck;

  // タイトル生成
  const orderTitle = clientCompany
    ? `${clientCompany} 様向け 注文書`
    : (selected ? "注文書" : "新規注文書");
  const orderSubtitle = [workContent, periodStart && periodEnd ? `工期 ${fmtDateISO(periodStart)}〜${fmtDateISO(periodEnd)}` : ""].filter(Boolean).join(" · ");

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "注文書" },
      ]}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {msg && (
            <span style={{ fontSize: 12, color: msg.startsWith("エラー") || msg.startsWith("削除エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
              {msg}
            </span>
          )}
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)" }}>読み込み中…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>

          {/* ── 左: 一覧 ── */}
          <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
            <div style={{
              padding: "8px 12px", borderBottom: "1px solid var(--c-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-muted)" }}>
                {checkedIds.size > 0 ? `${checkedIds.size}件選択` : "一覧"}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {checkedIds.size > 0 && (
                  <button onClick={handleDeleteSelected} disabled={deleting}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-danger)", fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
                    <Trash2 size={12} />{deleting ? "削除中" : `削除(${checkedIds.size})`}
                  </button>
                )}
                <button onClick={clearForm}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-primary)" }}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
            {orders.length === 0 ? (
              <p style={{ padding: 14, fontSize: 12, color: "var(--c-text-muted)", textAlign: "center" }}>注文書がありません</p>
            ) : orders.map(o => (
              <div key={o.id} style={{
                display: "flex", alignItems: "stretch",
                borderBottom: "1px solid var(--c-border)",
                borderLeft: selected?.id === o.id ? "2px solid var(--c-primary)" : "2px solid transparent",
                background: selected?.id === o.id ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))" : "none",
              }}>
                <label style={{ display: "flex", alignItems: "center", padding: "0 4px 0 8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checkedIds.has(o.id)}
                    onChange={e => { const n = new Set(checkedIds); e.target.checked ? n.add(o.id) : n.delete(o.id); setCheckedIds(n); }}
                    onClick={e => e.stopPropagation()} />
                </label>
                <button onClick={() => selectOrder(o)} style={{
                  flex: 1, textAlign: "left", padding: "8px 10px 8px 4px",
                  background: "none", border: "none", cursor: "pointer",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text)" }}>{o.order_number}</p>
                  <p style={{ fontSize: 10, color: "var(--c-text-muted)", marginTop: 1 }}>{o.issue_date || "日付未定"}</p>
                  <span style={{
                    display: "inline-flex", marginTop: 3, padding: "1px 6px",
                    borderRadius: "var(--r-pill)", fontSize: 9, fontWeight: 600,
                    ...(STATUS_STYLE[o.status] || STATUS_STYLE.draft),
                  }}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </button>
              </div>
            ))}
          </div>

          {/* ── 右: 詳細 ── */}
          <div>
            {!selected && orders.length === 0 ? (
              <div className="card"><EmptyState onNew={clearForm} /></div>
            ) : (
              <>
                {/* ─ ヘッダー ─ */}
                <div style={{
                  padding: "12px 16px", marginBottom: 8,
                  background: "var(--c-surface)", border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)",
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                }}>
                  <div>
                    {selected?.order_number && (
                      <div style={{ fontSize: 10, color: "var(--c-text-muted)", fontFamily: "var(--ff-mono)", marginBottom: 2 }}>
                        {selected.order_number}
                      </div>
                    )}
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)" }}>{orderTitle}</div>
                    {orderSubtitle && (
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>{orderSubtitle}</div>
                    )}
                  </div>
                  {/* ヘッダー右: ステータス + ボタン */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {/* ステータスドロップダウン */}
                    {selected && (
                      <div style={{ position: "relative" }}>
                        <select
                          value={selected.status}
                          onChange={e => handleStatusChange(e.target.value)}
                          style={{
                            padding: "4px 28px 4px 10px", fontSize: 11, fontWeight: 600,
                            border: "1px solid var(--c-border)", borderRadius: "var(--r-pill)",
                            cursor: "pointer", appearance: "none",
                            ...(STATUS_STYLE[selected.status] || STATUS_STYLE.draft),
                          }}
                        >
                          {(["draft","sent","signed","cancelled"] as const).map(s => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10 }}>▾</span>
                      </div>
                    )}
                    {/* PDF */}
                    {selected && (
                      <button
                        onClick={async () => {
                          setPdfLoading(true);
                          try {
                            const r = await fetch(`${API_URL}/api/v1/projects/${projectId}/orders/${selected.id}/export-pdf`, {
                              headers: { Authorization: `Bearer ${getToken()}` },
                            });
                            if (!r.ok) throw new Error(`HTTP ${r.status}`);
                            const blob = await r.blob();
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `注文書_${selected.order_number || selected.id}.pdf`;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                          } catch (e) { alert(`PDF生成エラー: ${(e as Error).message}`); }
                          finally { setPdfLoading(false); }
                        }}
                        disabled={pdfLoading}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "4px 12px", fontSize: 11, fontWeight: 600,
                          border: "1px solid var(--c-border)", borderRadius: "var(--r-pill)",
                          cursor: "pointer", background: "var(--c-surface)", color: "var(--c-text)",
                        }}
                      >
                        <Download size={12} /> {pdfLoading ? "生成中…" : "PDF"}
                      </button>
                    )}
                    {/* Excel */}
                    {selected && (
                      <button
                        onClick={() => fetch(`${API_URL}/api/v1/projects/${projectId}/orders/${selected.id}/export`, {
                          headers: { Authorization: `Bearer ${getToken()}` },
                        }).then(r => r.blob()).then(blob => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `注文書_${selected.order_number || selected.id}.xlsx`;
                          a.click();
                        })}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "4px 12px", fontSize: 11, fontWeight: 600,
                          border: "1px solid var(--c-border)", borderRadius: "var(--r-pill)",
                          cursor: "pointer", background: "var(--c-surface)", color: "var(--c-text)",
                        }}
                      >
                        <Download size={12} /> Excel
                      </button>
                    )}
                    {/* 案件から適用 */}
                    {canIssueOrder && (
                      <button onClick={handleApplyFromProject} disabled={applying}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "4px 12px", fontSize: 11, fontWeight: 600,
                          border: "1px solid var(--c-border)", borderRadius: "var(--r-pill)",
                          cursor: "pointer", background: "var(--c-surface)", color: "var(--c-text-muted)",
                        }}
                        title="案件詳細・見積書の情報を自動入力します"
                      >
                        <ClipboardCheck size={12} /> {applying ? "取得中…" : "案件から適用"}
                      </button>
                    )}
                    {/* 保存 */}
                    <button onClick={handleSave} disabled={saving || !canIssueOrder}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "4px 16px", fontSize: 11, fontWeight: 700,
                        border: "none", borderRadius: "var(--r-pill)",
                        cursor: "pointer", background: "var(--c-primary)", color: "#fff",
                        opacity: saving || !canIssueOrder ? 0.6 : 1,
                      }}
                    >
                      {saving ? "保存中…" : "保存"}
                    </button>
                  </div>
                </div>

                {/* ─ 進捗ステップ ─ */}
                {selected && (
                  <StepsBar
                    status={selected.status}
                    hasAck={hasAck}
                    issueDate={selected.issue_date}
                  />
                )}

                {/* ─ 見積連動バナー ─ */}
                {isLinked && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                    padding: "8px 14px", borderRadius: "var(--r-md)", fontSize: 12,
                    background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
                    border: "1px solid color-mix(in oklab, var(--c-primary) 30%, var(--c-border))",
                    color: "var(--c-primary)",
                  }}>
                    <span>この注文書は見積書と連動中（金額・明細は自動同期）</span>
                    <button onClick={handleUnlink} disabled={unlinking}
                      style={{
                        marginLeft: "auto", background: "none", border: "1px solid currentColor",
                        borderRadius: "var(--r-sm)", padding: "2px 8px", cursor: "pointer",
                        fontSize: 11, color: "var(--c-primary)", display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <Unlink size={11} /> {unlinking ? "解除中…" : "連動を解除"}
                    </button>
                  </div>
                )}

                {/* ─ 2カラムボディ ─ */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>

                  {/* 左: 発注先・件名フォーム */}
                  <div className="card" style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)", marginBottom: 14, borderBottom: "1px solid var(--c-border)", paddingBottom: 8 }}>
                      発注先・件名
                      <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6 }}>クリックして編集</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <LI label="発注先（会社名）">
                          <Input value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="株式会社○○" style={{ fontSize: 13, fontWeight: 600 }} />
                        </LI>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <LI label="住所・TEL">
                          <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="福井県坂井市…" />
                        </LI>
                      </div>
                      <LI label="担当者">
                        <Input value={clientPerson} onChange={e => setClientPerson(e.target.value)} placeholder="田中 一郎 課長" />
                      </LI>
                      <LI label="登録番号（インボイス）">
                        <Input value={taxRegNumber} onChange={e => setTaxRegNumber(e.target.value)} placeholder="T1234567890123" style={{ fontFamily: "var(--ff-mono)" }} />
                      </LI>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <LI label="件名（工事内容）">
                          <Input value={workContent} onChange={e => setWorkContent(e.target.value)} placeholder="○○工事 一式" />
                        </LI>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <LI label="工事場所">
                          <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="福井県坂井市三国町…" />
                        </LI>
                      </div>
                      <LI label="工期 開始">
                        <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                      </LI>
                      <LI label="工期 終了">
                        <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                      </LI>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <LI label="支払条件">
                          <Input value={paymentCondition} onChange={e => setPaymentCondition(e.target.value)} placeholder="月末締・翌月末払（現金）" />
                        </LI>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <LI label="備考">
                          <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            placeholder="・出来高に応じて月末に請求書を発行ください&#10;・養生・引渡し清掃含む"
                            style={{
                              width: "100%", boxSizing: "border-box", padding: "6px 10px",
                              fontSize: 12, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                              background: "var(--c-surface)", color: "var(--c-text)", resize: "vertical",
                            }}
                          />
                        </LI>
                      </div>
                    </div>
                  </div>

                  {/* 右: 金額カード（ダーク） */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* 注文金額カード */}
                    <div style={{
                      borderRadius: "var(--r-lg)",
                      background: "var(--c-primary)",
                      color: "#fff",
                      padding: "20px 20px 16px",
                    }}>
                      <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>注文金額（税込）</div>
                      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "var(--ff-mono)", letterSpacing: "-0.02em", marginBottom: 16 }}>
                        {fmtYen(totalAmount ?? selected?.total_amount)}
                      </div>
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.9 }}>
                          <span>小計（税抜）</span>
                          <span style={{ fontFamily: "var(--ff-mono)" }}>{fmtYen(amountExclTax ? parseFloat(amountExclTax) : (selected?.amount_excl_tax ?? null))}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.9 }}>
                          <span>消費税（10%）</span>
                          <span style={{ fontFamily: "var(--ff-mono)" }}>{fmtYen(taxAmount ?? selected?.tax_amount ?? null)}</span>
                        </div>
                        <LI label="">
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                            <span>税抜金額（円）入力</span>
                          </div>
                        </LI>
                        <div style={{ marginTop: 2 }}>
                          <Input
                            type="number"
                            value={amountExclTax}
                            onChange={e => setAmountExclTax(e.target.value)}
                            placeholder="税抜金額を入力"
                            style={{
                              fontSize: 12, background: "rgba(255,255,255,0.15)",
                              border: "1px solid rgba(255,255,255,0.3)",
                              color: "#fff",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 印紙税 */}
                    {selected?.stamp_tax != null && (
                      <div style={{
                        padding: "12px 16px", borderRadius: "var(--r-md)",
                        background: "var(--c-surface)", border: "1px solid var(--c-border)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>印紙税額（自動算定）</div>
                            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--ff-mono)" }}>
                              {fmtYen(selected.stamp_tax)}
                            </div>
                          </div>
                          <Stamp size={20} style={{ color: "var(--c-text-muted)", opacity: 0.5 }} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginTop: 6 }}>
                          {totalAmount && totalAmount > 2000000
                            ? "第2号文書（請負）/ 100万円超"
                            : "第2号文書（請負）"}
                        </div>
                      </div>
                    )}

                    {/* 注文請書発行 */}
                    {canIssueAck ? (
                      <div style={{
                        padding: "14px 16px", borderRadius: "var(--r-md)",
                        background: "color-mix(in oklab, var(--c-success) 8%, var(--c-surface))",
                        border: "1px solid color-mix(in oklab, var(--c-success) 30%, var(--c-border))",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-success)", marginBottom: 4 }}>
                          注文請書を発行できる状態です
                        </div>
                        <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 10 }}>
                          先方押印（signed）になりました。注文請書ドラフトを生成して案件に紐付けます。
                        </div>
                        <button
                          onClick={() => handleIssueAcknowledgment()}
                          disabled={issuingAck}
                          style={{
                            width: "100%", padding: "8px 0", fontSize: 12, fontWeight: 700,
                            border: "none", borderRadius: "var(--r-md)", cursor: "pointer",
                            background: "var(--c-success)", color: "#fff",
                            opacity: issuingAck ? 0.7 : 1,
                          }}
                        >
                          {issuingAck ? "発行中…" : "注文請書を発行する"}
                        </button>
                      </div>
                    ) : hasAck ? (
                      <div style={{
                        padding: "10px 14px", borderRadius: "var(--r-md)",
                        background: "var(--c-surface)", border: "1px solid var(--c-border)",
                        fontSize: 12, color: "var(--c-success)", display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <Check size={14} />
                        注文請書を発行済みです
                      </div>
                    ) : null}

                    {/* 発行日 */}
                    <div className="card" style={{ padding: "12px 16px" }}>
                      <LI label="発行日">
                        <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={{ fontSize: 12 }} />
                      </LI>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
