"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StampTaxRow {
  id: string;
  min_amount: number;
  max_amount: number | null;
  tax_amount: number;
  effective_from: string;
}

/** 印紙税テーブル管理画面（管理者専用）。 */
export default function StampTaxPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<StampTaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin" && user.role !== "super_admin") router.replace("/projects");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") load();
  }, [authLoading, user]);

  async function load() {
    setLoading(true);
    try {
      setRows(await apiFetch<StampTaxRow[]>("/api/v1/admin/stamp-tax"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!minAmount || !taxAmount || !effectiveFrom) {
      setMsg("金額・印紙税・有効日は必須です");
      return;
    }
    setMsg(null);
    try {
      await apiFetch("/api/v1/admin/stamp-tax", {
        method: "POST",
        body: JSON.stringify({
          min_amount: parseFloat(minAmount),
          max_amount: maxAmount ? parseFloat(maxAmount) : null,
          tax_amount: parseFloat(taxAmount),
          effective_from: effectiveFrom,
        }),
      });
      setMinAmount(""); setMaxAmount(""); setTaxAmount(""); setEffectiveFrom("");
      setMsg("追加しました");
      await load();
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    try {
      await apiFetch(`/api/v1/admin/stamp-tax/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: "設定" }, { label: "印紙税テーブル" }]}>
      <div className="toolbar">
        <h1>印紙税テーブル管理</h1>
      </div>

      {/* 追加フォーム */}
      <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>新規追加</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>
              下限金額（円）
            </label>
            <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="1000000" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>
              上限金額（円・空=無制限）
            </label>
            <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="5000000" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>
              印紙税額（円）
            </label>
            <Input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="2000" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>
              有効開始日
            </label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {msg && (
            <span style={{ fontSize: 13, color: msg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
              {msg}
            </span>
          )}
          <Button onClick={handleAdd} variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5" />
            追加
          </Button>
        </div>
      </div>

      {/* 一覧 */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>下限</th>
              <th>上限</th>
              <th className="num">印紙税額</th>
              <th>有効開始</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                  読み込み中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                  データがありません
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.min_amount.toLocaleString()} 円</td>
                  <td className="num">{r.max_amount != null ? `${r.max_amount.toLocaleString()} 円` : "上限なし"}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{r.tax_amount.toLocaleString()} 円</td>
                  <td style={{ color: "var(--c-text-muted)" }}>{r.effective_from}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => handleDelete(r.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 4 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-muted)")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
