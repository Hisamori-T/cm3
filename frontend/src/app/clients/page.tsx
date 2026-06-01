"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ClientCreate, ClientDetail, ClientListItem, ClientListResponse, ClientRank } from "@/types/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";

const PER_PAGE = 30;

const RANK_COLOR: Record<ClientRank, { bg: string; text: string }> = {
  A: { bg: "color-mix(in oklab, var(--c-danger) 14%, var(--c-surface))", text: "var(--c-danger)" },
  B: { bg: "color-mix(in oklab, var(--c-warn) 14%, var(--c-surface))", text: "var(--c-warn)" },
  C: { bg: "var(--c-surface-2)", text: "var(--c-text-muted)" },
};

/** 顧客新規作成モーダル */
function CreateClientModal({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: (c: ClientDetail) => void;
}) {
  const [form, setForm] = useState<ClientCreate>({ client_name: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => { setForm({ client_name: "" }); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  // 顧客名からコードを自動生成
  function autoGenCode(name: string): string {
    const clean = name.replace(/株式会社|有限会社|合同会社|（株）|（有）|\s/g, "");
    const prefix = clean.slice(0, 4).toUpperCase();
    const suffix = String(Date.now()).slice(-3);
    return `${prefix}-${suffix}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim()) { setError("顧客名は必須です"); return; }
    setIsSubmitting(true); setError(null);
    try {
      const created = await apiFetch<ClientDetail>("/api/v1/clients", {
        method: "POST",
        body: JSON.stringify(form),
      });
      reset();
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const f = (field: keyof ClientCreate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value || null }));

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>顧客新規登録</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium">顧客名 <span className="text-red-500">*</span></label>
            <Input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">顧客名（カナ）</label>
            <Input value={form.client_name_kana ?? ""} onChange={f("client_name_kana")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">電話番号</label>
              <Input value={form.phone ?? ""} onChange={f("phone")} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">ランク</label>
              <select
                value={form.client_rank ?? ""}
                onChange={f("client_rank")}
                style={{
                  width: "100%", height: 32, padding: "0 8px", fontSize: 13,
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  background: "var(--c-surface)", color: "var(--c-text)", outline: "none",
                }}
              >
                <option value="">— 未設定 —</option>
                <option value="A">A（最優先）</option>
                <option value="B">B（優先）</option>
                <option value="C">C（標準）</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">顧客コード</label>
            <div style={{ display: "flex", gap: 6 }}>
              <Input
                value={form.client_code ?? ""}
                onChange={f("client_code")}
                placeholder="自動生成または手入力"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, client_code: autoGenCode(p.client_name) }))}
                style={{
                  padding: "0 10px", fontSize: 12, whiteSpace: "nowrap",
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  background: "var(--c-surface-2)", color: "var(--c-text-muted)", cursor: "pointer",
                }}
              >
                自動生成
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>キャンセル</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "作成中…" : "作成"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 顧客マスタ一覧 (S-C1). */
export default function ClientsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<ClientListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterRank, setFilterRank] = useState<ClientRank | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClients = useCallback(async (q: string, p: number, rank: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), per_page: String(PER_PAGE), active_only: "false",
      });
      if (q) params.set("q", q);
      if (rank) params.set("rank", rank);
      const data = await apiFetch<ClientListResponse>(`/api/v1/clients?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { /* 401 → redirect */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(search, page, filterRank); }, [search, page, filterRank, fetchClients]);

  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearch(v); }, 400);
  };

  const handleRankToggle = (r: ClientRank) => {
    setFilterRank(prev => prev === r ? "" : r);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const pageNums: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    if (page > 3) pageNums.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pageNums.push(i);
    if (page < totalPages - 2) pageNums.push("…");
    pageNums.push(totalPages);
  }

  return (
    <AppShell
      breadcrumbs={[{ label: "顧客マスタ" }]}
      action={
        isAdmin ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新規登録
          </Button>
        ) : undefined
      }
    >
      <div className="toolbar">
        <h1>顧客マスタ</h1>
        <span className="meta">登録数 {total} 社</span>
      </div>

      <div className="fbar">
        <div className="search-box">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="顧客名・カナ・コードで検索"
          />
        </div>
        <span className="sep" />
        <span className="lbl">ランク</span>
        <button className={`pill${filterRank === "" ? " on" : ""}`} onClick={() => { setFilterRank(""); setPage(1); }}>
          すべて
        </button>
        {(["A", "B", "C"] as ClientRank[]).map(r => (
          <button
            key={r}
            className={`pill${filterRank === r ? " on" : ""}`}
            onClick={() => handleRankToggle(r)}
          >
            {r}
          </button>
        ))}
        <span className="spacer" />
        {(filterRank || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterRank(""); setSearch(""); setSearchInput(""); setPage(1); }}>
            クリア
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="vtbl">
            <thead>
              <tr>
                <th>顧客名</th>
                <th style={{ width: 60, textAlign: "center" }}>ランク</th>
                <th style={{ width: 160 }}>電話番号 / 担当者</th>
                <th className="num" style={{ width: 70 }}>店舗数</th>
                <th className="num" style={{ width: 70 }}>案件数</th>
                <th style={{ width: 80, textAlign: "center" }}>ステータス</th>
                <th style={{ width: 90 }} className="num">登録日</th>
                <th style={{ width: 60, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    読み込み中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    顧客が見つかりません
                  </td>
                </tr>
              ) : items.map(c => (
                <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)}>
                  <td>
                    <div className="vn-row">
                      <div className="vn-ic" style={{
                        background: c.client_rank
                          ? RANK_COLOR[c.client_rank].bg
                          : "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))",
                        color: c.client_rank ? RANK_COLOR[c.client_rank].text : "var(--c-primary)",
                      }}>
                        {c.client_name.charAt(0)}
                      </div>
                      <div className="vn-info">
                        <div className="nm">{c.client_name}</div>
                        {c.client_name_kana && (
                          <small>{c.client_name_kana}</small>
                        )}
                        {c.client_code && (
                          <small style={{ fontFamily: "var(--ff-mono)", fontSize: 10 }}>{c.client_code}</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {c.client_rank ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 22, height: 22, borderRadius: "50%",
                        fontSize: 11, fontWeight: 700,
                        background: RANK_COLOR[c.client_rank].bg,
                        color: RANK_COLOR[c.client_rank].text,
                      }}>
                        {c.client_rank}
                      </span>
                    ) : (
                      <span style={{ color: "var(--c-text-subtle)" }}>—</span>
                    )}
                  </td>
                  <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>
                    {c.phone ?? "—"}
                  </td>
                  <td className="num" style={{ color: "var(--c-text-muted)" }}>{c.site_count}</td>
                  <td className="num" style={{ color: "var(--c-text-muted)" }}>{c.project_count}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "2px 8px", borderRadius: "var(--r-pill)",
                      fontSize: 11, fontWeight: 600,
                      background: c.is_active
                        ? "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))"
                        : "var(--c-surface-2)",
                      color: c.is_active ? "var(--c-success)" : "var(--c-text-muted)",
                    }}>
                      {c.is_active ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="num" style={{ color: "var(--c-text-muted)", fontSize: 11 }}>
                    {new Date(c.created_at).toLocaleDateString("ja-JP", { year: "2-digit", month: "numeric", day: "numeric" })}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={e => { e.stopPropagation(); router.push(`/clients/${c.id}`); }}
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagi">
          <span>
            {items.length > 0
              ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total}件`
              : `${total}件`}
          </span>
          <span className="spacer" />
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {pageNums.map((n, i) =>
            n === "…" ? (
              <span key={`e-${i}`} style={{ color: "var(--c-text-subtle)", padding: "0 2px" }}>…</span>
            ) : (
              <button key={n} className={page === n ? "on" : ""} onClick={() => setPage(n as number)}>
                {n}
              </button>
            )
          )}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>

      <CreateClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={c => {
          setCreateOpen(false);
          setItems(prev => [c, ...prev]);
          setTotal(t => t + 1);
        }}
      />
    </AppShell>
  );
}
