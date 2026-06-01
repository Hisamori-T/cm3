"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, FileText, ImageIcon, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

type LogType = "text" | "photo" | "drawing";

interface Attachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface ProgressLog {
  id: string;
  project_id: string;
  logged_at: string;
  logged_by_name: string;
  log_type: LogType;
  title: string | null;
  body: string | null;
  status_changed_to: string | null;
  attachments: Attachment[];
}

interface ListResponse {
  items: ProgressLog[];
  total: number;
}

const TYPE_ICON: Record<LogType, React.ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  photo: <Camera className="w-4 h-4" />,
  drawing: <ImageIcon className="w-4 h-4" />,
};

const TYPE_LABEL: Record<LogType, string> = {
  text: "テキスト",
  photo: "写真",
  drawing: "図面",
};

function fmtDateTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

/** 認証付きで画像を取得して表示するコンポーネント */
function AuthImage({ attachmentId, fileName, style }: {
  attachmentId: string;
  fileName: string;
  style?: React.CSSProperties;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    fetch(`${API_URL}/api/v1/progress/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [attachmentId]);

  if (!blobUrl) {
    return (
      <div style={{
        width: "100%", height: 80,
        background: "var(--c-surface-2)",
        borderRadius: "var(--r-md)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--c-text-muted)", fontSize: 11,
      }}>
        読込中...
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt={fileName}
      style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: "var(--r-md)", border: "1px solid var(--c-border)", ...style }}
    />
  );
}

/** 進捗ログ画面。タイムライン表示・写真/図面アップロード対応。 */
export default function ProgressPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [logType, setLogType] = useState<LogType>("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  // 写真メタデータ
  const [photoType, setPhotoType] = useState("");
  const [locationInSite, setLocationInSite] = useState("");
  const [workType, setWorkType] = useState("");
  const [caption, setCaption] = useState("");

  // 種別ごとの hidden file input refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/progress`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("読み込み失敗");
      const data: ListResponse = await res.json();
      setLogs(data.items);
    } catch {
      setError("進捗ログの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setLogType("text"); setTitle(""); setBody(""); setFiles([]);
    setPhotoType(""); setLocationInSite(""); setWorkType(""); setCaption("");
    setShowForm(false);
  }

  // 種別ボタン押下→写真・図面は即ファイル選択、テキストはフォームを開く
  function handleTypeButton(type: LogType) {
    if (type === "photo") {
      setLogType("photo");
      setShowForm(true);
      setTimeout(() => photoInputRef.current?.click(), 50);
    } else if (type === "drawing") {
      setLogType("drawing");
      setShowForm(true);
      setTimeout(() => drawingInputRef.current?.click(), 50);
    } else {
      setLogType("text");
      setShowForm(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("log_type", logType);
      if (title) fd.append("title", title);
      if (body) fd.append("body", body);
      if (photoType) fd.append("photo_type", photoType);
      if (locationInSite) fd.append("location_in_site", locationInSite);
      if (workType) fd.append("work_type", workType);
      if (caption) fd.append("caption", caption);
      for (const f of files) fd.append("files", f);

      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/progress`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { detail?: string }).detail || "保存失敗");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(logId: string) {
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/progress/${logId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("削除失敗");
      setDeleteId(null);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch {
      setError("削除に失敗しました");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  }

  function attachmentDownloadUrl(id: string) {
    return `${API_URL}/api/v1/progress/attachments/${id}`;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "7px 10px", fontSize: 13,
    border: "1px solid var(--c-border)",
    borderRadius: "var(--r-md)",
    background: "var(--c-surface)", color: "var(--c-text)",
    outline: "none",
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "進捗ログ" },
      ]}
    >
      <div className="toolbar">
        <h1>進捗・施工記録</h1>
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--r-md)", fontSize: 13,
          background: "var(--c-danger-bg)",
          border: "1px solid color-mix(in oklab, var(--c-danger) 30%, var(--c-border))",
          color: "var(--c-danger)",
        }}>
          {error}
        </div>
      )}

      {/* ── 記録追加ボタン（インライン配置）── */}
      {!showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["text", "photo", "drawing"] as LogType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeButton(t)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px",
                borderRadius: "var(--r-md)",
                border: "1.5px solid var(--c-border)",
                background: "var(--c-surface)",
                color: "var(--c-text-muted)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--c-primary)";
                e.currentTarget.style.color = "var(--c-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--c-border)";
                e.currentTarget.style.color = "var(--c-text-muted)";
              }}
            >
              {TYPE_ICON[t]}
              {TYPE_LABEL[t]}を追加
            </button>
          ))}
        </div>
      )}

      {/* hidden file inputs（即ファイル選択用） */}
      <input ref={photoInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
      <input ref={drawingInputRef} type="file" multiple accept="image/*,.pdf" style={{ display: "none" }} onChange={handleFileChange} />

      {/* 入力フォーム */}
      {showForm && (
        <div className="card" style={{ padding: "20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {TYPE_ICON[logType]}
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
                {TYPE_LABEL[logType]}を追加
              </h3>
            </div>
            <button
              onClick={resetForm}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2 }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* タイトル */}
            <input
              type="text"
              placeholder="タイトル（任意）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />

            {/* 本文 */}
            <textarea
              placeholder={logType === "text" ? "施工内容・特記事項など" : "コメント（任意）"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />

            {/* 写真メタデータ（写真・図面のみ表示） */}
            {(logType === "photo" || logType === "drawing") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>撮影区分</label>
                  <select
                    value={photoType}
                    onChange={(e) => setPhotoType(e.target.value)}
                    style={{ ...inputStyle, height: 34 }}
                  >
                    <option value="">— 未選択 —</option>
                    <option value="before">施工前</option>
                    <option value="during">施工中</option>
                    <option value="after">施工後</option>
                    <option value="issue">問題箇所</option>
                    <option value="drawing">図面</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>撮影場所</label>
                  <input
                    type="text"
                    placeholder="例：1階 玄関"
                    value={locationInSite}
                    onChange={(e) => setLocationInSite(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>工種</label>
                  <input
                    type="text"
                    placeholder="例：内装解体"
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>キャプション</label>
                  <input
                    type="text"
                    placeholder="写真の説明"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {/* ファイル添付（写真・図面） */}
            {(logType === "photo" || logType === "drawing") && (
              <div>
                <button
                  type="button"
                  onClick={() => (logType === "photo" ? photoInputRef : drawingInputRef).current?.click()}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: "8px",
                    border: "1.5px dashed var(--c-border)",
                    borderRadius: "var(--r-md)",
                    background: "none", color: "var(--c-text-muted)",
                    fontSize: 13, cursor: "pointer",
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {logType === "photo" ? "写真を追加" : "図面・ファイルを追加"}
                </button>
                {files.length > 0 && (
                  <ul style={{ marginTop: 8, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {files.map((f, i) => (
                      <li key={i} style={{ fontSize: 12, color: "var(--c-text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <ImageIcon className="w-3 h-3" />
                          {f.name} ({fmtSize(f.size)})
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 1 }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>キャンセル</Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "保存中..." : "保存"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* タイムライン */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
          読み込み中...
        </div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--c-text-muted)" }}>進捗記録がありません</p>
          <p style={{ fontSize: 12, color: "var(--c-text-muted)", marginTop: 4 }}>
            上のボタンから施工状況を記録してください
          </p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 2, background: "var(--c-border)" }} />
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            {logs.map((log) => (
              <li key={log.id} style={{ position: "relative", paddingLeft: 56 }}>
                <div style={{
                  position: "absolute", left: 10, top: 12,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "var(--c-surface)", border: `2px solid var(--c-primary)`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-primary)",
                }}>
                  {TYPE_ICON[log.log_type]}
                </div>

                <div className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: "var(--r-pill)",
                        background: "var(--c-surface-2)", color: "var(--c-text-muted)",
                      }}>
                        {TYPE_LABEL[log.log_type]}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                        {fmtDateTime(log.logged_at)} · {log.logged_by_name}
                      </span>
                    </div>
                    <button
                      onClick={() => setDeleteId(log.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2, flexShrink: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-muted)")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {log.title && (
                    <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
                      {log.title}
                    </p>
                  )}
                  {log.body && (
                    <p style={{ marginTop: 4, fontSize: 13, color: "var(--c-text)", whiteSpace: "pre-wrap" }}>
                      {log.body}
                    </p>
                  )}

                  {/* 添付ファイル（認証付きblob表示） */}
                  {log.attachments.length > 0 && (
                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {log.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={attachmentDownloadUrl(att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "block", textDecoration: "none" }}
                        >
                          {isImage(att.mime_type) ? (
                            <AuthImage attachmentId={att.id} fileName={att.file_name} />
                          ) : (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "6px 10px",
                              background: "var(--c-surface-2)",
                              borderRadius: "var(--r-md)",
                              border: "1px solid var(--c-border)",
                              fontSize: 12, color: "var(--c-text-muted)",
                            }}>
                              <FileText className="w-4 h-4 shrink-0" />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {att.file_name}
                              </span>
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: "24px", width: 320 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 8 }}>記録を削除しますか？</h3>
            <p style={{ fontSize: 12, color: "var(--c-text-muted)", marginBottom: 16 }}>
              添付ファイルも含めて削除されます。この操作は取り消せません。
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>キャンセル</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteId)}>削除</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
