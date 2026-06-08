"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

type PhotoType = "before" | "during" | "after" | "issue" | "drawing" | null;

const PHOTO_TYPE_LABEL: Record<string, string> = {
  before: "施工前", during: "施工中", after: "施工後", issue: "問題", drawing: "図面",
};

const TYPE_COLOR: Record<string, { bg: string; fg: string }> = {
  before:  { bg: "#fee2e2", fg: "#dc2626" },
  during:  { bg: "#e0e7ff", fg: "#4338ca" },
  after:   { bg: "#dcfce7", fg: "#16a34a" },
  issue:   { bg: "#fff7ed", fg: "#c2410c" },
  drawing: { bg: "#f0fdf4", fg: "#166534" },
};

interface Attachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  photo_type: PhotoType;
  work_type: string | null;
  location_in_site: string | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
}

interface ProgressLog {
  id: string;
  logged_at: string;
  logged_by_name: string;
  attachments: Attachment[];
}

interface ListResponse { items: ProgressLog[]; total: number; }

// ── Auth付き画像 ──────────────────────────────────────────────

function useAuthBlob(attachmentId: string) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    fetch(`${API_URL}/api/v1/progress/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.blob())
      .then((blob) => { url = URL.createObjectURL(blob); setBlobUrl(url); })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [attachmentId]);
  return blobUrl;
}

function AuthImage({ attachmentId, fileName, style }: {
  attachmentId: string; fileName: string; style?: React.CSSProperties;
}) {
  const blobUrl = useAuthBlob(attachmentId);
  if (!blobUrl) return (
    <div style={{ width: "100%", height: "100%", background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-muted)", fontSize: 11 }}>
      読込中...
    </div>
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={blobUrl} alt={fileName} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />;
}

// ── ライトボックス ────────────────────────────────────────────

function Lightbox({ photos, index, onClose, onPrev, onNext }: {
  photos: Attachment[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const att = photos[index];
  const blobUrl = useAuthBlob(att.id);
  // 隣接画像をプリフェッチ
  useAuthBlob(photos[Math.max(0, index - 1)].id);
  useAuthBlob(photos[Math.min(photos.length - 1, index + 1)].id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")  onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  // スクロールロック
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const typeColor = att.photo_type ? TYPE_COLOR[att.photo_type] : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* メインコンテンツ */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          maxWidth: "min(92vw, 1080px)", maxHeight: "94vh",
          gap: 12,
        }}
      >
        {/* 画像エリア */}
        <div style={{ position: "relative", width: "100%", flex: 1, minHeight: 0 }}>
          {blobUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt={att.file_name}
              style={{ maxWidth: "min(92vw, 1080px)", maxHeight: "80vh", objectFit: "contain", display: "block", borderRadius: 6 }}
            />
          ) : (
            <div style={{ width: "min(80vw, 800px)", height: "60vh", background: "rgba(255,255,255,0.06)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 14 }}>
              読込中...
            </div>
          )}

          {/* 前へ */}
          {index > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              style={{
                position: "absolute", left: -52, top: "50%", transform: "translateY(-50%)",
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(255,255,255,0.15)", border: "none",
                color: "#fff", fontSize: 20, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >‹</button>
          )}

          {/* 次へ */}
          {index < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              style={{
                position: "absolute", right: -52, top: "50%", transform: "translateY(-50%)",
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(255,255,255,0.15)", border: "none",
                color: "#fff", fontSize: 20, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >›</button>
          )}
        </div>

        {/* 写真情報バー */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {att.photo_type && typeColor && (
            <span style={{ padding: "2px 8px", borderRadius: 4, background: typeColor.bg, color: typeColor.fg, fontSize: 12, fontWeight: 600 }}>
              {PHOTO_TYPE_LABEL[att.photo_type]}
            </span>
          )}
          {att.work_type && (
            <span style={{ color: "#bbb", fontSize: 12 }}>{att.work_type}</span>
          )}
          {att.taken_at && (
            <span style={{ color: "#999", fontSize: 12, fontFamily: "monospace" }}>{att.taken_at.slice(0, 10)}</span>
          )}
          {att.caption && (
            <span style={{ color: "#ddd", fontSize: 13 }}>{att.caption}</span>
          )}
          {att.location_in_site && (
            <span style={{ color: "#aaa", fontSize: 12 }}>📍 {att.location_in_site}</span>
          )}
          <span style={{ color: "#666", fontSize: 11, marginLeft: 8 }}>{index + 1} / {photos.length}</span>
        </div>
      </div>

      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        style={{
          position: "fixed", top: 16, right: 20,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,0.15)", border: "none",
          color: "#fff", fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1001,
        }}
      >×</button>

      {/* キーボードヒント */}
      <div style={{ position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)", color: "#555", fontSize: 11 }}>
        ← → で移動 ／ Esc で閉じる
      </div>
    </div>
  );
}

// ── 写真カード ────────────────────────────────────────────────

function PhotoCard({ att, onOpen, onDelete }: {
  att: Attachment;
  onOpen: () => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const isImg = att.mime_type?.startsWith("image/") ?? false;

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("この写真/図面を削除しますか？")) return;
    setDeleting(true);
    try {
      await fetch(`${API_URL}/api/v1/progress/attachments/${att.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      onDelete(att.id);
    } catch { /* ignore */ } finally { setDeleting(false); }
  }

  async function handleFileOpen(e: React.MouseEvent) {
    if (isImg) { onOpen(); return; }
    e.stopPropagation();
    try {
      const r = await fetch(`${API_URL}/api/v1/progress/attachments/${att.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const isPdf = att.mime_type === "application/pdf";
      if (isPdf) { window.open(url, "_blank"); }
      else {
        const a = document.createElement("a");
        a.href = url; a.download = att.file_name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch { alert("ファイルの取得に失敗しました"); }
  }

  const typeColor = att.photo_type ? TYPE_COLOR[att.photo_type] : null;

  return (
    <div
      onClick={handleFileOpen}
      style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)", overflow: "hidden", position: "relative", cursor: "pointer" }}
    >
      <div style={{ aspectRatio: "4/3", overflow: "hidden", background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isImg ? (
          <AuthImage attachmentId={att.id} fileName={att.file_name} />
        ) : (
          <div style={{ textAlign: "center", color: "var(--c-text-muted)", padding: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div style={{ fontSize: 10, marginTop: 4, wordBreak: "break-all" }}>{att.file_name}</div>
          </div>
        )}
      </div>

      {/* 削除ボタン */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{
          position: "absolute", top: 4, right: 4,
          width: 22, height: 22, borderRadius: "50%",
          background: "rgba(0,0,0,0.55)", color: "#fff",
          border: "none", cursor: "pointer", fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}
        title="削除"
      >×</button>

      <div style={{ padding: "4px 8px", fontSize: 11 }}>
        {att.photo_type && typeColor && (
          <span style={{ padding: "1px 5px", borderRadius: 3, marginRight: 4, fontSize: 10, background: typeColor.bg, color: typeColor.fg }}>
            {PHOTO_TYPE_LABEL[att.photo_type]}
          </span>
        )}
        {att.caption && <span style={{ color: "var(--c-text-muted)" }}>{att.caption}</span>}
        {att.taken_at && <div style={{ color: "var(--c-text-muted)", fontSize: 10 }}>{att.taken_at.slice(0, 10)}</div>}
      </div>
    </div>
  );
}

// ── グルーピング ──────────────────────────────────────────────

function groupByWorkType(logs: ProgressLog[]): Map<string, Attachment[]> {
  const groups = new Map<string, Attachment[]>();
  for (const log of logs) {
    for (const att of log.attachments) {
      if (!att.mime_type?.startsWith("image/")) continue;
      const key = att.work_type || "その他";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(att);
    }
  }
  return groups;
}

// ── メイン ────────────────────────────────────────────────────

export default function PhotoAlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "compare">("grid");
  const [compareLocation, setCompareLocation] = useState<string>("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ListResponse>(`/api/v1/projects/${id}/progress?limit=200`);
      setLogs(data.items.filter((l) => l.attachments.some((a) =>
        a.mime_type?.startsWith("image/") ||
        a.mime_type === "application/pdf" ||
        a.photo_type === "drawing" ||
        /\.(jww|dxf|dwg)$/i.test(a.file_name)
      )));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // 画像 + 図面（PDF/CAD含む）を全て含める
  const allAttachments: Attachment[] = logs.flatMap((l) =>
    l.attachments.filter((a) =>
      a.mime_type?.startsWith("image/") ||
      a.mime_type === "application/pdf" ||
      a.photo_type === "drawing" ||
      /\.(jww|dxf|dwg)$/i.test(a.file_name)
    )
  );
  const filtered = filterType ? allAttachments.filter((a) => a.photo_type === filterType) : allAttachments;
  const groups = groupByWorkType(logs);

  // ライトボックスで表示する写真リスト（グリッドで見えているものと一致させる）
  const lightboxPhotos = filterType ? filtered : allAttachments;

  // 撮影場所ごとに全photo_typeをまとめる
  type LocationGroup = Record<string, Attachment[]>; // photo_type -> photos
  const locationGroups = new Map<string, LocationGroup>();
  allAttachments.forEach((a) => {
    if (!a.location_in_site) return;
    if (!locationGroups.has(a.location_in_site)) locationGroups.set(a.location_in_site, {});
    const group = locationGroups.get(a.location_in_site)!;
    const key = a.photo_type ?? "other";
    if (!group[key]) group[key] = [];
    group[key].push(a);
  });

  function handleDelete(attId: string) {
    if (lightboxIndex !== null) setLightboxIndex(null);
    setLogs((prev) =>
      prev.map((log) => ({
        ...log,
        attachments: log.attachments.filter((a) => a.id !== attId && (
          a.mime_type?.startsWith("image/") ||
          a.mime_type === "application/pdf" ||
          a.photo_type === "drawing" ||
          /\.(jww|dxf|dwg)$/i.test(a.file_name)
        )),
      })).filter((log) => log.attachments.some((a) => a.mime_type?.startsWith("image/")))
    );
  }

  function openLightbox(att: Attachment) {
    const idx = lightboxPhotos.findIndex((a) => a.id === att.id);
    setLightboxIndex(idx >= 0 ? idx : null);
  }

  async function handlePdfExport() {
    setPdfLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/v1/projects/${id}/photo-album/export-pdf`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) { alert("PDF生成に失敗しました"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `写真台帳.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert("PDF生成中にエラーが発生しました"); } finally { setPdfLoading(false); }
  }

  return (
    <AppShell breadcrumbs={[{ label: "案件", href: `/projects/${id}` }, { label: "写真台帳" }]}>
      <div style={{ padding: "var(--sp-4)" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)", flexWrap: "wrap", gap: "var(--sp-2)" }}>
          <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)" }}>写真台帳</h2>
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap" }}>
            {allAttachments.length > 0 && (
              <button
                onClick={handlePdfExport}
                disabled={pdfLoading}
                style={{ padding: "6px 14px", borderRadius: "var(--r-md)", border: "none", background: pdfLoading ? "var(--c-text-muted)" : "#dc2626", color: "#fff", cursor: pdfLoading ? "default" : "pointer", fontSize: "var(--fs-sm)", fontWeight: 600 }}
              >
                {pdfLoading ? "生成中..." : "PDF出力"}
              </button>
            )}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: "6px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", background: "var(--c-surface)", color: "var(--c-text)" }}
            >
              <option value="">すべて</option>
              {Object.entries(PHOTO_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div style={{ display: "flex", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
              {(["grid", "compare"] as const).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: "6px 12px", background: viewMode === mode ? "var(--c-primary)" : "var(--c-surface)", color: viewMode === mode ? "#fff" : "var(--c-text)", border: "none", cursor: "pointer", fontSize: "var(--fs-sm)" }}>
                  {mode === "grid" ? "一覧" : "施工前後対比"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--c-text-muted)" }}>読み込み中…</p>
        ) : viewMode === "grid" ? (
          <div>
            {filterType ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--sp-2)" }}>
                {filtered.map((att) => <PhotoCard key={att.id} att={att} onOpen={() => openLightbox(att)} onDelete={handleDelete} />)}
              </div>
            ) : (
              Array.from(groups.entries()).map(([wt, atts]) => (
                <div key={wt} style={{ marginBottom: "var(--sp-4)" }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: "var(--sp-2)", display: "flex", gap: 8, alignItems: "center" }}>
                    <span>▼ {wt}</span>
                    <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 400 }}>{atts.length}枚</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--sp-2)" }}>
                    {atts.map((att) => <PhotoCard key={att.id} att={att} onOpen={() => openLightbox(att)} onDelete={handleDelete} />)}
                  </div>
                </div>
              ))
            )}
            {allAttachments.length === 0 && (
              <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--c-text-muted)", border: "2px dashed var(--c-border)", borderRadius: "var(--r-lg)" }}>
                写真がまだアップロードされていません。「施工進捗」から写真を追加してください。
              </div>
            )}
          </div>
        ) : (
          /* 施工前後対比 */
          <div>
            <div style={{ marginBottom: "var(--sp-3)" }}>
              <select value={compareLocation} onChange={(e) => setCompareLocation(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", background: "var(--c-surface)", color: "var(--c-text)" }}>
                <option value="">撮影場所を選択</option>
                {Array.from(locationGroups.keys()).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            {locationGroups.size === 0 ? (
              <p style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-sm)" }}>
                撮影場所タグが設定された写真がありません。「施工進捗」から写真をアップロードする際に「撮影場所」を入力してください。
              </p>
            ) : compareLocation ? (() => {
              const group = locationGroups.get(compareLocation) ?? {};
              // 表示順：施工前→施工中→施工後→問題箇所→その他
              const phaseOrder = ["before", "during", "after", "issue", "drawing", "other"];
              const phaseLabel: Record<string, string> = {
                before: "施工前", during: "施工中", after: "施工後",
                issue: "問題箇所", drawing: "図面", other: "その他",
              };
              const phaseColor: Record<string, string> = {
                before: "#dc2626", during: "#2563eb", after: "#16a34a",
                issue: "#c2410c", drawing: "#166534", other: "#6b7280",
              };
              const activePhases = phaseOrder.filter((p) => (group[p]?.length ?? 0) > 0);
              if (activePhases.length === 0) return (
                <p style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-sm)" }}>この場所に写真がありません。</p>
              );
              const cols = Math.min(activePhases.length, 3);
              return (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "var(--sp-3)" }}>
                  {activePhases.map((phase) => (
                    <div key={phase}>
                      <div style={{ fontWeight: 700, marginBottom: "var(--sp-2)", color: phaseColor[phase], fontSize: 13 }}>
                        {phaseLabel[phase]}
                        <span style={{ fontWeight: 400, color: "var(--c-text-muted)", fontSize: 11, marginLeft: 6 }}>
                          {group[phase]?.length ?? 0}枚
                        </span>
                      </div>
                      {(group[phase] ?? []).map((att) => (
                        <div key={att.id} onClick={() => openLightbox(att)} style={{ marginBottom: "var(--sp-2)", borderRadius: "var(--r-lg)", overflow: "hidden", border: "1px solid var(--c-border)", aspectRatio: "4/3", cursor: "pointer" }}>
                          <AuthImage attachmentId={att.id} fileName={att.file_name} />
                          {att.caption && (
                            <div style={{ padding: "2px 6px", fontSize: 11, color: "var(--c-text-muted)", background: "var(--c-surface)" }}>
                              {att.caption}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })() : (
              <p style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-sm)" }}>撮影場所を選択してください。</p>
            )}
          </div>
        )}
      </div>

      {/* ライトボックス */}
      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <Lightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 1) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(lightboxPhotos.length - 1, (i ?? 0) + 1))}
        />
      )}
    </AppShell>
  );
}
