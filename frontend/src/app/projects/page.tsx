"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import type { ProjectListItem, ProjectListResponse, ProjectRole, ProjectStatus } from "@/types/project";
import { PROJECT_ROLE_COLOR, PROJECT_ROLE_LABEL, PROJECT_STATUS_LABEL } from "@/types/project";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { fmtMoney, fmtYen } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

function ExcelImportContent({ onImported }: { onImported?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.name.endsWith(".xlsx")) setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const previewRes = await fetch(`${API_URL}/api/v1/excel/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!previewRes.ok) throw new Error("プレビュー取得失敗");
      const sid = previewRes.headers.get("X-Import-Session");
      const previews = await previewRes.json();
      const rows = previews.map((p: { row_index: number }) => ({ row_index: p.row_index, overwrite: false, deleted_action: "new" }));
      const importRes = await fetch(`${API_URL}/api/v1/excel/import?session_id=${sid}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!importRes.ok) throw new Error("インポート失敗");
      const result = await importRes.json();
      setMsg({ type: "success", text: `完了: 新規 ${result.created}件 / 更新 ${result.updated}件 / スキップ ${result.skipped}件` });
      setFile(null);
      onImported?.();
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "エラーが発生しました" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? "var(--c-primary)" : "var(--c-border)"}`,
          borderRadius: "var(--r-lg)",
          padding: "40px 20px",
          textAlign: "center",
          background: isDragging ? "var(--c-primary-50)" : "var(--c-surface-2)",
          cursor: "pointer",
        }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file"; input.accept = ".xlsx";
          input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) setFile(f); };
          input.click();
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{file ? file.name : "Excelファイルをドロップ"}</div>
        <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>.xlsx ファイルのみ対応 / クリックでファイル選択</div>
      </div>
      {msg && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 13,
          background: msg.type === "success" ? "color-mix(in oklab, var(--c-success) 12%, var(--c-surface))" : "color-mix(in oklab, var(--c-danger) 12%, var(--c-surface))",
          color: msg.type === "success" ? "var(--c-success)" : "var(--c-danger)", fontWeight: 600 }}>
          {msg.text}
        </div>
      )}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={handleImport} disabled={!file || loading}>
          {loading ? "インポート中..." : "インポート実行"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--c-text-subtle)", marginTop: 12 }}>
        ※ 詳細なコンフリクト処理は「管理者設定」の旧インポートページをご使用ください。
      </p>
    </div>
  );
}

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


export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "">("");
  const [filterRole, setFilterRole] = useState<ProjectRole | "">("");
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProjects = useCallback(async (p: number, status: string, q: string, role: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("per_page", String(perPage));
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      if (role) params.set("role", role);
      const data = await apiFetch<ProjectListResponse>(`/api/v1/projects?${params}`);
      setProjects(data.items);
      setTotal(data.total);
    } catch {
      // 401 は apiFetch が /login へリダイレクト
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(page, filterStatus, searchQ, filterRole); }, [page, filterStatus, filterRole, searchQ, fetchProjects]);

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
    await fetchProjects(page, filterStatus, searchQ, filterRole);
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setShowImportModal(true)} style={{ fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Excelインポート
          </button>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新規案件
          </Button>
        </div>
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
          <div className="v">{pageTotal > 0 ? fmtMoney(pageTotal) : "—"}</div>
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
        {(filterStatus || filterRole || searchQ) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFilterStatus("");
              setFilterRole("");
              setSearchQ("");
              setSearchInput("");
              setPage(1);
            }}
          >
            フィルタクリア
          </button>
        )}
      </div>

      {/* 立場絞り込みタブ */}
      <div style={{ display: "flex", gap: 6, padding: "0 0 8px" }}>
        {([["", "すべて"], ["prime", "元請"], ["sub", "下請"], ["public", "公共"]] as [string, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => { setFilterRole(val as ProjectRole | ""); setPage(1); }}
            style={{
              padding: "3px 12px", fontSize: 12, borderRadius: 20, cursor: "pointer",
              border: `1px solid ${val && filterRole === val ? PROJECT_ROLE_COLOR[val as ProjectRole] : "var(--c-border)"}`,
              background: filterRole === val && val ? `color-mix(in oklab, ${PROJECT_ROLE_COLOR[val as ProjectRole]} 12%, var(--c-surface))` : "var(--c-surface)",
              color: filterRole === val && val ? PROJECT_ROLE_COLOR[val as ProjectRole] : "var(--c-text-muted)",
              fontWeight: filterRole === val ? 700 : 400,
            }}
          >
            {label}
          </button>
        ))}
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
                <th style={{ width: 56 }}>立場</th>
                <th style={{ width: 110 }}>ステータス</th>
                <th className="num" style={{ width: 120 }}>受注額</th>
                <th style={{ width: 120 }}>担当</th>
                <th style={{ width: 80 }}>更新日</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    読み込み中...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
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
                      {p.project_role ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                          background: `color-mix(in oklab, ${PROJECT_ROLE_COLOR[p.project_role]} 12%, var(--c-surface))`,
                          color: PROJECT_ROLE_COLOR[p.project_role],
                          border: `1px solid color-mix(in oklab, ${PROJECT_ROLE_COLOR[p.project_role]} 30%, var(--c-border))`,
                        }}>
                          {PROJECT_ROLE_LABEL[p.project_role]}
                        </span>
                      ) : (
                        <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[p.status]}`}>
                        <span className="dot" />
                        {PROJECT_STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="num">
                      {fmtYen(p.project_price)}
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

      {/* Excel インポートモーダル */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", padding: 0, width: 640, maxHeight: "85vh", overflowY: "auto", boxShadow: "var(--sh-3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--c-border)" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>案件 Excelインポート</h2>
              <button onClick={() => setShowImportModal(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "var(--c-text-muted)" }}>×</button>
            </div>
            <div style={{ padding: "24px" }}>
              <ExcelImportContent onImported={() => { setShowImportModal(false); fetchProjects(1, filterStatus, searchQ, filterRole); }} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
