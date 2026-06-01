"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import type { ProjectListItem, ProjectListResponse, ProjectStatus } from "@/types/project";
import { PROJECT_STATUS_LABEL } from "@/types/project";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";

const STATUS_CLASS: Record<ProjectStatus, string> = {
  quote: "s-quote", ordered: "s-order", started: "s-start",
  in_progress: "s-progress", completed: "s-done", billed: "s-billed", paid: "s-paid",
};

const ALL_STATUSES: ProjectStatus[] = [
  "quote", "ordered", "started", "in_progress", "completed", "billed", "paid",
];

const ACTIVE_STATUSES = new Set<ProjectStatus>(["started", "in_progress"]);

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function iniChar(name: string | null) {
  return name ? name.charAt(0) : "?";
}

function fmtM(n: number) {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `¥${(n / 1_000).toFixed(0)}K`;
  return `¥${n.toLocaleString()}`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "">("");
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProjects = useCallback(async (p: number, status: string, q: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("per_page", String(perPage));
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const data = await apiFetch<ProjectListResponse>(`/api/v1/projects?${params}`);
      setProjects(data.items);
      setTotal(data.total);
    } catch {
      // 401 は apiFetch が /login へリダイレクト
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(page, filterStatus, searchQ); }, [page, filterStatus, searchQ, fetchProjects]);

  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearchQ(v); }, 400);
  };

  const handleStatusToggle = (s: ProjectStatus) => {
    setFilterStatus(prev => prev === s ? "" : s);
    setPage(1);
  };

  const handleCreated = (project: ProjectListItem) => {
    setShowModal(false);
    setProjects(prev => [project, ...prev]);
    setTotal(t => t + 1);
  };

  const allSelected = projects.length > 0 && selectedIds.size === projects.length;
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)));
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (!confirm(`選択した ${selectedIds.size} 件の案件を削除しますか？\nこの操作は取り消せません。`)) return;
    setDeleting(true);
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await apiFetch(`/api/v1/projects/${id}`, { method: "DELETE" });
      } catch {
        failed++;
      }
    }
    setSelectedIds(new Set());
    setDeleting(false);
    await fetchProjects(page, filterStatus, searchQ);
    if (failed > 0) alert(`${failed} 件の削除に失敗しました（権限がない可能性があります）`);
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // KPI computations from current page items
  const pageTotal = projects.reduce((s, p) => s + (p.project_price ?? 0), 0);
  const activeCount = projects.filter(p => ACTIVE_STATUSES.has(p.status)).length;

  // Page numbers to show in pagination
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
      breadcrumbs={[{ label: "案件一覧" }]}
      action={
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新規案件
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="toolbar">
        <h1>案件一覧</h1>
        <span className="meta">全 {total} 件</span>
      </div>

      {/* Mini KPI strip */}
      <div className="listkpis">
        <div className="lkpi">
          <div className="k">表示中</div>
          <div className="v">
            {projects.length}
            <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 400 }}>
              {" "}/ {total}
            </span>
          </div>
          <div className="sub">{filterStatus ? `${PROJECT_STATUS_LABEL[filterStatus]}でフィルタ` : "全ステータス"}</div>
        </div>
        <div className="lkpi">
          <div className="k">合計受注額</div>
          <div className="v">{pageTotal > 0 ? fmtM(pageTotal) : "—"}</div>
          <div className="sub">現在のページ</div>
        </div>
        <div className="lkpi">
          <div className="k">合計粗利</div>
          <div className="v" style={{ color: "var(--c-accent)" }}>—</div>
          <div className="sub">—</div>
        </div>
        <div className="lkpi">
          <div className="k">進行中</div>
          <div className="v">{activeCount}</div>
          <div className="sub">着工 + 施工中</div>
        </div>
        <div className="lkpi">
          <div className="k">期限アラート</div>
          <div className="v" style={{ color: "var(--c-warn)" }}>—</div>
          <div className="sub">—</div>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: "var(--r-md)", padding: "8px 14px",
          marginBottom: 8, boxShadow: "var(--sh-1)",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-primary)" }}>
            {selectedIds.size} 件選択中
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              padding: "4px 12px", fontSize: 12,
              background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
              borderRadius: "var(--r-md)", cursor: "pointer",
            }}
          >
            選択解除
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            style={{
              padding: "4px 12px", fontSize: 12, fontWeight: 600,
              background: "var(--c-danger)", color: "#fff", border: "none",
              borderRadius: "var(--r-md)", cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? "削除中…" : `${selectedIds.size} 件を削除`}
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="fbar">
        <div className="search-box">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="工事名・発注者・工事番号で検索"
          />
        </div>
        <span className="sep" />
        <span className="lbl">ステータス</span>
        <button
          className={`pill${filterStatus === "" ? " on" : ""}`}
          onClick={() => { setFilterStatus(""); setPage(1); }}
        >
          すべて
        </button>
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            className={`pill${filterStatus === s ? " on" : ""}`}
            onClick={() => handleStatusToggle(s)}
          >
            <span
              className="dot"
              style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }}
            />
            {PROJECT_STATUS_LABEL[s]}
          </button>
        ))}
        <span className="spacer" />
        {(filterStatus || searchQ) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFilterStatus("");
              setSearchQ("");
              setSearchInput("");
              setPage(1);
            }}
          >
            フィルタクリア
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ptbl">
            <thead>
              <tr>
                <th style={{ width: 36, padding: "0 10px" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--c-primary)" }}
                  />
                </th>
                <th style={{ width: 106 }}>工事番号</th>
                <th>工事名 / 発注者</th>
                <th style={{ width: 110 }}>ステータス</th>
                <th className="num" style={{ width: 120 }}>受注額</th>
                <th style={{ width: 120 }}>担当</th>
                <th style={{ width: 80 }}>更新日</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    読み込み中...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    案件がありません
                  </td>
                </tr>
              ) : (
                projects.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    style={selectedIds.has(p.id) ? { background: "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))" } : undefined}
                  >
                    <td style={{ padding: "0 10px" }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={e => toggleSelect(p.id, e as unknown as React.MouseEvent)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--c-primary)" }}
                      />
                    </td>
                    <td>
                      <span className="pn">{p.project_number}</span>
                    </td>
                    <td>
                      <div className="nm">
                        {p.project_name}
                        {p.client_name && <small>{p.client_name}</small>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[p.status]}`}>
                        <span className="dot" />
                        {PROJECT_STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="num">
                      {p.project_price != null ? `¥${p.project_price.toLocaleString()}` : "—"}
                    </td>
                    <td>
                      {p.sales_person_name ? (
                        <>
                          <span className="charge-ava">{iniChar(p.sales_person_name)}</span>
                          {p.sales_person_name}
                        </>
                      ) : (
                        <span style={{ color: "var(--c-text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="num" style={{ color: "var(--c-text-muted)", fontSize: 12 }}>
                      {formatShortDate(p.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagi">
          <span>
            {projects.length > 0
              ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} / ${total}件`
              : `${total}件`}
          </span>
          <span className="spacer" />
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {pageNums.map((n, i) =>
            n === "…" ? (
              <span key={`ellipsis-${i}`} style={{ color: "var(--c-text-subtle)", padding: "0 2px" }}>…</span>
            ) : (
              <button
                key={n}
                className={page === n ? "on" : ""}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ),
          )}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>

      <CreateProjectModal open={showModal} onClose={() => setShowModal(false)} onCreated={handleCreated} />
    </AppShell>
  );
}
