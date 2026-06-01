"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface QuoteListItem {
  id: string;
  quote_number: string | null;
  issue_date: string | null;
  status: string;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  sent: "送付済み",
  approved: "承認済み",
  cancelled: "キャンセル",
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: "var(--c-surface-2)", color: "var(--c-text-muted)" },
  sent: { background: "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))", color: "var(--c-primary)" },
  approved: { background: "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))", color: "var(--c-success)" },
  cancelled: { background: "color-mix(in oklab, var(--c-danger) 10%, var(--c-surface))", color: "var(--c-danger)" },
};

const fmt = (n: number | null | undefined) =>
  n != null ? `¥${Math.round(n).toLocaleString()}` : "—";

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ja-JP") : "—";

// ---------------------------------------------------------------------------
// ページ本体
// ---------------------------------------------------------------------------

/** 顧客見積書一覧。複数の見積書を枝番ごとに管理する。 */
export default function QuoteListPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();

  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuotes();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadQuotes() {
    setLoading(true);
    try {
      const data = await apiFetch<QuoteListItem[]>(`/api/v1/projects/${projectId}/quotes`);
      setQuotes(data);
    } catch {
      setError("見積書一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await apiFetch<{ id: string }>(`/api/v1/projects/${projectId}/quotes`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/projects/${projectId}/quote/${created.id}`);
    } catch (e) {
      setError(`作成に失敗しました: ${(e as Error).message}`);
      setCreating(false);
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "顧客見積" },
      ]}
      action={
        <Button
          variant="default" size="sm"
          onClick={handleCreate}
          disabled={creating}
          style={{ background: "var(--c-primary)", color: "#fff" }}
        >
          <Plus className="w-3.5 h-3.5" />
          {creating ? "作成中…" : "新規見積書を作成"}
        </Button>
      }
    >
      <div className="toolbar">
        <h1>顧客見積</h1>
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--r-md)", fontSize: 13,
          background: "var(--c-danger-bg)", color: "var(--c-danger)",
          border: "1px solid color-mix(in oklab, var(--c-danger) 30%, transparent)",
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--c-text-muted)" }}>
          読み込み中…
        </div>
      ) : quotes.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "80px 20px", gap: 12, color: "var(--c-text-muted)",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 600 }}>見積書がありません</p>
          <p style={{ fontSize: 12 }}>「新規見積書を作成」ボタンで最初の見積書を作成してください</p>
          <Button
            variant="default" size="sm"
            onClick={handleCreate}
            disabled={creating}
            style={{ background: "var(--c-primary)", color: "#fff", marginTop: 8 }}
          >
            <Plus className="w-3.5 h-3.5" />
            新規見積書を作成
          </Button>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>見積番号</th>
                <th>発行日</th>
                <th className="num">税抜金額</th>
                <th className="num">税込金額</th>
                <th>ステータス</th>
                <th>作成日</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => (
                <tr
                  key={q.id}
                  onClick={() => router.push(`/projects/${projectId}/quote/${q.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ fontWeight: 600, color: "var(--c-primary)" }}>
                    {q.quote_number || "（番号なし）"}
                  </td>
                  <td style={{ fontSize: 12 }}>{fmtDate(q.issue_date)}</td>
                  <td className="num" style={{ fontFamily: "var(--ff-mono)", fontSize: 13 }}>
                    {fmt(q.subtotal)}
                  </td>
                  <td className="num" style={{ fontFamily: "var(--ff-mono)", fontSize: 13, fontWeight: 600 }}>
                    {fmt(q.total_amount)}
                  </td>
                  <td>
                    <span style={{
                      display: "inline-flex", padding: "1px 8px",
                      borderRadius: "var(--r-pill)", fontSize: 11, fontWeight: 600,
                      ...(STATUS_STYLE[q.status] || STATUS_STYLE.draft),
                    }}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                    {fmtDate(q.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
