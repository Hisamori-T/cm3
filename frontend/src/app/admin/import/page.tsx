"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

type Conflict = "none" | "number_exists" | "name_exists" | "deleted_exists";
type DeletedAction = "new" | "restore";

interface PreviewRow {
  row_index: number;
  project_name: string;
  project_number: string | null;
  client_name: string | null;
  project_price: number | null;
  period_contract_start: string | null;
  period_contract_end: string | null;
  conflict: Conflict;
  existing_id: string | null;
  deleted_existing_id: string | null;
  qcds_direct_work_count: number;
  quote_section_count: number;
  quote_item_count: number;
  has_order: boolean;
  has_invoice: boolean;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const CONFLICT_BADGE: Record<Conflict, { label: string; style: React.CSSProperties }> = {
  none: {
    label: "新規",
    style: { background: "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))", color: "var(--c-success)" },
  },
  number_exists: {
    label: "工事番号重複",
    style: { background: "color-mix(in oklab, var(--c-warn) 14%, var(--c-surface))", color: "var(--c-warn)" },
  },
  name_exists: {
    label: "工事名重複",
    style: { background: "color-mix(in oklab, var(--c-warn) 20%, var(--c-surface))", color: "var(--c-warn)" },
  },
  deleted_exists: {
    label: "削除済み案件あり",
    style: { background: "color-mix(in oklab, var(--c-danger) 12%, var(--c-surface))", color: "var(--c-danger)" },
  },
};

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return `¥${v.toLocaleString()}`;
}

/** Excel工事台帳インポート画面。2ステップ（プレビュー→確認）。 */
export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<PreviewRow[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [overwriteMap, setOverwriteMap] = useState<Record<number, boolean>>({});
  const [deletedActionMap, setDeletedActionMap] = useState<Record<number, DeletedAction>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".xlsx")) setFile(f);
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/api/v1/excel/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { detail?: string }).detail || "解析失敗");
      }
      const sid = res.headers.get("X-Import-Session");
      const data: PreviewRow[] = await res.json();
      setSessionId(sid);
      setPreviews(data);
      const init: Record<number, boolean> = {};
      const deletedInit: Record<number, DeletedAction> = {};
      data.forEach((r) => {
        init[r.row_index] = r.conflict !== "none" && r.conflict !== "deleted_exists";
        if (r.conflict === "deleted_exists") deletedInit[r.row_index] = "new";
      });
      setOverwriteMap(init);
      setDeletedActionMap(deletedInit);
      setSelectedRows(new Set(data.map((r) => r.row_index)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "プレビュー取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!previews || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = previews
        .filter((p) => selectedRows.has(p.row_index))
        .map((p) => ({
          row_index: p.row_index,
          overwrite: overwriteMap[p.row_index] ?? false,
          deleted_action: p.conflict === "deleted_exists"
            ? (deletedActionMap[p.row_index] ?? "new")
            : "new",
        }));
      const res = await fetch(`${API_URL}/api/v1/excel/import?session_id=${sessionId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { detail?: string }).detail || "インポート失敗");
      }
      const data: ImportResult = await res.json();
      setResult(data);
      setPreviews(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "インポートに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(idx: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!previews) return;
    setSelectedRows(checked ? new Set(previews.map((p) => p.row_index)) : new Set());
  }

  function reset() {
    setFile(null); setPreviews(null); setSessionId(null);
    setOverwriteMap({}); setDeletedActionMap({}); setSelectedRows(new Set()); setResult(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <AppShell breadcrumbs={[{ label: "Excelインポート" }]}>
      <div className="toolbar">
        <h1>Excel工事台帳インポート</h1>
      </div>

      {/* 完了画面 */}
      {result && (
        <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", marginBottom: 16 }}>インポート完了</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 16 }}>
            <div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--c-success)" }}>{result.created}</div>
              <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>新規作成</div>
            </div>
            <div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--c-primary)" }}>{result.updated}</div>
              <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>更新</div>
            </div>
            <div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--c-text-muted)" }}>{result.skipped}</div>
              <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>スキップ</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div style={{
              background: "var(--c-danger-bg)",
              border: "1px solid color-mix(in oklab, var(--c-danger) 30%, var(--c-border))",
              borderRadius: "var(--r-md)", padding: "10px 12px", textAlign: "left", marginBottom: 16,
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-danger)", marginBottom: 4 }}>
                エラー ({result.errors.length}件)
              </p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {result.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 12, color: "var(--c-danger)" }}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Button onClick={reset}>続けてインポート</Button>
            <Link href="/projects"><Button variant="ghost">工事台帳一覧へ</Button></Link>
          </div>
        </div>
      )}

      {/* ステップ1: ファイル選択 */}
      {!result && !previews && (
        <div className="card" style={{ padding: "20px 24px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 6 }}>
            ステップ 1 — Excelファイルを選択
          </h2>
          <p style={{ fontSize: 12, color: "var(--c-text-muted)", marginBottom: 16 }}>
            既存の工事台帳Excel（.xlsx）をアップロードします。工事台帳シートが1案件として読み込まれます。<br />
            同一ブック内の <strong>QCDS</strong>・<strong>表紙</strong>・<strong>内訳書</strong>・<strong>注文書・請書</strong>・<strong>請求書</strong> シートも自動取込されます。<br />
            「記入例」シートおよびQCDS等の帳票シートは案件としては除外されます。
          </p>
          <div
            style={{
              border: `2px dashed ${isDragging ? "var(--c-primary)" : file ? "var(--c-success)" : "var(--c-border)"}`,
              borderRadius: "var(--r-md)", padding: "40px 20px", textAlign: "center", cursor: "pointer",
              background: isDragging ? "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))" : "var(--c-surface)",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileSpreadsheet style={{ width: 40, height: 40, margin: "0 auto 12px", display: "block", color: isDragging ? "var(--c-primary)" : "var(--c-text-muted)" }} />
            {file ? (
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-success)" }}>{file.name}</p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--c-text-muted)" }}>ここにファイルをドロップ</p>
                <p style={{ fontSize: 12, color: "var(--c-text-muted)", marginTop: 2 }}>またはクリックして選択</p>
              </>
            )}
            <p style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 4 }}>.xlsx 形式、最大20MB</p>
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={handleFileSelect} />
          </div>
          {error && (
            <p style={{ fontSize: 13, color: "var(--c-danger)", marginTop: 8 }}>{error}</p>
          )}
          <Button onClick={handlePreview} disabled={!file || loading} style={{ marginTop: 16, width: "100%" }}>
            <Upload className="w-4 h-4" style={{ marginRight: 8 }} />
            {loading ? "解析中..." : "プレビューを取得"}
          </Button>
        </div>
      )}

      {/* ステップ2: プレビュー確認 */}
      {!result && previews && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: "16px 20px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 4 }}>
              ステップ 2 — 内容確認・インポート実行
            </h2>
            <p style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
              {previews.length}件の案件データが見つかりました。重複がある場合は「上書き」か「スキップ」を選択してください。
            </p>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={previews.length > 0 && selectedRows.size === previews.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                      title="全選択 / 全解除"
                    />
                  </th>
                  <th>工事番号</th>
                  <th>工事名</th>
                  <th>発注者</th>
                  <th className="num">工事価格</th>
                  <th style={{ textAlign: "center" }}>取込内容</th>
                  <th style={{ textAlign: "center" }}>状態</th>
                  <th style={{ textAlign: "center" }}>処理</th>
                </tr>
              </thead>
              <tbody>
                {previews.map((row) => {
                  const badge = CONFLICT_BADGE[row.conflict];
                  const isConflict = row.conflict !== "none";
                  const isSelected = selectedRows.has(row.row_index);
                  return (
                    <tr key={row.row_index} style={{ opacity: isSelected ? 1 : 0.4 }}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.row_index)}
                        />
                      </td>
                      <td className="num" style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                        {row.project_number || "—"}
                      </td>
                      <td style={{ fontWeight: 500 }}>{row.project_name}</td>
                      <td style={{ color: "var(--c-text-muted)" }}>{row.client_name || "—"}</td>
                      <td className="num" style={{ color: "var(--c-text-muted)" }}>{fmtPrice(row.project_price)}</td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
                          {row.qcds_direct_work_count > 0 && (
                            <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "color-mix(in oklab, var(--c-primary) 10%, var(--c-surface))", color: "var(--c-primary)", fontWeight: 600 }}>
                              QCDS×{row.qcds_direct_work_count}
                            </span>
                          )}
                          {row.quote_section_count > 0 && (
                            <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "color-mix(in oklab, var(--c-success) 10%, var(--c-surface))", color: "var(--c-success)", fontWeight: 600 }}>
                              見積{row.quote_section_count}項×{row.quote_item_count}行
                            </span>
                          )}
                          {row.has_order && (
                            <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "color-mix(in oklab, #f59e0b 10%, var(--c-surface))", color: "#b45309", fontWeight: 600 }}>
                              注文書
                            </span>
                          )}
                          {row.has_invoice && (
                            <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "color-mix(in oklab, var(--c-danger) 10%, var(--c-surface))", color: "var(--c-danger)", fontWeight: 600 }}>
                              請求書
                            </span>
                          )}
                          {row.qcds_direct_work_count === 0 && row.quote_section_count === 0 && !row.has_order && !row.has_invoice && (
                            <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>案件のみ</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "2px 8px", borderRadius: "var(--r-pill)",
                          fontSize: 11, fontWeight: 600,
                          ...badge.style,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {row.conflict === "deleted_exists" ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                              <input
                                type="radio"
                                name={`action-${row.row_index}`}
                                checked={(deletedActionMap[row.row_index] ?? "new") === "new"}
                                onChange={() => setDeletedActionMap((m) => ({ ...m, [row.row_index]: "new" }))}
                              />
                              新規作成
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                              <input
                                type="radio"
                                name={`action-${row.row_index}`}
                                checked={(deletedActionMap[row.row_index] ?? "new") === "restore"}
                                onChange={() => setDeletedActionMap((m) => ({ ...m, [row.row_index]: "restore" }))}
                              />
                              復元
                            </label>
                          </div>
                        ) : isConflict ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                              <input
                                type="radio"
                                name={`action-${row.row_index}`}
                                checked={overwriteMap[row.row_index] === true}
                                onChange={() => setOverwriteMap((m) => ({ ...m, [row.row_index]: true }))}
                              />
                              上書き
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                              <input
                                type="radio"
                                name={`action-${row.row_index}`}
                                checked={overwriteMap[row.row_index] === false}
                                onChange={() => setOverwriteMap((m) => ({ ...m, [row.row_index]: false }))}
                              />
                              スキップ
                            </label>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>新規作成</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "var(--c-danger)" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
            {!loading && selectedRows.size === 0 && (
              <span style={{ fontSize: 12, color: "var(--c-danger)" }}>1件以上選択してください</span>
            )}
            <Button variant="ghost" onClick={reset} disabled={loading}>キャンセル</Button>
            <Button onClick={handleImport} disabled={loading || selectedRows.size === 0}>
              {loading ? "インポート中..." : `選択した${selectedRows.size}件をインポート`}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
