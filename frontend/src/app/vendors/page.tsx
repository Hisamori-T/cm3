"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { VendorCreate, VendorDetail, VendorListItem, VendorListResponse } from "@/types/vendor";
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

/** 業者新規作成モーダル */
function CreateVendorModal({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: (v: VendorDetail) => void;
}) {
  const [form, setForm] = useState<VendorCreate>({ vendor_name: "" });
  const [workTypeInput, setWorkTypeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => { setForm({ vendor_name: "" }); setWorkTypeInput(""); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_name.trim()) { setError("業者名は必須です"); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const workTypes = workTypeInput.trim()
        ? workTypeInput.split(/[,、\s]+/).map(s => s.trim()).filter(Boolean)
        : null;
      const created = await apiFetch<VendorDetail>("/api/v1/vendors", {
        method: "POST",
        body: JSON.stringify({ ...form, primary_work_types: workTypes }),
      });
      reset();
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const f = (field: keyof VendorCreate) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value || null }));

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>業者新規作成</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium">業者名 <span className="text-red-500">*</span></label>
            <Input value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">業者名（カナ）</label>
            <Input value={form.vendor_name_kana ?? ""} onChange={f("vendor_name_kana")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">電話番号</label>
              <Input value={form.phone ?? ""} onChange={f("phone")} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">担当者</label>
              <Input value={form.contact_person ?? ""} onChange={f("contact_person")} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">主要工種（カンマ区切り）</label>
            <Input value={workTypeInput} onChange={e => setWorkTypeInput(e.target.value)} placeholder="例: 電気工事, 管工事" />
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

/** 業者マスタ一覧 (S13) */
export default function VendorsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<VendorListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterWork, setFilterWork] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchVendors = useCallback(async (q: string, p: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE), active_only: "true" });
      if (q) params.set("q", q);
      const data = await apiFetch<VendorListResponse>(`/api/v1/vendors?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { /* 401 → apiFetch redirects */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(search, page); }, [search, page, fetchVendors]);

  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearch(v); }, 400);
  };

  const handleWorkToggle = (w: string) => {
    const next = filterWork === w ? "" : w;
    setFilterWork(next);
    setPage(1);
    setSearch(next);
    setSearchInput(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length && items.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(v => v.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`選択した ${selected.size} 件の業者を削除しますか？\n関連する案件・見積のデータは保持されます。`)) return;
    setDeleting(true);
    try {
      await apiFetch("/api/v1/vendors/bulk-deactivate", {
        method: "POST",
        body: JSON.stringify({ vendor_ids: Array.from(selected) }),
      });
      setSelected(new Set());
      await fetchVendors(search, page);
    } catch (e) {
      alert(`削除に失敗しました: ${(e as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Extract unique work types from current items for pills
  const allWorkTypes = Array.from(new Set(items.flatMap(v => v.primary_work_types ?? []))).slice(0, 8);
  const COMMON_TYPES = ["配管", "電気", "塗装", "鉄骨", "保温", "運搬", "資材"];
  const displayTypes = allWorkTypes.length >= 3 ? allWorkTypes : COMMON_TYPES;

  // Page nums
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
      breadcrumbs={[{ label: "業者マスタ" }]}
      action={
        isAdmin ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selected.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--c-text-muted)" }}>
                  {selected.size} 件選択中
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                  style={{ fontSize: 12 }}
                >
                  選択解除
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  style={{
                    fontSize: 12,
                    background: "var(--c-danger)",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  {deleting ? "削除中…" : "削除"}
                </Button>
              </div>
            )}
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新規登録
            </Button>
          </div>
        ) : undefined
      }
    >
      {/* Toolbar */}
      <div className="toolbar">
        <h1>業者マスタ</h1>
        <span className="meta">登録数 {total} 社</span>
      </div>

      {/* Filter bar */}
      <div className="fbar">
        <div className="search-box">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="業者名・担当者・工種で検索"
          />
        </div>
        <span className="sep" />
        <span className="lbl">工種</span>
        <button
          className={`pill${filterWork === "" ? " on" : ""}`}
          onClick={() => { setFilterWork(""); setPage(1); setSearch(""); setSearchInput(""); }}
        >
          すべて
        </button>
        {displayTypes.map(w => (
          <button
            key={w}
            className={`pill${filterWork === w ? " on" : ""}`}
            onClick={() => handleWorkToggle(w)}
          >
            {w}
          </button>
        ))}
        <span className="spacer" />
        {(filterWork || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterWork(""); setSearch(""); setSearchInput(""); setPage(1); }}>
            クリア
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="vtbl">
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selected.size === items.length}
                      ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < items.length; }}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                )}
                <th>業者名</th>
                <th>工種</th>
                <th style={{ width: 160 }}>担当者 / TEL</th>
                <th style={{ width: 90 }} className="num">登録日</th>
                <th style={{ width: 60, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    読み込み中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    業者が見つかりません
                  </td>
                </tr>
              ) : items.map(v => (
                <tr
                  key={v.id}
                  onClick={() => router.push(`/vendors/${v.id}`)}
                  style={{ background: selected.has(v.id) ? "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))" : undefined }}
                >
                  {isAdmin && (
                    <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggleSelect(v.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                  )}
                  <td>
                    <div className="vn-row">
                      <div className="vn-ic">{v.vendor_name.charAt(0)}</div>
                      <div className="vn-info">
                        <div className="nm">{v.vendor_name}</div>
                        {(v.contact_person || v.phone) && (
                          <small>
                            {v.contact_person && `担当: ${v.contact_person}`}
                            {v.contact_person && v.phone && " · "}
                            {v.phone && `TEL ${v.phone}`}
                          </small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {v.primary_work_types && v.primary_work_types.length > 0
                      ? v.primary_work_types.slice(0, 3).map(w => (
                          <span key={w} className="trade-chip">{w}</span>
                        ))
                      : <span style={{ color: "var(--c-text-subtle)" }}>—</span>
                    }
                  </td>
                  <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>
                    {v.contact_person ?? "—"}
                    {v.phone && <><br /><span style={{ fontFamily: "var(--ff-mono)", fontSize: 11 }}>{v.phone}</span></>}
                  </td>
                  <td className="num" style={{ color: "var(--c-text-muted)", fontSize: 11 }}>
                    {new Date(v.created_at).toLocaleDateString("ja-JP", { year: "2-digit", month: "numeric", day: "numeric" })}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={e => { e.stopPropagation(); router.push(`/vendors/${v.id}`); }}
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
              <button key={n} className={page === n ? "on" : ""} onClick={() => setPage(n)}>
                {n}
              </button>
            )
          )}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>

      <CreateVendorModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={v => { setCreateOpen(false); setItems(prev => [v, ...prev]); setTotal(t => t + 1); }}
      />
    </AppShell>
  );
}
