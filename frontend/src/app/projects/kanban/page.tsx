"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";

type ProjectStatus = "quote" | "ordered" | "started" | "in_progress" | "completed" | "billed" | "paid";

interface KanbanCard {
  id: string;
  project_number: string;
  project_name: string;
  status: ProjectStatus;
  project_price: number | null;
  client_name: string | null;
  period_contract_end: string | null;
  sales_person_name: string | null;
  created_at: string;
  alert: string | null;
}

interface KanbanColumn {
  status: ProjectStatus;
  label: string;
  cards: KanbanCard[];
}

function fmtYen(v: number | null): string {
  if (v == null) return "";
  if (v >= 1_000_000) return `¥${(v / 1_000_000).toFixed(1)}M`;
  return `¥${v.toLocaleString()}`;
}

const STATUS_COLOR: Record<ProjectStatus, string> = {
  quote: "#6366f1",
  ordered: "#0891b2",
  started: "#0284c7",
  in_progress: "#d97706",
  completed: "#16a34a",
  billed: "#15803d",
  paid: "#374151",
};

export default function KanbanPage() {
  const router = useRouter();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<KanbanColumn[]>("/api/v1/projects/kanban");
      setColumns(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDrop = async (targetStatus: ProjectStatus, cardId: string) => {
    try {
      await apiFetch(`/api/v1/projects/${cardId}/kanban/move`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus }),
      });
      await load();
    } catch {
      // ignore
    }
    setDragging(null);
  };

  return (
    <AppShell breadcrumbs={[{ label: "案件カンバン" }]}>
      <div style={{ padding: "var(--sp-4)", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: "var(--sp-3)", minWidth: "max-content" }}>
          {columns.map((col) => (
            <div
              key={col.status}
              style={{
                width: 240,
                display: "flex",
                flexDirection: "column",
                gap: "var(--sp-2)",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragging && handleDrop(col.status, dragging)}
            >
              {/* 列ヘッダー */}
              <div
                style={{
                  background: STATUS_COLOR[col.status],
                  color: "#fff",
                  borderRadius: "var(--radius)",
                  padding: "var(--sp-2) var(--sp-3)",
                  fontWeight: 600,
                  fontSize: "var(--fs-sm)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{col.label}</span>
                <span style={{ opacity: 0.8 }}>{col.cards.length}</span>
              </div>

              {/* カード */}
              <div
                style={{
                  minHeight: 120,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--sp-2)",
                  padding: "var(--sp-1)",
                  background: "var(--c-surface-2)",
                  borderRadius: "var(--radius)",
                }}
              >
                {col.cards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragging(card.id)}
                    onDragEnd={() => setDragging(null)}
                    style={{
                      background: "var(--c-surface)",
                      border: "1px solid var(--c-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--sp-2) var(--sp-3)",
                      cursor: "grab",
                      fontSize: "var(--fs-sm)",
                    }}
                  >
                    <Link
                      href={`/projects/${card.id}`}
                      style={{ color: "var(--c-text)", textDecoration: "none", fontWeight: 600 }}
                    >
                      {card.project_name}
                    </Link>
                    <div style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-xs)", marginTop: 2 }}>
                      {card.project_number}
                    </div>
                    {card.project_price != null && (
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{fmtYen(card.project_price)}</div>
                    )}
                    {card.client_name && (
                      <div style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-xs)" }}>
                        {card.client_name}
                      </div>
                    )}
                    {card.period_contract_end && (
                      <div style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-xs)" }}>
                        工期:{card.period_contract_end}
                      </div>
                    )}
                    {card.alert && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: "2px 6px",
                          background: "#fef3c7",
                          color: "#92400e",
                          borderRadius: 4,
                          fontSize: "var(--fs-xs)",
                        }}
                      >
                        ⚠ {card.alert}
                      </div>
                    )}
                  </div>
                ))}
                {loading && col.cards.length === 0 && (
                  <div style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-xs)", padding: "var(--sp-2)" }}>
                    読み込み中...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
