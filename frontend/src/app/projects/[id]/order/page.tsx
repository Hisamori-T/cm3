"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Plus, Stamp, Unlink, ClipboardCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { ORDER_STATUS_LABEL, OrderCreate, OrderRead } from "@/types/order";
import { AcknowledgmentRead } from "@/types/acknowledgment";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: "var(--c-surface-2)", color: "var(--c-text-muted)" },
  sent: { background: "color-mix(in oklab, var(--c-primary) 14%, var(--c-surface))", color: "var(--c-primary)" },
  signed: { background: "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))", color: "var(--c-success)" },
  cancelled: { background: "color-mix(in oklab, var(--c-danger) 14%, var(--c-surface))", color: "var(--c-danger)" },
};

const DEFAULT_TERMS = `1. 工事の範囲は別紙設計図書のとおりとする。
2. 工事の変更は、甲乙協議のうえ書面にて行う。
3. 天候その他不可抗力による工期延長は、別途協議する。
4. 保証期間は完工後1年間とする。`;

function LabelInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

/** 注文書管理画面。 */
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

  // 注文書発行権限: 経理・管理者・社長（super_admin）のみ
  const canIssueOrder = ["admin", "super_admin", "accounting", "manager"].includes(user?.role ?? "");

  const [issueDate, setIssueDate] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientPerson, setClientPerson] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [amountExclTax, setAmountExclTax] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [workContent, setWorkContent] = useState("添付工事内訳書の通り");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS);

  useEffect(() => { loadOrders(); }, [projectId]);

  async function loadOrders(keepSelectedId?: string) {
    setLoading(true);
    try {
      const data = await apiFetch<OrderRead[]>(`/api/v1/projects/${projectId}/orders`);
      setOrders(data);
      if (data.length > 0) {
        const toSelect = keepSelectedId
          ? (data.find(o => o.id === keepSelectedId) ?? data[0])
          : data[0];
        selectOrder(toSelect);
      }
    } catch {
      // ignore
    } finally { setLoading(false); }
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
    setWorkContent(o.work_content ?? "添付工事内訳書の通り");
    setNotes(o.notes || "");
    setTerms(o.terms_and_conditions || DEFAULT_TERMS);
  }

  function clearForm() {
    setSelected(null);
    setIssueDate(""); setClientCompany(""); setClientPerson(""); setClientAddress("");
    setAmountExclTax(""); setPeriodStart(""); setPeriodEnd("");
    setPaymentCondition(""); setWorkContent("添付工事内訳書の通り"); setNotes(""); setTerms(DEFAULT_TERMS);
  }

  async function handleSave() {
    setSaving(true); setMsg(null);
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
      setMsg("保存しました");
      await loadOrders(selected?.id);
    } catch (e) { setMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  }

  async function handleIssueAcknowledgment(orderId?: string) {
    const targetId = orderId ?? selected?.id;
    if (!targetId) return;
    setIssuingAck(true); setMsg(null);
    try {
      const ack = await apiFetch<AcknowledgmentRead>(
        `/api/v1/projects/${projectId}/orders/${targetId}/issue-acknowledgment`,
        { method: "POST" }
      );
      setMsg(`注文請書 ${ack.acknowledgment_number} を発行しました`);
      await loadOrders(targetId);
    } catch (e) { setMsg(`エラー: ${(e as Error).message}`); }
    finally { setIssuingAck(false); setTimeout(() => setMsg(null), 5000); }
  }

  async function handleUnlink() {
    if (!selected) return;
    setUnlinking(true); setMsg(null);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/orders/${selected.id}/unlink`, { method: "PATCH" });
      setMsg("見積連動を解除しました");
      await loadOrders(selected.id);
    } catch (e) { setMsg(`エラー: ${(e as Error).message}`); }
    finally { setUnlinking(false); setTimeout(() => setMsg(null), 3000); }
  }

  async function handleDeleteSelected() {
    if (checkedIds.size === 0) return;
    if (!confirm(`選択した ${checkedIds.size} 件の注文書を削除しますか？\n※関連する注文請書も削除されます。`)) return;
    setDeleting(true); setMsg(null);
    try {
      await Promise.all([...checkedIds].map(id =>
        apiFetch(`/api/v1/projects/${projectId}/orders/${id}`, { method: "DELETE" })
      ));
      setCheckedIds(new Set());
      if (selected && checkedIds.has(selected.id)) { setSelected(null); clearForm(); }
      await loadOrders(selected && !checkedIds.has(selected.id) ? selected.id : undefined);
      setMsg("削除しました");
    } catch (e) { setMsg(`削除エラー: ${(e as Error).message}`); }
    finally { setDeleting(false); setTimeout(() => setMsg(null), 3000); }
  }

  async function handleStatusChange(newStatus: string) {
    if (!selected) return;
    const currentId = selected.id;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/orders/${currentId}`, {
        method: "PATCH", body: JSON.stringify({ status: newStatus }),
      });
      // 「発行済み」に変更したとき注文請書を自動発行
      if (newStatus === "sent") {
        await handleIssueAcknowledgment(currentId);
        return;
      }
      setMsg("ステータスを更新しました");
      await loadOrders(currentId);
    } catch (e) { setMsg(`エラー: ${(e as Error).message}`); }
    finally { setTimeout(() => setMsg(null), 3000); }
  }

  /** 案件詳細と最新見積書から注文書フォームを自動入力 */
  async function handleApplyFromProject() {
    setApplying(true); setMsg(null);
    try {
      // 案件詳細取得
      const proj = await apiFetch<{
        project_name: string;
        client_name: string | null;
        project_location: string | null;
        period_start: string | null;
        period_end: string | null;
        payment_condition: string | null;
      }>(`/api/v1/projects/${projectId}`);

      // 最新の見積書を取得（承認済み優先）
      const quotes = await apiFetch<{ items?: { subtotal: number | null; total_amount: number | null }[] }>(
        `/api/v1/projects/${projectId}/quotes`
      ).catch(() => ({ items: [] }));
      const latestQuote = Array.isArray(quotes) ? quotes[0] : (quotes.items ?? [])[0];

      // フォームに自動入力
      setIssueDate(new Date().toISOString().slice(0, 10));
      if (proj.client_name) setClientCompany(proj.client_name);
      if (proj.project_location) setClientAddress(proj.project_location);
      if (proj.period_start) setPeriodStart(proj.period_start);
      if (proj.period_end) setPeriodEnd(proj.period_end);
      if (proj.payment_condition) setPaymentCondition(proj.payment_condition);
      if (latestQuote?.subtotal) setAmountExclTax(String(Math.round(latestQuote.subtotal)));

      setMsg("案件情報を適用しました。納期・支払条件をご確認ください。");
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setApplying(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  const taxAmount = amountExclTax ? Math.floor(parseFloat(amountExclTax) * 0.10) : null;
  const totalAmount = amountExclTax && taxAmount !== null ? parseFloat(amountExclTax) + taxAmount : null;
  const isLinked = selected?.linked_to_quote && selected?.quote_id;

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
            <span style={{ fontSize: 13, color: msg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
              {msg}
            </span>
          )}
          {selected && (<>
            <Button
              variant="default" size="sm"
              onClick={() => {
                fetch(`${API_URL}/api/v1/projects/${projectId}/orders/${selected.id}/export`, {
                  headers: { Authorization: `Bearer ${getToken()}` },
                }).then((r) => r.blob()).then((blob) => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `注文書_${selected.order_number || selected.id}.xlsx`;
                  a.click();
                });
              }}
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button
              variant="default" size="sm"
              style={{ background: pdfLoading ? "#888" : "#C00000", color: "#fff" }}
              disabled={pdfLoading}
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
                } catch (e) {
                  alert(`PDF生成エラー: ${(e as Error).message}`);
                } finally {
                  setPdfLoading(false);
                }
              }}
            >
              <Download className="w-3.5 h-3.5" />
              {pdfLoading ? "生成中..." : "PDF"}
            </Button>
          </>)}
          {/* 案件から適用ボタン（権限チェック） */}
          {canIssueOrder && (
            <Button
              variant="default" size="sm"
              style={{ background: "var(--c-success)", color: "#fff" }}
              onClick={handleApplyFromProject}
              disabled={applying}
              title="案件詳細・見積書の情報を自動入力します"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              {applying ? "取得中..." : "案件から適用"}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !canIssueOrder}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      }
    >
      <div className="toolbar">
        <h1>注文書</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>読み込み中…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
          {/* 左: 一覧 */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--c-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>
                {checkedIds.size > 0 ? `${checkedIds.size}件選択中` : "一覧"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {checkedIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-danger)", padding: 2, display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}
                    title="選択した注文書を削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? "削除中..." : `削除(${checkedIds.size})`}
                  </button>
                )}
                <button
                  onClick={clearForm}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-primary)", padding: 2 }}
                  title="新規作成"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {orders.length === 0 ? (
              <p style={{ padding: "16px", fontSize: 12, color: "var(--c-text-muted)", textAlign: "center" }}>
                注文書がありません
              </p>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: "flex", alignItems: "stretch",
                    borderBottom: "1px solid var(--c-border)",
                    borderLeft: selected?.id === o.id ? "2px solid var(--c-primary)" : "2px solid transparent",
                    background: selected?.id === o.id
                      ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))"
                      : "none",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", padding: "0 6px 0 10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(o.id)}
                      onChange={(e) => {
                        const next = new Set(checkedIds);
                        e.target.checked ? next.add(o.id) : next.delete(o.id);
                        setCheckedIds(next);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <button
                    onClick={() => selectOrder(o)}
                    style={{
                      flex: 1, textAlign: "left",
                      padding: "10px 14px 10px 4px",
                      background: "none", border: "none", cursor: "pointer",
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text)" }}>{o.order_number}</p>
                    <p style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>
                      {o.issue_date || "日付未定"}
                    </p>
                    <span style={{
                      display: "inline-flex", marginTop: 4,
                      padding: "1px 6px", borderRadius: "var(--r-pill)",
                      fontSize: 10, fontWeight: 600,
                      ...(STATUS_STYLE[o.status] || STATUS_STYLE.draft),
                    }}>
                      {ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL] ?? o.status}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 右: フォーム */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 見積連動バナー */}
            {isLinked && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: "var(--r-md)",
                background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
                border: "1px solid color-mix(in oklab, var(--c-primary) 30%, var(--c-border))",
                fontSize: 13, color: "var(--c-primary)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                <span>この注文書は見積書と連動中（金額・明細は自動同期）</span>
                <button
                  onClick={handleUnlink}
                  disabled={unlinking}
                  style={{
                    marginLeft: "auto", background: "none", border: "1px solid currentColor",
                    borderRadius: "var(--r-sm)", padding: "2px 8px", cursor: "pointer",
                    fontSize: 11, color: "var(--c-primary)", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Unlink className="w-3 h-3" />
                  {unlinking ? "解除中..." : "連動を解除"}
                </button>
              </div>
            )}

            {/* ステータス制御 */}
            {selected && (
              <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>ステータス</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["draft", "sent", "signed", "cancelled"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      style={{
                        padding: "3px 10px", borderRadius: "var(--r-pill)",
                        border: "1px solid var(--c-border)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        ...(selected.status === s
                          ? (STATUS_STYLE[s] || STATUS_STYLE.draft)
                          : { background: "var(--c-surface-2)", color: "var(--c-text-muted)" }),
                      }}
                    >
                      {ORDER_STATUS_LABEL[s]}
                    </button>
                  ))}
              </div>
            )}

            <div className="card" style={{ padding: "16px 20px" }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>
                {selected ? selected.order_number : "新規注文書"}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <LabelInput label="発行日">
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </LabelInput>
                <LabelInput label="宛先会社名">
                  <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="株式会社○○" />
                </LabelInput>
                <LabelInput label="担当者名">
                  <Input value={clientPerson} onChange={(e) => setClientPerson(e.target.value)} placeholder="山田 太郎 様" />
                </LabelInput>
                <LabelInput label="住所">
                  <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
                </LabelInput>
              </div>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>
                金額
                {isLinked && (
                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--c-primary)", fontWeight: 400 }}>
                    ※見積連動中（編集すると連動が優先されます）
                  </span>
                )}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <LabelInput label="税抜金額（円）">
                  <Input type="number" value={amountExclTax} onChange={(e) => setAmountExclTax(e.target.value)} />
                </LabelInput>
                <div style={{ paddingTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}>
                    <span>消費税 (10%)</span>
                    <span className="num">{taxAmount?.toLocaleString() ?? "—"} 円</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
                    <span>合計</span>
                    <span className="num">{totalAmount?.toLocaleString() ?? "—"} 円</span>
                  </div>
                </div>
              </div>
              {selected?.stamp_tax != null && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 10,
                  padding: "8px 12px", borderRadius: "var(--r-md)",
                  background: "color-mix(in oklab, var(--c-warn) 10%, var(--c-surface))",
                  border: "1px solid color-mix(in oklab, var(--c-warn) 30%, var(--c-border))",
                  fontSize: 13, color: "var(--c-warn)",
                }}>
                  <Stamp className="w-4 h-4 shrink-0" />
                  印紙税: <strong>{selected.stamp_tax.toLocaleString()} 円</strong>（自動算定）
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>工期・支払条件</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <LabelInput label="工期 開始">
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </LabelInput>
                <LabelInput label="工期 終了">
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </LabelInput>
                <div style={{ gridColumn: "1 / -1" }}>
                  <LabelInput label="支払条件">
                    <Input value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)} placeholder="完工後30日以内" />
                  </LabelInput>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <LabelInput label="工事内容（PDF 6番）">
                    <Input value={workContent} onChange={(e) => setWorkContent(e.target.value)} placeholder="添付工事内訳書の通り" />
                  </LabelInput>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <LabelInput label="適要（PDF 7番）">
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="（任意）" />
                  </LabelInput>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>約款・特記事項</h2>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={6}
                style={{
                  width: "100%", boxSizing: "border-box",
                  border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)",
                  background: "var(--c-surface)", color: "var(--c-text)",
                  padding: "8px 12px", fontSize: 13,
                  fontFamily: "var(--ff-mono)",
                  resize: "vertical", outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--c-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--c-border)")}
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
