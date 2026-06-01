/**
 * スキャン編集画面の案件選択カード。ハンドオフデザイン準拠。
 * 未選択時：黄色背景 + 警告アイコン
 * 選択済 ：クラップネイビーの太枠 + halo
 *
 * NOTE: cmdk の CommandItem.onSelect は Radix Dialog の focus-trap と干渉して
 * クリックが効かないケースがあるため、シンプルな <button onClick> リストに変更。
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectOption {
  id: string;
  project_number: string;
  project_name: string;
}

interface Props {
  linkedProject: ProjectOption | null;
  candidates: ProjectOption[];
  onSelect: (project: ProjectOption) => void;
  onClear: () => void;
  onLoadCandidates?: () => void;
}

export function ProjectPickerCard({
  linkedProject,
  candidates,
  onSelect,
  onClear,
  onLoadCandidates,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isEmpty = !linkedProject;
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    onLoadCandidates?.();
    setOpen(true);
    setQuery("");
  }

  function handleClose() {
    setOpen(false);
    setQuery("");
  }

  function handleSelect(p: ProjectOption) {
    onSelect(p);
    handleClose();
  }

  // Escape キーで閉じる
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ダイアログ外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    setTimeout(() => document.addEventListener("mousedown", onOutside), 0);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 開いたらインプットにフォーカス
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = candidates.filter(p =>
    query === "" ||
    p.project_number.toLowerCase().includes(query.toLowerCase()) ||
    p.project_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className={cn(
        "grid grid-cols-[36px_1fr_auto] items-center gap-4 rounded-lg border-2 p-4",
        isEmpty
          ? "border-status-progress bg-amber-50 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]"
          : "border-brand bg-white shadow-[0_0_0_4px_var(--c-primary-50)]",
      )}
    >
      {/* アイコン */}
      <div className={cn("grid h-9 w-9 place-items-center rounded-md text-white", isEmpty ? "bg-status-progress" : "bg-brand")}>
        {isEmpty ? <AlertTriangle className="h-4 w-4" strokeWidth={1.6} /> : <Check className="h-4 w-4" strokeWidth={2} />}
      </div>

      {/* 本文 */}
      <div>
        <div className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wider", isEmpty ? "text-status-progress" : "text-neutral-500")}>
          {isEmpty ? "⚠ 転記先 案件が未選択です" : "転記先 案件"}
        </div>
        {isEmpty ? (
          <>
            <div className="text-base font-bold text-status-progress">案件を選択してください</div>
            <div className="mt-0.5 text-xs text-neutral-500">解析結果を転記する案件を選んでから操作してください</div>
            <button
              onClick={handleOpen}
              className="mt-2 flex w-full items-center gap-2 rounded-md border-[1.5px] border-status-progress bg-white px-3 py-1.5 text-xs text-neutral-500"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={1.8} />
              工事名・工事番号で検索
            </button>
          </>
        ) : (
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-sm font-semibold text-neutral-500">
              {linkedProject.project_number}
            </span>
            <span className="text-base font-bold text-neutral-900">{linkedProject.project_name}</span>
          </div>
        )}
      </div>

      {/* 操作ボタン */}
      <div className="flex gap-1.5">
        <button
          onClick={handleOpen}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
            isEmpty
              ? "bg-brand text-white hover:bg-brand-hover"
              : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
          )}
        >
          {isEmpty ? "案件を選択" : "変更"}
        </button>
        {!isEmpty && (
          <button
            onClick={onClear}
            aria-label="紐付け解除"
            className="grid h-7 w-7 place-items-center rounded-md border border-neutral-200 text-neutral-400 hover:bg-neutral-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 案件選択モーダル（cmdk非使用・シンプル実装） */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            ref={dialogRef}
            style={{
              background: "var(--c-surface)", borderRadius: "var(--r-lg)",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
              width: 480, maxHeight: "70vh",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* 検索ヘッダ */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 16px", borderBottom: "1px solid var(--c-border)",
            }}>
              <Search size={14} style={{ color: "var(--c-text-muted)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="工事番号・工事名で検索..."
                style={{
                  flex: 1, border: "none", outline: "none", fontSize: 14,
                  background: "transparent", color: "var(--c-text)",
                }}
              />
              <button
                onClick={handleClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2, display: "flex" }}
              >
                <X size={14} />
              </button>
            </div>

            {/* リスト */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filtered.length === 0 ? (
                <p style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "var(--c-text-muted)" }}>
                  {candidates.length === 0 ? "読み込み中…" : "該当する案件がありません"}
                </p>
              ) : (
                filtered.slice(0, 50).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", textAlign: "left",
                      padding: "10px 16px",
                      background: "none", border: "none", cursor: "pointer",
                      borderBottom: "1px solid var(--c-border)",
                      color: "var(--c-text)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--c-surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <span style={{
                      fontFamily: "var(--ff-mono)", fontSize: 11, fontWeight: 600,
                      color: "var(--c-text-muted)", minWidth: 80, flexShrink: 0,
                    }}>
                      {p.project_number}
                    </span>
                    <span style={{ fontSize: 13, flex: 1 }}>{p.project_name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
