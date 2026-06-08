"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface FieldDiff {
  before?: unknown;
  after?: unknown;
  old?: unknown;   // 旧キー（後方互換）
  new?: unknown;   // 旧キー（後方互換）
}
interface EditHistoryItem {
  id: string;
  entity_type: string;
  change_type: string;
  field_changes: Record<string, FieldDiff> | null;
  changed_by_name: string;
  changed_at: string;
}

interface EditHistoryResponse {
  items: EditHistoryItem[];
  total: number;
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  project: "案件", qcds: "QCDS", quote: "見積書",
  order: "注文書", invoice: "請求書", progress: "進捗",
};

const CHANGE_TYPE_LABEL: Record<string, string> = {
  create: "作成", update: "更新", status_change: "ステータス変更", delete: "削除",
};

// ステータス値の日本語変換
const STATUS_LABEL: Record<string, string> = {
  quote: "見積中", ordered: "受注", started: "着工", in_progress: "施工中",
  completed: "完工", invoiced: "請求済", paid: "入金済",
  draft: "下書き", issued: "発行済", sent: "送付済",
};

const FIELD_LABEL: Record<string, string> = {
  status: "ステータス", project_name: "工事名", client_name: "発注者",
  project_price: "工事価格", period_contract_start: "着工日", period_contract_end: "完工日",
  project_location: "現場場所", project_overview: "概要",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "はい" : "いいえ";
  if (typeof v === "number") return `¥${v.toLocaleString()}`;
  const s = String(v);
  return STATUS_LABEL[s] ?? s;
}

/** before/after を優先、なければ旧フォーマット old/new を使う */
function getDiff(diff: FieldDiff): { before: unknown; after: unknown } {
  return {
    before: "before" in diff ? diff.before : diff.old,
    after:  "after"  in diff ? diff.after  : diff.new,
  };
}

function ChangeDetail({ fieldChanges }: { fieldChanges: EditHistoryItem["field_changes"] }) {
  if (!fieldChanges || Object.keys(fieldChanges).length === 0) return null;
  return (
    <table style={{ marginTop: 8, width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr style={{ color: "var(--c-text-muted)" }}>
          <th style={{ textAlign: "left", fontWeight: 500, padding: "2px 12px 2px 0", width: 120 }}>フィールド</th>
          <th style={{ textAlign: "left", fontWeight: 500, padding: "2px 12px 2px 0" }}>変更前</th>
          <th style={{ textAlign: "left", fontWeight: 500, padding: "2px 0" }}>変更後</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(fieldChanges).map(([field, diff]) => (
          <tr key={field} style={{ borderTop: "1px solid var(--c-border)" }}>
            <td style={{ padding: "2px 12px 2px 0", color: "var(--c-text-muted)" }}>{field}</td>
            <td style={{ padding: "2px 12px 2px 0", color: "var(--c-danger)", textDecoration: "line-through" }}>
              {formatValue(diff.before)}
            </td>
            <td style={{ padding: "2px 0", color: "var(--c-success)" }}>{formatValue(diff.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 編集履歴画面（S08）。 */
export default function HistoryPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { isLoading: authLoading } = useAuth();

  const [items, setItems] = useState<EditHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PER_PAGE = 30;

  const fetchHistory = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<EditHistoryResponse>(
        `/api/v1/projects/${projectId}/history?page=${p}&per_page=${PER_PAGE}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchHistory(page); }, [fetchHistory, page]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "編集履歴" },
      ]}
    >
      <div className="toolbar">
        <h1>編集履歴</h1>
        {!isLoading && <span className="meta">全 {total} 件</span>}
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 13,
          background: "var(--c-danger-bg)",
          border: "1px solid color-mix(in oklab, var(--c-danger) 30%, var(--c-border))",
          color: "var(--c-danger)",
        }}>
          {error}
        </div>
      )}

      {(authLoading || isLoading) ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
          読み込み中…
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--c-text-muted)" }}>編集履歴がありません</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{ padding: "14px 18px" }}
            >
              {/* 5W1H ヘッダー */}
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", fontSize: 13 }}>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11, fontWeight: 600 }}>誰が</span>
                <span style={{ fontWeight: 600 }}>{item.changed_by_name}</span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11, fontWeight: 600 }}>何を</span>
                <span>
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: "var(--r-sm)", background: "var(--c-surface-2)", color: "var(--c-text-muted)", border: "1px solid var(--c-border)", marginRight: 6 }}>
                    {ENTITY_TYPE_LABEL[item.entity_type] ?? item.entity_type}
                  </span>
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: "var(--r-sm)", background: "color-mix(in oklab, var(--c-accent) 12%, var(--c-surface))", color: "var(--c-accent)", fontWeight: 600, marginRight: 6 }}>
                    {CHANGE_TYPE_LABEL[item.change_type] ?? item.change_type}
                  </span>
                </span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11, fontWeight: 600 }}>いつ</span>
                <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-text-muted)" }}>
                  {new Date(item.changed_at).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ color: "var(--c-text-muted)", fontSize: 11, fontWeight: 600 }}>どのように</span>
                <span>
                  {item.field_changes && Object.keys(item.field_changes).length > 0 ? (
                    <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                      <thead>
                        <tr style={{ color: "var(--c-text-muted)" }}>
                          <th style={{ textAlign: "left", fontWeight: 500, padding: "2px 12px 2px 0", width: 120 }}>フィールド</th>
                          <th style={{ textAlign: "left", fontWeight: 500, padding: "2px 12px 2px 0" }}>変更前</th>
                          <th style={{ textAlign: "left", fontWeight: 500 }}>変更後</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(item.field_changes).map(([field, diff]) => {
                          const { before, after } = getDiff(diff);
                          return (
                            <tr key={field} style={{ borderTop: "1px solid var(--c-border)" }}>
                              <td style={{ padding: "2px 12px 2px 0", color: "var(--c-text-muted)" }}>
                                {FIELD_LABEL[field] ?? field}
                              </td>
                              <td style={{ padding: "2px 12px 2px 0", color: "var(--c-danger)", textDecoration: "line-through" }}>
                                {formatValue(before)}
                              </td>
                              <td style={{ padding: "2px 0", color: "var(--c-success)" }}>
                                {formatValue(after)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <span style={{ color: "var(--c-text-subtle)", fontSize: 12 }}>—</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 12 }}>
          <Button variant="default" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            前へ
          </Button>
          <span style={{ fontSize: 12, color: "var(--c-text-muted)", padding: "0 8px" }}>
            {page} / {totalPages}
          </span>
          <Button variant="default" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            次へ
          </Button>
        </div>
      )}
    </AppShell>
  );
}
