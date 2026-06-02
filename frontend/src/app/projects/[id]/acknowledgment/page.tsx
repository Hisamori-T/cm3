"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Stamp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACKNOWLEDGMENT_STATUS_LABEL, AcknowledgmentRead } from "@/types/acknowledgment";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: "var(--c-surface-2)", color: "var(--c-text-muted)" },
  issued: { background: "color-mix(in oklab, #7c3aed 14%, var(--c-surface))", color: "#7c3aed" },
};

function LabelInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

/** 注文請書管理画面。 */
export default function AcknowledgmentPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [acks, setAcks] = useState<AcknowledgmentRead[]>([]);
  const [selected, setSelected] = useState<AcknowledgmentRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [issueDate, setIssueDate] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientPerson, setClientPerson] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [terms, setTerms] = useState("");

  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => { loadAcks(); }, [projectId]);

  async function loadAcks(keepSelectedId?: string) {
    setLoading(true);
    try {
      const data = await apiFetch<AcknowledgmentRead[]>(`/api/v1/projects/${projectId}/acknowledgments`);
      setAcks(data);
      if (data.length > 0) {
        const toSelect = keepSelectedId
          ? (data.find(a => a.id === keepSelectedId) ?? data[0])
          : data[0];
        selectAck(toSelect);
      }
    } catch {
      // ignore
    } finally { setLoading(false); }
  }

  function selectAck(a: AcknowledgmentRead) {
    setSelected(a);
    setIssueDate(a.issue_date || "");
    setClientCompany(a.client_company || "");
    setClientPerson(a.client_person || "");
    setClientAddress(a.client_address || "");
    setPeriodStart(a.construction_period_start || "");
    setPeriodEnd(a.construction_period_end || "");
    setPaymentCondition(a.payment_condition || "");
    setTerms(a.terms_and_conditions || "");
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true); setMsg(null);
    const body = {
      issue_date: issueDate || null,
      client_company: clientCompany || null,
      client_person: clientPerson || null,
      client_address: clientAddress || null,
      construction_period_start: periodStart || null,
      construction_period_end: periodEnd || null,
      payment_condition: paymentCondition || null,
      terms_and_conditions: terms || null,
    };
    try {
      await apiFetch(`/api/v1/acknowledgments/${selected.id}`, {
        method: "PATCH", body: JSON.stringify(body),
      });
      setMsg("保存しました");
      await loadAcks(selected.id);
    } catch (e) { setMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  }

  async function handleIssue() {
    if (!selected) return;
    const currentId = selected.id;
    try {
      await apiFetch(`/api/v1/acknowledgments/${selected.id}`, {
        method: "PATCH", body: JSON.stringify({ status: "issued" }),
      });
      setMsg("発行済みにしました");
      await loadAcks(currentId);
    } catch (e) { setMsg(`エラー: ${(e as Error).message}`); }
    finally { setTimeout(() => setMsg(null), 3000); }
  }

  const isIssued = selected?.status === "issued";

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "注文請書" },
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
                fetch(`${API_URL}/api/v1/acknowledgments/${selected.id}/export`, {
                  headers: { Authorization: `Bearer ${getToken()}` },
                }).then((r) => r.blob()).then((blob) => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `注文請書_${selected.acknowledgment_number || selected.id}.xlsx`;
                  a.click();
                });
              }}
            >
              <Download className="w-3.5 h-3.5" />Excel
            </Button>
            <Button
              variant="default" size="sm"
              style={{ background: pdfLoading ? "#888" : "#C00000", color: "#fff" }}
              disabled={pdfLoading}
              onClick={async () => {
                setPdfLoading(true);
                try {
                  const r = await fetch(`${API_URL}/api/v1/acknowledgments/${selected.id}/export-pdf`, {
                    headers: { Authorization: `Bearer ${getToken()}` },
                  });
                  if (!r.ok) throw new Error(`HTTP ${r.status}`);
                  const blob = await r.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `注文請書_${selected.acknowledgment_number || selected.id}.pdf`;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                } catch (e) {
                  alert(`PDF生成エラー: ${(e as Error).message}`);
                } finally { setPdfLoading(false); }
              }}
            >
              <Download className="w-3.5 h-3.5" />{pdfLoading ? "生成中..." : "PDF"}
            </Button>
          </>)}
          {selected && !isIssued && (
            <>
              <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button
                size="sm"
                style={{ background: "#7c3aed", color: "#fff" }}
                onClick={handleIssue}
              >
                発行済みにする
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="toolbar">
        <h1>注文請書</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>読み込み中…</div>
      ) : acks.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "80px 20px", gap: 12,
          color: "var(--c-text-muted)",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 600 }}>注文請書がありません</p>
          <p style={{ fontSize: 12 }}>
            注文書の画面でステータスを「発行済み」にすると注文請書が自動発行されます
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
          {/* 左: 一覧 */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--c-border)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>一覧</span>
            </div>
            {acks.map((a) => (
              <button
                key={a.id}
                onClick={() => selectAck(a)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--c-border)",
                  background: selected?.id === a.id
                    ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))"
                    : "none",
                  borderLeft: selected?.id === a.id ? "2px solid var(--c-primary)" : "2px solid transparent",
                  cursor: "pointer",
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text)" }}>{a.acknowledgment_number}</p>
                <p style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>
                  {a.issue_date || "日付未定"}
                </p>
                <span style={{
                  display: "inline-flex", marginTop: 4,
                  padding: "1px 6px", borderRadius: "var(--r-pill)",
                  fontSize: 10, fontWeight: 600,
                  ...(STATUS_STYLE[a.status] || STATUS_STYLE.draft),
                }}>
                  {ACKNOWLEDGMENT_STATUS_LABEL[a.status] ?? a.status}
                </span>
              </button>
            ))}
          </div>

          {/* 右: フォーム */}
          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="card" style={{ padding: "16px 20px" }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>
                  {selected.acknowledgment_number}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <LabelInput label="発行日">
                    <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={isIssued} />
                  </LabelInput>
                  <LabelInput label="宛先会社名">
                    <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="株式会社○○" disabled={isIssued} />
                  </LabelInput>
                  <LabelInput label="担当者名">
                    <Input value={clientPerson} onChange={(e) => setClientPerson(e.target.value)} placeholder="山田 太郎 様" disabled={isIssued} />
                  </LabelInput>
                  <LabelInput label="住所">
                    <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} disabled={isIssued} />
                  </LabelInput>
                </div>
              </div>

              <div className="card" style={{ padding: "16px 20px" }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>金額</h2>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 6 }}>
                  <span>税抜金額</span>
                  <span className="num">
                    {selected.amount_excl_tax != null ? `¥${selected.amount_excl_tax.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 6 }}>
                  <span>消費税 (10%)</span>
                  <span className="num">
                    {selected.tax_amount != null ? `¥${selected.tax_amount.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>
                  <span>合計（税込）</span>
                  <span className="num">
                    {selected.total_amount != null ? `¥${selected.total_amount.toLocaleString()}` : "—"}
                  </span>
                </div>
                {selected.stamp_tax != null && (
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
                    <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} disabled={isIssued} />
                  </LabelInput>
                  <LabelInput label="工期 終了">
                    <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} disabled={isIssued} />
                  </LabelInput>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <LabelInput label="支払条件">
                      <Input value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)} disabled={isIssued} />
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
                  disabled={isIssued}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    border: "1px solid var(--c-border)",
                    borderRadius: "var(--r-md)",
                    background: isIssued ? "var(--c-surface-2)" : "var(--c-surface)",
                    color: "var(--c-text)",
                    padding: "8px 12px", fontSize: 13,
                    fontFamily: "var(--ff-mono)",
                    resize: "vertical", outline: "none",
                  }}
                  onFocus={(e) => { if (!isIssued) e.target.style.borderColor = "var(--c-primary)"; }}
                  onBlur={(e) => (e.target.style.borderColor = "var(--c-border)")}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
