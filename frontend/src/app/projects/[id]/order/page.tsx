"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ChevronDown, ClipboardCheck, Download, Plus, Trash2, Unlink } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { fmtYen } from "@/lib/format";
import { OrderCreate, OrderRead } from "@/types/order";
import { AcknowledgmentRead } from "@/types/acknowledgment";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

// ── ステータス定義 (HTML .ord-status 準拠) ─────────────────────────────
const STATUS_META: Record<string, { label: string; dot: string; border: string; bg: string; text: string }> = {
  draft:     { label: "下書き",        dot: "var(--c-text-muted)",  border: "var(--c-text-muted)",  bg: "var(--c-surface)",                                                     text: "var(--c-text-muted)"  },
  sent:      { label: "発行済み",      dot: "var(--c-primary)",    border: "var(--c-primary)",    bg: "color-mix(in oklab,var(--c-primary) 8%,var(--c-surface))",              text: "var(--c-primary)"    },
  signed:    { label: "サイン受領済",  dot: "var(--c-warn)",       border: "var(--c-warn)",       bg: "var(--c-warn-bg,#fffbeb)",                                              text: "#b45309"             },
  cancelled: { label: "キャンセル",    dot: "var(--c-danger)",     border: "var(--c-danger)",     bg: "var(--c-danger-bg,#fef2f2)",                                            text: "var(--c-danger)"     },
};

const DEFAULT_TERMS = `1. 工事の範囲は別紙設計図書のとおりとする。
2. 工事の変更は、甲乙協議のうえ書面にて行う。
3. 天候その他不可抗力による工期延長は、別途協議する。
4. 保証期間は完工後1年間とする。`;

// ── ステータスバッジ（ドロップダウン付き） ──────────────────────────────
function StatusBadge({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const m = STATUS_META[status] || STATUS_META.draft;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: "var(--r-md)",
          border: `1.5px solid ${m.border}`,
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          background: m.bg, color: m.text,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
        {m.label}
        <ChevronDown size={11} style={{ color: "var(--c-text-muted)" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: "var(--r-md)", boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          minWidth: 140, overflow: "hidden",
        }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <button key={key} onClick={() => { onChange(key); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "8px 12px", border: "none",
                background: status === key ? "var(--c-surface-2)" : "none",
                cursor: "pointer", fontSize: 12, fontWeight: status === key ? 700 : 400,
                textAlign: "left", color: meta.text,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot }} />
              {meta.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── タイムライン ──────────────────────────────────────────────────────
function TlArrow() {
  return (
    <svg style={{ color: "var(--c-text-muted)", flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
const TL_STEPS = [
  { key: "draft",  label: "下書き" },
  { key: "sent",   label: "送付済（sent）" },
  { key: "signed", label: "先方押印済（signed）" },
  { key: "ack",    label: "受領済（acknowledged）" },
];
function Timeline({ status, hasAck, issueDate }: { status: string; hasAck: boolean; issueDate: string | null }) {
  const stepIdx = hasAck ? 3 : status === "signed" ? 2 : status === "sent" ? 1 : status === "cancelled" ? -1 : 0;
  return (
    <div style={{
      background: "var(--c-surface)", border: "1px solid var(--c-border)",
      borderRadius: "var(--r-lg)", padding: "14px 18px", marginBottom: 14,
      display: "flex", gap: 12, alignItems: "center",
    }}>
      {TL_STEPS.map((step, i) => {
        const done = i < stepIdx;
        const cur  = i === stepIdx;
        return (
          <div key={step.key} style={{ display: "contents" }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 11,
              color: done ? "var(--c-text)" : cur ? "var(--c-warn)" : "var(--c-text-muted)",
              fontWeight: cur ? 700 : 400,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                display: "grid", placeItems: "center",
                fontSize: 11, fontWeight: 700, fontFamily: "var(--ff-mono)",
                background: done ? "var(--c-success)" : cur ? "var(--c-warn)" : "var(--c-surface-2)",
                border: `1.5px solid ${done ? "var(--c-success)" : cur ? "var(--c-warn)" : "var(--c-border)"}`,
                color: done || cur ? "#fff" : "var(--c-text-muted)",
              }}>
                {done ? <Check size={12} /> : cur ? "●" : i + 1}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{step.label}</div>
                {i === 0 && done && issueDate && (
                  <div style={{ fontFamily: "var(--ff-mono)", fontSize: 10 }}>{issueDate}</div>
                )}
                {i === 2 && cur && (
                  <div style={{ fontFamily: "var(--ff-mono)", fontSize: 10 }}>注文請書発行待ち</div>
                )}
              </div>
            </div>
            {i < TL_STEPS.length - 1 && <TlArrow />}
          </div>
        );
      })}
    </div>
  );
}

// ── フィールドグリッド（HTML .ord-field-grid 準拠）────────────────────
// 各セルをクリックで編集モード
function K({ children, noBorder }: { children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div style={{
      padding: "9px 12px", fontSize: 12, fontWeight: 500,
      background: "var(--c-surface-2)", color: "var(--c-text-muted)",
      borderBottom: noBorder ? "none" : "1px solid var(--c-border)",
      borderRight: "1px solid var(--c-border)",
      display: "flex", alignItems: "center", minHeight: 36,
    }}>
      {children}
    </div>
  );
}
function V({
  value, onChange, span2, type = "text", multiline, placeholder, mono, noBorder,
}: {
  value: string; onChange: (v: string) => void;
  span2?: boolean; type?: string; multiline?: boolean; placeholder?: string; mono?: boolean; noBorder?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const isEmpty = !value;

  const cellStyle: React.CSSProperties = {
    padding: "9px 12px", fontSize: 13,
    borderBottom: noBorder ? "none" : "1px solid var(--c-border)",
    borderRight: span2 ? "none" : "1px solid var(--c-border)",
    display: "flex", alignItems: multiline ? "flex-start" : "center", minHeight: 36,
    gridColumn: span2 ? "2 / span 3" : undefined,
    cursor: "pointer",
    background: editing ? "color-mix(in oklab,var(--c-primary) 4%,var(--c-surface))" : "var(--c-surface)",
    fontFamily: mono ? "var(--ff-mono)" : undefined,
  };

  if (editing) {
    const inputStyle: React.CSSProperties = {
      width: "100%", border: "none", outline: "none",
      background: "transparent", fontSize: 13, color: "var(--c-text)",
      fontFamily: mono ? "var(--ff-mono)" : undefined,
    };
    return (
      <div style={cellStyle}>
        {multiline ? (
          <textarea
            autoFocus value={draft} rows={3}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onChange(draft); setEditing(false); }}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        ) : (
          <input
            autoFocus type={type} value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onChange(draft); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") { onChange(draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
            style={inputStyle}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  }

  return (
    <div style={cellStyle} onClick={() => { setDraft(value); setEditing(true); }} title="クリックして編集">
      {isEmpty
        ? <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>—</span>
        : <span style={{ lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{value}</span>
      }
    </div>
  );
}

// ── 印紙税の文書説明 ─────────────────────────────────────────────────
function stampTaxDesc(total: number | null): string {
  if (!total) return "";
  if (total <= 100000) return "第2号文書（請負）/ 10万円以下 · 非課税";
  if (total <= 200000) return "第2号文書（請負）/ 10万円超 〜 200万円以下 · 軽減税率適用";
  if (total <= 3000000) return "第2号文書（請負）/ 200万円超 〜 300万円以下";
  if (total <= 5000000) return "第2号文書（請負）/ 300万円超 〜 500万円以下";
  return "第2号文書（請負）";
}

/** 注文書管理画面 — order.html 完全準拠 */
export default function OrderPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [orders, setOrders]     = useState<OrderRead[]>([]);
  const [selected, setSelected] = useState<OrderRead | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [issuingAck, setIssuingAck] = useState(false);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [hasAck, setHasAck]     = useState(false);

  const canEdit = ["admin", "super_admin", "accounting", "manager"].includes(user?.role ?? "");

  // フォーム状態
  const [issueDate, setIssueDate]           = useState("");
  const [clientCompany, setClientCompany]   = useState("");
  const [clientPerson, setClientPerson]     = useState("");
  const [clientAddress, setClientAddress]   = useState("");
  const [amountExclTax, setAmountExclTax]   = useState("");
  const [periodStart, setPeriodStart]       = useState("");
  const [periodEnd, setPeriodEnd]           = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [workContent, setWorkContent]       = useState("");
  const [notes, setNotes]                   = useState("");
  const [terms, setTerms]                   = useState(DEFAULT_TERMS);

  useEffect(() => { loadOrders(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadOrders(keepId?: string) {
    setLoading(true);
    try {
      const data = await apiFetch<OrderRead[]>(`/api/v1/projects/${projectId}/orders`);
      setOrders(data);
      if (data.length > 0) {
        const toSelect = keepId ? (data.find(o => o.id === keepId) ?? data[0]) : data[0];
        selectOrder(toSelect);
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
    setAmountExclTax(o.amount_excl_tax?.toString() || "");
    setPeriodStart(o.construction_period_start || "");
    setPeriodEnd(o.construction_period_end || "");
    setPaymentCondition(o.payment_condition || "");
    setWorkContent(o.work_content || "");
    setNotes(o.notes || "");
    setTerms(o.terms_and_conditions || DEFAULT_TERMS);
  }

  function clearForm() {
    setSelected(null);
    setIssueDate(""); setClientCompany(""); setClientPerson(""); setClientAddress("");
    setAmountExclTax(""); setPeriodStart(""); setPeriodEnd("");
    setPaymentCondition(""); setWorkContent(""); setNotes(""); setTerms(DEFAULT_TERMS);
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

  async function handleApplyFromProject() {
    setApplying(true);
    try {
      const proj = await apiFetch<{
        project_name: string; client_name: string | null;
        project_location: string | null; period_start: string | null;
        period_end: string | null; payment_condition: string | null;
      }>(`/api/v1/projects/${projectId}`);
      const quotes = await apiFetch<{ items?: { subtotal: number | null }[] }>(
        `/api/v1/projects/${projectId}/quotes`
      ).catch(() => ({ items: [] }));
      const latestQuote = Array.isArray(quotes) ? quotes[0] : (quotes.items ?? [])[0];
      setIssueDate(new Date().toISOString().slice(0, 10));
      if (proj.client_name)      setClientCompany(proj.client_name);
      if (proj.project_location) setClientAddress(proj.project_location);
      if (proj.project_name)     setWorkContent(proj.project_name);
      if (proj.period_start)     setPeriodStart(proj.period_start);
      if (proj.period_end)       setPeriodEnd(proj.period_end);
      if (proj.payment_condition) setPaymentCondition(proj.payment_condition);
      if (latestQuote?.subtotal) setAmountExclTax(String(Math.round(latestQuote.subtotal)));
      showMsg("案件情報を適用しました。内容をご確認ください。");
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setApplying(false); }
  }

  // 金額計算
  const amtNum    = amountExclTax ? parseFloat(amountExclTax) : (selected?.amount_excl_tax ?? null);
  const taxAmount = amtNum != null ? Math.floor(amtNum * 0.10) : null;
  const totalAmt  = amtNum != null && taxAmount != null ? amtNum + taxAmount : (selected?.total_amount ?? null);
  const stampTax  = selected?.stamp_tax ?? null;
  const isLinked  = selected?.linked_to_quote && selected?.quote_id;
  const canIssueAck = selected?.status === "signed" && !hasAck;

  // ヘッダータイトル
  const heroTitle = clientCompany ? `${clientCompany} 様向け 注文書` : selected ? "注文書" : "新規注文書";
  const heroSub   = [workContent, periodStart && periodEnd ? `工期 ${periodStart}〜${periodEnd}` : ""].filter(Boolean).join(" · ");

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "注文書" },
      ]}
      action={
        msg ? (
          <span style={{ fontSize: 12, color: msg.startsWith("エラー") || msg.startsWith("削除") ? "var(--c-danger)" : "var(--c-success)" }}>
            {msg}
          </span>
        ) : null
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
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
            ) : orders.map(o => {
              const sm = STATUS_META[o.status] || STATUS_META.draft;
              return (
                <div key={o.id} style={{
                  display: "flex", alignItems: "stretch",
                  borderBottom: "1px solid var(--c-border)",
                  borderLeft: selected?.id === o.id ? "2px solid var(--c-primary)" : "2px solid transparent",
                  background: selected?.id === o.id ? "color-mix(in oklab,var(--c-primary) 8%,var(--c-surface))" : "none",
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
                    <p style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--ff-mono)", color: "var(--c-text)" }}>{o.order_number}</p>
                    <p style={{ fontSize: 10, color: "var(--c-text-muted)", marginTop: 1 }}>{o.issue_date || "日付未定"}</p>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3,
                      padding: "1px 7px", borderRadius: "var(--r-pill)", fontSize: 9, fontWeight: 600,
                      background: sm.bg, color: sm.text, border: `1px solid ${sm.border}`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: sm.dot }} />
                      {sm.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── 右: 詳細 ── */}
          <div>
            {/* ─ Hero ─ */}
            <div style={{
              background: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: "var(--r-lg)", padding: "14px 18px",
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              gap: 16, alignItems: "center", marginBottom: 14,
            }}>
              {/* 注文番号チップ */}
              <span style={{
                fontFamily: "var(--ff-mono)", fontSize: 13, fontWeight: 600,
                color: "var(--c-text-muted)", background: "var(--c-surface-2)",
                padding: "3px 9px", borderRadius: "var(--r-md)",
                whiteSpace: "nowrap",
              }}>
                {selected?.order_number || "新規"}
              </span>
              {/* タイトル */}
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {heroTitle}
                  {heroSub && <small style={{ display: "block", fontWeight: 500, color: "var(--c-text-muted)", fontSize: 12, marginTop: 2 }}>{heroSub}</small>}
                </h1>
              </div>
              {/* アクション */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {selected && (
                  <StatusBadge status={selected.status} onChange={handleStatusChange} />
                )}
                <div style={{ width: 1, height: 24, background: "var(--c-border)" }} />
                {selected && (<>
                  {/* PDF */}
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
                      } catch (e) { alert(`PDFエラー: ${(e as Error).message}`); }
                      finally { setPdfLoading(false); }
                    }}
                    className="btn"
                    style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>
                    {pdfLoading ? "生成中…" : "PDF"}
                  </button>
                  {/* Excel */}
                  <button
                    onClick={() => fetch(`${API_URL}/api/v1/projects/${projectId}/orders/${selected.id}/export`, {
                      headers: { Authorization: `Bearer ${getToken()}` },
                    }).then(r => r.blob()).then(blob => {
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `注文書_${selected.order_number || selected.id}.xlsx`;
                      a.click();
                    })}
                    className="btn"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Download size={14} /> Excel
                  </button>
                </>)}
                {/* 注文請書を発行 */}
                {canIssueAck && (
                  <button onClick={() => handleIssueAcknowledgment()} disabled={issuingAck}
                    className="btn"
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: "var(--c-success)", color: "#fff",
                      borderColor: "var(--c-success)", whiteSpace: "nowrap",
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
                    {issuingAck ? "発行中…" : "注文請書を発行"}
                  </button>
                )}
                {/* 案件から適用 */}
                {canEdit && (
                  <button onClick={handleApplyFromProject} disabled={applying} className="btn"
                    style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>
                    <ClipboardCheck size={14} /> {applying ? "取得中…" : "案件から適用"}
                  </button>
                )}
                {/* 保存 */}
                <button onClick={handleSave} disabled={saving || !canEdit}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>

            {/* ─ タイムライン ─ */}
            {selected && (
              <Timeline status={selected.status} hasAck={hasAck} issueDate={selected.issue_date} />
            )}

            {/* ─ 見積連動バナー ─ */}
            {isLinked && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                padding: "8px 14px", borderRadius: "var(--r-md)", fontSize: 12,
                background: "color-mix(in oklab,var(--c-primary) 8%,var(--c-surface))",
                border: "1px solid color-mix(in oklab,var(--c-primary) 30%,var(--c-border))",
                color: "var(--c-primary)",
              }}>
                <Unlink size={13} />
                <span>この注文書は見積書と連動中（金額・明細は自動同期）</span>
                <button
                  onClick={() => apiFetch(`/api/v1/projects/${projectId}/orders/${selected!.id}/unlink`, { method: "PATCH" })
                    .then(() => loadOrders(selected!.id))}
                  style={{
                    marginLeft: "auto", background: "none", border: "1px solid currentColor",
                    borderRadius: "var(--r-sm)", padding: "2px 8px", cursor: "pointer",
                    fontSize: 11, color: "var(--c-primary)", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Unlink size={11} /> 連動を解除
                </button>
              </div>
            )}

            {/* ─ 2カラム本体 ─ */}
            <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: 12 }}>

              {/* 左カラム */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

                {/* 発注先・件名カード */}
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">発注先・件名</div>
                      <div className="card-sub">クリックで編集</div>
                    </div>
                  </div>
                  {/* ord-field-grid 準拠 */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "100px 1fr 100px 1fr",
                    borderTop: "1px solid var(--c-border)",
                  }}>
                    <K>発注先</K>
                    <V value={clientCompany} onChange={setClientCompany} span2 placeholder="株式会社○○" />

                    <K>担当者</K>
                    <V value={clientPerson} onChange={setClientPerson} placeholder="田中 一郎 課長" />
                    <K>住所・TEL</K>
                    <V value={clientAddress} onChange={setClientAddress} placeholder="福井県…" />

                    <K>件名</K>
                    <V value={workContent} onChange={setWorkContent} span2 placeholder="○○工事 一式" />

                    <K>工事場所</K>
                    <V value={clientAddress} onChange={setClientAddress} placeholder="福井県坂井市…" />
                    <K>納期</K>
                    <div style={{
                      padding: "9px 12px", fontSize: 12, fontFamily: "var(--ff-mono)",
                      borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                        style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "var(--ff-mono)", width: 110 }} />
                      <span>〜</span>
                      <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                        style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "var(--ff-mono)", width: 110 }} />
                    </div>

                    <K>支払条件</K>
                    <V value={paymentCondition} onChange={setPaymentCondition} placeholder="月末締・翌月末払（現金）" />
                    <K>発行日</K>
                    <div style={{
                      padding: "9px 12px", borderBottom: "1px solid var(--c-border)",
                      display: "flex", alignItems: "center",
                    }}>
                      <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                        style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "var(--ff-mono)" }} />
                    </div>

                    <K noBorder>備考</K>
                    <V value={notes} onChange={setNotes} span2 multiline noBorder placeholder="・出来高に応じて月末で請求書を発行ください&#10;・養生・引渡し清掃含む" />
                  </div>
                </div>

                {/* 注文条件・約款カード */}
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">注文条件 · 基本契約約款</div>
                      <div className="card-sub">注文請書発行時に同条件で発行されます</div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 16px 14px" }}>
                    <textarea
                      value={terms}
                      onChange={e => setTerms(e.target.value)}
                      rows={5}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                        background: "var(--c-surface)", color: "var(--c-text)",
                        padding: "8px 12px", fontSize: 12, lineHeight: 1.7,
                        resize: "vertical", outline: "none",
                      }}
                      onFocus={e => (e.target.style.borderColor = "var(--c-primary)")}
                      onBlur={e => (e.target.style.borderColor = "var(--c-border)")}
                    />
                  </div>
                </div>
              </div>

              {/* 右カラム */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

                {/* totals-card */}
                <div style={{
                  background: "var(--c-surface)", border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-lg)", overflow: "hidden",
                }}>
                  {/* .head (primary bg) */}
                  <div style={{ background: "var(--c-primary)", color: "#fff", padding: "11px 14px" }}>
                    <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: "0.04em", fontWeight: 600 }}>
                      注文金額（税込）
                    </div>
                    <div style={{ fontFamily: "var(--ff-mono)", fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                      {fmtYen(totalAmt)}
                    </div>
                  </div>
                  {/* 税抜入力行 */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 14px", fontSize: 13, borderBottom: "1px solid var(--c-border)",
                  }}>
                    <span style={{ color: "var(--c-text-muted)", fontSize: 12 }}>税抜金額</span>
                    <input
                      type="number"
                      value={amountExclTax}
                      onChange={e => setAmountExclTax(e.target.value)}
                      placeholder="—"
                      style={{
                        width: 120, textAlign: "right", border: "1px solid var(--c-border)",
                        borderRadius: "var(--r-sm)", padding: "3px 6px",
                        fontSize: 13, fontFamily: "var(--ff-mono)", fontWeight: 600,
                        background: "var(--c-surface)", color: "var(--c-text)",
                      }}
                    />
                  </div>
                  {/* .row: 小計 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid var(--c-border)" }}>
                    <span style={{ color: "var(--c-text-muted)", fontSize: 12 }}>小計（税抜）</span>
                    <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 600 }}>{fmtYen(amtNum)}</span>
                  </div>
                  {/* .row.major: 消費税 */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 14px", fontSize: 13, borderBottom: "1px solid var(--c-border)",
                    background: "var(--c-surface-2)", fontWeight: 700,
                  }}>
                    <span style={{ color: "var(--c-text)", fontWeight: 600, fontSize: 12 }}>消費税（10%）</span>
                    <span style={{ fontFamily: "var(--ff-mono)", fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{fmtYen(taxAmount)}</span>
                  </div>
                  {/* 印紙税エリア */}
                  {stampTax != null && (
                    <div style={{
                      padding: 14,
                      borderTop: "1px solid var(--c-border)",
                      background: "color-mix(in oklab,var(--c-warn) 6%,var(--c-surface))",
                    }}>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 600, letterSpacing: "0.04em" }}>
                        印紙税額（自動算定）
                      </div>
                      <div style={{ fontFamily: "var(--ff-mono)", fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                        {fmtYen(stampTax)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                        {stampTaxDesc(totalAmt)}
                      </div>
                    </div>
                  )}
                </div>

                {/* 注文請書発行ボックス */}
                {canIssueAck ? (
                  <div style={{
                    background: "color-mix(in oklab,var(--c-success) 8%,var(--c-surface))",
                    border: "1.5px solid var(--c-success)", borderRadius: "var(--r-lg)",
                    padding: "14px 16px",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                      📩 注文請書を発行できる状態です
                    </div>
                    <div style={{ fontSize: 12, color: "var(--c-text-muted)", lineHeight: 1.55, marginBottom: 10 }}>
                      先方押印済（signed）になりました。注文請書ドラフトを生成して案件に紐付けます。
                    </div>
                    <button onClick={() => handleIssueAcknowledgment()} disabled={issuingAck}
                      style={{
                        width: "100%", padding: "8px 0", fontSize: 12, fontWeight: 700,
                        border: "none", borderRadius: "var(--r-md)", cursor: "pointer",
                        background: "var(--c-success)", color: "#fff", display: "flex",
                        alignItems: "center", justifyContent: "center", gap: 6,
                        opacity: issuingAck ? 0.7 : 1,
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                      {issuingAck ? "発行中…" : "注文請書を発行する"}
                    </button>
                  </div>
                ) : hasAck ? (
                  <div style={{
                    padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 12,
                    color: "var(--c-success)", display: "flex", alignItems: "center", gap: 6,
                    background: "color-mix(in oklab,var(--c-success) 8%,var(--c-surface))",
                    border: "1px solid color-mix(in oklab,var(--c-success) 30%,var(--c-border))",
                  }}>
                    <Check size={14} /> 注文請書を発行済みです
                  </div>
                ) : null}

              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
