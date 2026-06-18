"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : "";

/** CSVエクスポートの種別定義 */
const CSV_TYPES = [
  {
    key: "projects",
    label: "案件一覧",
    desc: "工事番号・工事名・発注者・ステータス・工事価格・工期",
    hasDateRange: true,
    filename: "案件一覧.csv",
  },
] as const;

type CsvKey = (typeof CSV_TYPES)[number]["key"];

export default function CsvExportPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState<CsvKey | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  async function handleDownload(type: CsvKey, filename: string) {
    setLoading(type);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      const url = `${API_URL}/api/v1/export/csv/${type}?${params}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      showMsg(`${filename} をダウンロードしました`);
    } catch (e) {
      showMsg(`エラー: ${(e as Error).message}`, false);
    } finally {
      setLoading(null);
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: "CSV出力" }]}>
      <div style={{ padding: "var(--sp-4)", maxWidth: 720 }}>
        <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)", marginBottom: "var(--sp-4)" }}>
          データ CSV 出力
        </h2>

        {/* メッセージ（固定高さで下へのレイアウトシフトを防ぐ） */}
        <div style={{ height: 44, marginBottom: "var(--sp-1)" }}>
          {msg && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius)", fontSize: 13,
              background: msg.ok ? "var(--c-success-bg, #d1fae5)" : "var(--c-danger-bg, #fee2e2)",
              color: msg.ok ? "var(--c-success)" : "var(--c-danger)",
              border: `1px solid ${msg.ok ? "var(--c-success)" : "var(--c-danger)"}44`,
            }}>
              {msg.text}
            </div>
          )}
        </div>

        {/* 日付フィルター */}
        <div className="card" style={{ padding: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: "var(--sp-2)" }}>
            期間フィルター（任意）
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", marginBottom: 2 }}>開始日</div>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  padding: "6px 10px", border: "1px solid var(--c-border)",
                  borderRadius: "var(--radius-sm)", fontSize: "var(--fs-sm)",
                  background: "var(--c-surface)", color: "var(--c-text)",
                }}
              />
            </div>
            <div style={{ paddingTop: 18, color: "var(--c-text-muted)" }}>〜</div>
            <div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", marginBottom: 2 }}>終了日</div>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  padding: "6px 10px", border: "1px solid var(--c-border)",
                  borderRadius: "var(--radius-sm)", fontSize: "var(--fs-sm)",
                  background: "var(--c-surface)", color: "var(--c-text)",
                }}
              />
            </div>
            <div style={{ paddingTop: 18 }}>
              <Button
                variant="ghost" size="sm"
                onClick={() => { setFromDate(""); setToDate(""); }}
                style={{ fontSize: "var(--fs-xs)" }}
              >
                クリア
              </Button>
            </div>
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", marginTop: "var(--sp-1)" }}>
            ※ 未入力の場合は全期間を出力します
          </div>
        </div>

        {/* CSV種別一覧 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {CSV_TYPES.map((t) => (
            <div
              key={t.key}
              className="card"
              style={{
                padding: "var(--sp-3)",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: 2 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>
                  {t.desc}
                </div>
              </div>
              <Button
                size="sm"
                disabled={loading === t.key}
                onClick={() => handleDownload(t.key, t.filename)}
                style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {loading === t.key ? "出力中…" : "⬇ ダウンロード"}
              </Button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", lineHeight: 1.6 }}>
          ※ 出力ファイルは UTF-8（BOM付き）形式です。Excel で直接開けます。<br />
          ※ このページは管理者・経理ロールのみアクセス可能です。
        </div>
      </div>
    </AppShell>
  );
}
