"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Attendance {
  id: string;
  vendor_id: string;
  attendance_date: string;
  worker_count: number;
  work_content: string | null;
  unit_price: number | null;
  amount: number | null;
  note: string | null;
  vendor_name: string | null;
}

interface Summary {
  vendor_id: string;
  vendor_name: string | null;
  month: string;
  total_worker_count: number;
  working_days: number;
  total_amount: number | null;
}

interface Vendor {
  id: string;
  name: string;
}

function fmtYen(v: number | null): string {
  if (v == null) return "—";
  return `¥${v.toLocaleString()}`;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const [month, setMonth] = useState(currentYearMonth());
  const [records, setRecords] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vendor_id: "",
    attendance_date: new Date().toISOString().slice(0, 10),
    worker_count: "1",
    work_content: "",
    unit_price: "",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, sum, vends] = await Promise.all([
        apiFetch<Attendance[]>(`/api/v1/projects/${id}/attendance?month=${month}`),
        apiFetch<Summary[]>(`/api/v1/projects/${id}/attendance/summary?month=${month}`),
        apiFetch<{ items: Vendor[] }>("/api/v1/vendors?limit=200").then((d) => d.items),
      ]);
      setRecords(recs);
      setSummary(sum);
      setVendors(vends);
    } finally {
      setLoading(false);
    }
  }, [id, month]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setSaving(true);
    try {
      const amount = form.unit_price
        ? Math.round(parseFloat(form.worker_count) * parseFloat(form.unit_price))
        : null;
      await apiFetch(`/api/v1/projects/${id}/attendance`, {
        method: "POST",
        body: JSON.stringify({
          vendor_id: form.vendor_id,
          attendance_date: form.attendance_date,
          worker_count: parseFloat(form.worker_count),
          work_content: form.work_content || null,
          unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
          amount,
          note: form.note || null,
        }),
      });
      setShowAdd(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(recId: string) {
    if (!confirm("削除しますか？")) return;
    await apiFetch(`/api/v1/projects/${id}/attendance/${recId}`, { method: "DELETE" });
    await load();
  }

  return (
    <AppShell breadcrumbs={[{ label: "案件", href: `/projects/${id}` }, { label: "出面台帳" }]}>
      <div style={{ padding: "var(--sp-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)", flexWrap: "wrap", gap: "var(--sp-2)" }}>
          <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)" }}>出面台帳</h2>
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 160 }}
            />
            <Button onClick={() => setShowAdd(!showAdd)}>+ 手動追加</Button>
          </div>
        </div>

        {/* 集計サマリ */}
        {summary.length > 0 && (
          <div
            style={{
              background: "var(--c-surface)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--radius)",
              marginBottom: "var(--sp-4)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "var(--sp-2) var(--sp-3)", background: "var(--c-surface-2)", fontWeight: 600, fontSize: "var(--fs-sm)" }}>
              業者別集計
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "left", fontWeight: 600 }}>業者</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right", fontWeight: 600 }}>合計人工</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right", fontWeight: 600 }}>稼働日数</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right", fontWeight: 600 }}>金額</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={`${s.vendor_id}-${s.month}`} style={{ borderBottom: "1px solid var(--c-border)" }}>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)" }}>{s.vendor_name || s.vendor_id.slice(0, 8)}</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right" }}>{s.total_worker_count}人工</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right" }}>{s.working_days}日</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right", fontWeight: 600 }}>{fmtYen(s.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 追加フォーム */}
        {showAdd && (
          <div
            style={{
              background: "var(--c-surface)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--radius)",
              padding: "var(--sp-3)",
              marginBottom: "var(--sp-4)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-2)",
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: "1 0 180px" }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>業者 *</div>
              <select
                value={form.vendor_id}
                onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                style={{
                  width: "100%", padding: "6px 8px", border: "1px solid var(--c-border)",
                  borderRadius: "var(--radius-sm)", fontSize: "var(--fs-sm)", background: "var(--c-surface)", color: "var(--c-text)",
                }}
              >
                <option value="">業者を選択</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 0 140px" }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>日付 *</div>
              <Input type="date" value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} />
            </div>
            <div style={{ flex: "0 0 90px" }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>人工</div>
              <Input type="number" step="0.5" min="0.5" value={form.worker_count} onChange={(e) => setForm({ ...form, worker_count: e.target.value })} />
            </div>
            <div style={{ flex: "0 0 110px" }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>単価（円）</div>
              <Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder="15000" />
            </div>
            <div style={{ flex: "1 0 160px" }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>作業内容</div>
              <Input value={form.work_content} onChange={(e) => setForm({ ...form, work_content: e.target.value })} placeholder="内装解体" />
            </div>
            <Button onClick={handleAdd} disabled={saving || !form.vendor_id || !form.attendance_date}>
              {saving ? "追加中…" : "追加"}
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>キャンセル</Button>
          </div>
        )}

        {/* 明細 */}
        {loading ? (
          <p style={{ color: "var(--c-text-muted)" }}>読み込み中…</p>
        ) : records.length === 0 ? (
          <div
            style={{
              padding: "var(--sp-8)",
              textAlign: "center",
              color: "var(--c-text-muted)",
              border: "2px dashed var(--c-border)",
              borderRadius: "var(--radius)",
            }}
          >
            この月の出面記録がありません。
          </div>
        ) : (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "left", fontWeight: 600 }}>日付</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "left", fontWeight: 600 }}>業者</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right", fontWeight: 600 }}>人工</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "left", fontWeight: 600 }}>作業内容</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right", fontWeight: 600 }}>金額</th>
                  <th style={{ padding: "var(--sp-2) var(--sp-3)" }} />
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)" }}>{rec.attendance_date}</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)" }}>{rec.vendor_name || rec.vendor_id.slice(0, 8)}</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right" }}>{rec.worker_count}</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)" }}>{rec.work_content || "—"}</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)", textAlign: "right" }}>{fmtYen(rec.amount)}</td>
                    <td style={{ padding: "var(--sp-2) var(--sp-3)" }}>
                      <button
                        onClick={() => handleDelete(rec.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 14 }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
