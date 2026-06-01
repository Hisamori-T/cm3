"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { ScanJob } from "@/types/scan";
import { BulkActionBar } from "@/components/scan/BulkActionBar";
import { JobRow } from "@/components/scan/JobRow";
import { ProjectPickerCard } from "@/components/scan/ProjectPickerCard";
import type { TransferTarget } from "@/types/scan";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

interface ProjectOption { id: string; project_number: string; project_name: string; }

type FilterTab = "all" | "processing" | "review" | "done" | "trash";

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastMsg {
  text: string;
  error: boolean;
  links?: { label: string; href: string }[];
}

function Toast({ msg, onClose }: { msg: ToastMsg; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 8000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, maxWidth: 500,
      background: msg.error ? "var(--c-danger)" : "var(--c-primary)",
      color: "#fff", borderRadius: "var(--r-lg)",
      boxShadow: "0 8px 32px rgba(0,0,0,.25)",
      padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 12, fontSize: 13,
    }}>
      <span style={{ flex: 1 }}>{msg.text}</span>
      {msg.links?.map(l => (
        <Link key={l.href} href={l.href} style={{
          background: "rgba(255,255,255,0.25)", color: "#fff",
          padding: "3px 10px", borderRadius: "var(--r-md)",
          fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
        }}>{l.label} →</Link>
      ))}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 一括転記モーダル
// ---------------------------------------------------------------------------

function BulkTransferModal({
  count,
  onClose,
  onTransfer,
}: {
  count: number;
  onClose: () => void;
  onTransfer: (projectId: string, targets: string[], saveVendor: boolean) => Promise<void>;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProjectOption | null>(null);
  const [targets, setTargets] = useState({ qcds: true, quote: true });
  const [saveVendor, setSaveVendor] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ items: ProjectOption[] }>("/api/v1/projects?per_page=100")
      .then(d => setProjects(d.items || []))
      .catch(() => {});
  }, []);

  const filtered = projects.filter(p =>
    p.project_number.includes(query) || p.project_name.includes(query)
  );

  const handleTransfer = async () => {
    if (!selected) return;
    const tgts = [targets.qcds && "qcds", targets.quote && "quote"].filter(Boolean) as string[];
    if (!tgts.length) return;
    setLoading(true);
    await onTransfer(selected.id, tgts, saveVendor);
    setLoading(false);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--c-surface)", borderRadius: "var(--r-lg)",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
        width: 480, display: "flex", flexDirection: "column", maxHeight: "80vh",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>一括転記（{count}件）</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)" }}><X size={16} /></button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 案件選択 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>案件を選択 *</div>
            {selected ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
                border: "1px solid var(--c-primary)", borderRadius: "var(--r-md)",
                padding: "8px 12px",
              }}>
                <span style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--c-text-muted)" }}>{selected.project_number}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{selected.project_name}</span>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)" }}><X size={12} /></button>
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="案件番号・名称で検索"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "8px 10px", fontSize: 13,
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                    background: "var(--c-surface)", color: "var(--c-text)", outline: "none",
                  }}
                />
                <div style={{ border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
                  {filtered.slice(0, 30).map(p => (
                    <button key={p.id} onClick={() => { setSelected(p); setQuery(""); }}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", display: "flex", gap: 10, borderBottom: "1px solid var(--c-border)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--c-surface-2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <span style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--c-text-muted)", minWidth: 80 }}>{p.project_number}</span>
                      <span style={{ fontSize: 13 }}>{p.project_name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 転記先 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>転記先を選択 *</div>
            {[
              { key: "qcds", label: "QCDS 直接工事費（取決見通表）", desc: "業者ごとのグロス行として追加" },
              { key: "quote", label: "業者見積（版を新規作成）", desc: "業者名で版を自動作成して明細を追加します" },
            ].map(({ key, label, desc }) => (
              <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={targets[key as keyof typeof targets]}
                  onChange={e => setTargets(t => ({ ...t, [key]: e.target.checked }))}
                  style={{ marginTop: 2, accentColor: "var(--c-primary)" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* 業者マスタ */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={saveVendor}
              onChange={e => setSaveVendor(e.target.checked)}
              style={{ accentColor: "var(--c-primary)" }}
            />
            <div>
              <div style={{ fontSize: 13 }}>業者マスタに単価履歴を保存</div>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>次回以降の見積に活用できます</div>
            </div>
          </label>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--c-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
            ※ レビュー待ちのジョブは転記と同時に自動で確認済みになります
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "6px 16px", fontSize: 13, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer" }}>
            キャンセル
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selected || (!targets.qcds && !targets.quote) || loading}
            style={{
              padding: "6px 20px", fontSize: 13, fontWeight: 600,
              background: (!selected || (!targets.qcds && !targets.quote)) ? "var(--c-surface-2)" : "var(--c-primary)",
              color: (!selected || (!targets.qcds && !targets.quote)) ? "var(--c-text-muted)" : "#fff",
              border: "none", borderRadius: "var(--r-md)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            転記する
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインページ
// ---------------------------------------------------------------------------

/** 業者見積スキャン一覧画面（B-3-1）。一括選択・転記・削除対応。 */
export default function ScanListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [linkedProject, setLinkedProject] = useState<ProjectOption | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // 一括操作
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const isTrash = filterTab === "trash";
      const url = isTrash
        ? "/api/v1/scan/jobs?per_page=50&include_deleted=true"
        : "/api/v1/scan/jobs?per_page=50";
      const data = await apiFetch<ScanJob[]>(url);
      setJobs(data);
    } catch { /* apiFetch handles 401 */ }
    finally { setLoading(false); }
  }, [filterTab]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // 選択をタブ切り替えでリセット
  useEffect(() => { setSelectedIds(new Set()); }, [filterTab]);

  async function loadProjects() {
    try {
      const data = await apiFetch<{ items: ProjectOption[] }>("/api/v1/projects?per_page=100");
      setProjects(data.items || []);
    } catch { /* ignore */ }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const url = linkedProject
      ? `${API_URL}/api/v1/scan/upload?project_id=${linkedProject.id}`
      : `${API_URL}/api/v1/scan/upload`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (res.ok) {
        setToast({ text: "アップロードしました。解析中です…", error: false });
        await loadJobs();
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ text: `エラー: ${(err as { detail?: string }).detail ?? res.statusText}`, error: true });
      }
    } catch (ex) {
      setToast({ text: `エラー: ${(ex as Error).message}`, error: true });
    } finally {
      setUploading(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    files.reduce((promise, file) => promise.then(() => uploadFile(file)), Promise.resolve());
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    // 複数ファイルを順番にアップロード
    files.reduce((promise, file) => promise.then(() => uploadFile(file)), Promise.resolve());
  }

  // チェックボックス操作
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const all = filteredJobs.map(j => j.id);
    if (selectedIds.size === all.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(all));
    }
  }

  // 一括削除
  async function handleBulkDelete() {
    if (!confirm(`${selectedIds.size}件のスキャンジョブを削除しますか？`)) return;
    try {
      await apiFetch("/api/v1/scan/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ scan_job_ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      setToast({ text: `${selectedIds.size}件を削除しました`, error: false });
      await loadJobs();
    } catch {
      setToast({ text: "削除に失敗しました", error: true });
    }
  }

  // ゴミ箱から復活
  async function handleRestore(id: string) {
    try {
      await apiFetch("/api/v1/scan/bulk-restore", {
        method: "POST",
        body: JSON.stringify({ scan_job_ids: [id] }),
      });
      setToast({ text: "復元しました", error: false });
      await loadJobs();
    } catch {
      setToast({ text: "復元に失敗しました", error: true });
    }
  }

  // 1件削除（行の削除ボタン用）
  async function handleSingleDelete(id: string) {
    if (!confirm("このスキャンジョブを削除しますか？")) return;
    try {
      await apiFetch("/api/v1/scan/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ scan_job_ids: [id] }),
      });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setToast({ text: "削除しました", error: false });
      await loadJobs();
    } catch {
      setToast({ text: "削除に失敗しました", error: true });
    }
  }

  // 物理削除
  async function handlePurge(id: string) {
    if (!confirm("完全に削除します。この操作は取り消せません。")) return;
    try {
      await apiFetch("/api/v1/scan/bulk-purge", {
        method: "DELETE",
        body: JSON.stringify({ scan_job_ids: [id] }),
      });
      setToast({ text: "完全に削除しました", error: false });
      await loadJobs();
    } catch {
      setToast({ text: "削除に失敗しました", error: true });
    }
  }

  // BulkActionBar から呼ばれる転記ルーター（モーダルを開く）
  function handleBulkTransferFromBar(_targets: TransferTarget[]) {
    setShowBulkModal(true);
  }

  // 一括転記
  async function handleBulkTransfer(projectId: string, targets: string[], saveVendor: boolean) {
    // succeeded（レビュー待ち）も reviewed（確認済み）も転記対象にする
    const selectedJobs = jobs.filter(j =>
      selectedIds.has(j.id) && (j.status === "reviewed" || j.status === "succeeded")
    );
    if (!selectedJobs.length) {
      setToast({ text: "転記できるジョブがありません（処理中・失敗したジョブは転記対象外です）", error: true });
      return;
    }

    // scan_result_ids を収集。未レビュー(succeeded)は転記前に自動で確認済みにする
    const resultIds: string[] = [];
    for (const job of selectedJobs) {
      try {
        const detail = await apiFetch<{ results: { id: string }[] }>(`/api/v1/scan/jobs/${job.id}`);
        for (const r of detail.results) {
          if (job.status === "succeeded") {
            await apiFetch(`/api/v1/scan/results/${r.id}/confirm`, { method: "POST" }).catch(() => {});
          }
          resultIds.push(r.id);
        }
      } catch { /* ignore */ }
    }

    if (!resultIds.length) {
      setToast({ text: "転記対象の解析結果が見つかりません", error: true });
      return;
    }

    try {
      const res = await apiFetch<{ applied_count: number; qcds_affected: number; quote_affected: number; qcds_url?: string; quote_url?: string }>(
        "/api/v1/scan/bulk-apply",
        {
          method: "POST",
          body: JSON.stringify({
            scan_result_ids: resultIds,
            project_id: projectId,
            targets,
            save_to_vendor_master: saveVendor,
          }),
        }
      );
      setSelectedIds(new Set());
      const links: { label: string; href: string }[] = [];
      if (res.qcds_url) links.push({ label: "QCDSを見る", href: res.qcds_url });
      if (res.quote_url) links.push({ label: "見積書を見る", href: res.quote_url });
      setToast({ text: `${res.applied_count}件を転記しました`, error: false, links });
      await loadJobs();
    } catch {
      setToast({ text: "転記に失敗しました", error: true });
    }
  }

  // KPI
  const now = new Date();
  const thisMonth = jobs.filter(j => {
    const d = new Date(j.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const withConf = jobs.filter(j => j.confidence_score != null);
  const avgConf = withConf.length
    ? Math.round((withConf.reduce((s, j) => s + (j.confidence_score ?? 0), 0) / withConf.length) * 100)
    : null;
  const reviewCount = jobs.filter(j => j.status === "succeeded").length;
  const doneCount   = jobs.filter(j => j.status === "reviewed").length;
  const processingCount = jobs.filter(j => j.status === "pending" || j.status === "processing").length;

  const filteredJobs = jobs.filter(j => {
    if (filterTab === "trash")      return true; // API already filtered
    if (filterTab === "processing") return j.status === "pending" || j.status === "processing";
    if (filterTab === "review")     return j.status === "succeeded";
    if (filterTab === "done")       return j.status === "reviewed" || j.status === "failed";
    return true;
  });

  const allSelected = filteredJobs.length > 0 && selectedIds.size === filteredJobs.length;
  const someSelected = selectedIds.size > 0;

  return (
    <AppShell
      breadcrumbs={[{ label: "業者見積スキャン" }]}
      action={
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 14px",
          background: uploading ? "var(--c-surface-2)" : "var(--c-primary)",
          color: uploading ? "var(--c-text-muted)" : "#fff",
          borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600,
          cursor: uploading ? "not-allowed" : "pointer",
        }}>
          {uploading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
          新規アップロード
          <input type="file" multiple accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
        </label>
      }
    >
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { k: "今月のスキャン", v: thisMonth.length, unit: "件", sub: `全体 ${jobs.length}件` },
          { k: "平均信頼度",     v: avgConf != null ? avgConf : "—", unit: avgConf != null ? "%" : "", sub: "解析済みジョブ" },
          { k: "未レビュー",     v: reviewCount, unit: "件", sub: "確認待ち" },
          { k: "完了",           v: doneCount,   unit: "件", sub: "転記済み" },
        ].map(kpi => (
          <div key={kpi.k} style={{
            background: "var(--c-surface)", border: "1px solid var(--c-border)",
            borderRadius: "var(--r-lg)", padding: "12px 14px", boxShadow: "var(--sh-1)",
          }}>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 600 }}>{kpi.k}</div>
            <div style={{ fontFamily: "var(--ff-mono)", fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginTop: 4 }}>
              {kpi.v}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-muted)", marginLeft: 4 }}>{kpi.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* D&D drop zone */}
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          background: isDragging ? "var(--c-primary-50)" : "var(--c-surface)",
          border: `1.5px ${isDragging ? "solid" : "dashed"} ${isDragging ? "var(--c-primary)" : "var(--c-border-strong)"}`,
          borderRadius: "var(--r-lg)", padding: "28px 20px", textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "var(--c-primary-50)", color: "var(--c-primary)",
          display: "grid", placeItems: "center",
        }}>
          {uploading ? <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={24} strokeWidth={1.5} />}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            {uploading ? "アップロード中…" : isDragging ? "ここに離してください" : "業者見積をここにドロップ"}
          </p>
          <p style={{ margin: "4px 0 0", color: "var(--c-text-muted)", fontSize: 12 }}>
            PDF / 画像 / Excel を AI が読み取り、台帳・QCDS・見積書へ転記します
          </p>
          <p style={{ margin: "2px 0 0", color: "var(--c-text-muted)", fontSize: 11 }}>
            ※ 工事台帳ExcelのインポートはこちらではなくExcelインポートページをご利用ください
          </p>
        </div>
        <input type="file" multiple accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
      </label>

      {/* 紐付け先 — ProjectPickerCard */}
      <div className="mt-3">
        <ProjectPickerCard
          linkedProject={linkedProject}
          candidates={projects}
          onSelect={(p) => setLinkedProject(p)}
          onClear={() => setLinkedProject(null)}
          onLoadCandidates={() => { if (!projects.length) loadProjects(); }}
        />
      </div>

      <div style={{ height: 16 }} />

      {/* Job list card */}
      <div className="card" style={{ overflow: "hidden" }}>
        {/* card header + filter tabs */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>処理ジョブ</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "inline-flex", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: 2 }}>
            {([
              ["all",        "すべて",    jobs.length],
              ["processing", "処理中",    processingCount],
              ["review",     "未レビュー", reviewCount],
              ["done",       "完了",      doneCount],
              ...(isAdmin ? [["trash", "ゴミ箱", 0]] as [FilterTab, string, number][] : []),
            ] as [FilterTab, string, number][]).map(([tab, label, count]) => (
              <button key={tab} onClick={() => setFilterTab(tab)} style={{
                background: filterTab === tab ? "var(--c-surface)" : "none",
                border: filterTab === tab ? "1px solid var(--c-border)" : "1px solid transparent",
                borderRadius: "var(--r-sm)", padding: "3px 10px",
                fontSize: 12, fontWeight: filterTab === tab ? 600 : 400,
                color: tab === "trash" && filterTab === tab ? "var(--c-danger)" : "var(--c-text)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                {tab === "trash" && <Trash2 size={11} />}
                {label}
                {count > 0 && <span style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: tab === "review" && count > 0 ? "var(--c-warn)" : "var(--c-text-muted)" }}>{count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 一括操作バー */}
        {someSelected && filterTab !== "trash" && (
          <div className="px-4 pt-3">
            <BulkActionBar
              count={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              onDelete={handleBulkDelete}
              onBulkTransfer={handleBulkTransferFromBar}
            />
          </div>
        )}

        {/* table header */}
        <div
          className={`grid items-center gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 border-b border-neutral-200 ${
            filterTab === "trash"
              ? "grid-cols-[36px_36px_1fr_80px_130px_80px]"
              : "grid-cols-[28px_36px_1fr_90px_1fr_130px_80px_96px]"
          }`}
        >
          {filterTab !== "trash" ? (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 accent-brand"
            />
          ) : <div />}
          <div />
          <div>ファイル名 / 業者</div>
          <div>形式</div>
          {filterTab !== "trash" && <div>進捗</div>}
          <div>ステータス</div>
          {filterTab !== "trash" && <div className="text-right">信頼度</div>}
          <div className="text-right">操作</div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>読み込み中…</div>
        ) : filteredJobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
            <FileText style={{ width: 40, height: 40, margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              {filterTab === "trash" ? "ゴミ箱は空です" : filterTab === "all" ? "アップロードされたファイルがありません" : "該当するジョブがありません"}
            </p>
          </div>
        ) : filteredJobs.map(job => {
          const isSelected = selectedIds.has(job.id);

          if (filterTab === "trash") {
            return (
              <div key={job.id} className="grid grid-cols-[36px_36px_1fr_80px_130px_80px] items-center gap-3 px-4 py-2.5 border-b border-neutral-200 opacity-70">
                <div />
                <div className="grid h-7 w-7 place-items-center rounded-sm border border-stamp/30 bg-stamp/10 text-stamp">
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-800">{job.original_file_name}</div>
                  <div className="font-mono text-[11px] text-neutral-400">
                    {job.vendor_name_detected ?? "—"} · 削除:{" "}
                    {job.deleted_at ? new Date(job.deleted_at).toLocaleDateString("ja-JP") : "—"}
                  </div>
                </div>
                <div className="text-xs uppercase text-neutral-400">{job.file_type}</div>
                <div>
                  <span className="rounded-full bg-stamp/15 px-2 py-0.5 text-[11px] font-semibold text-stamp">削除済み</span>
                </div>
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => handleRestore(job.id)} className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] hover:bg-neutral-50">復元</button>
                  <button onClick={() => handlePurge(job.id)} className="rounded-md border border-stamp/30 bg-stamp/10 px-2 py-1 text-[11px] text-stamp hover:bg-stamp/20">完全削除</button>
                </div>
              </div>
            );
          }

          return (
            <JobRow
              key={job.id}
              job={job}
              selected={isSelected}
              onToggle={toggleSelect}
              onDelete={handleSingleDelete}
            />
          );
        })}
      </div>

      <div className="mt-2 text-right text-[11px] text-neutral-400">
        解析結果は必ず人がレビューしてから台帳に反映されます · 自動転記はされません
      </div>

      {/* 一括転記モーダル */}
      {showBulkModal && (
        <BulkTransferModal
          count={selectedIds.size}
          onClose={() => setShowBulkModal(false)}
          onTransfer={handleBulkTransfer}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </AppShell>
  );
}
