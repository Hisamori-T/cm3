/**
 * スキャンジョブ 1行コンポーネント。ハンドオフデザイン準拠。
 * 8カラム grid: [☑] [アイコン] [ファイル名/業者] [形式] [進捗] [ステータス] [信頼度] [操作]
 */

"use client";

import Link from "next/link";
import { FileText, Image as ImageIcon, FileSpreadsheet, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScanJob } from "@/types/scan";

interface Props {
  job: ScanJob;
  selected: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function JobRow({ job, selected, onToggle, onDelete }: Props) {
  const isProcessing = job.status === "pending" || job.status === "processing";
  const isFailed = job.status === "failed";

  return (
    <div
      className={cn(
        "grid items-center gap-3 px-4 py-2.5 text-xs border-b border-neutral-200 transition-colors",
        "grid-cols-[28px_36px_1fr_90px_1fr_130px_80px_96px]",
        selected ? "bg-brand/10" : "hover:bg-neutral-50",
      )}
    >
      {/* チェックボックス */}
      <div className="grid place-items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(job.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 accent-brand"
          aria-label={`${job.original_file_name} を選択`}
        />
      </div>

      {/* ファイルアイコン */}
      <FileIcon fileType={job.file_type} />

      {/* ファイル名 + 業者 */}
      <Link href={`/scan/${job.id}`} className="block min-w-0" onClick={(e) => e.stopPropagation()}>
        <div className="truncate font-medium text-neutral-900">
          {job.original_file_name}
        </div>
        <div className="truncate font-mono text-[11px] text-neutral-500">
          {job.vendor_name_detected ?? "— 解析中 —"} ·{" "}
          {new Date(job.created_at).toLocaleString("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </Link>

      {/* 形式 */}
      <div className="text-neutral-500 uppercase">{job.file_type}</div>

      {/* 進捗バー */}
      <ProgressCell job={job} isProcessing={isProcessing} isFailed={isFailed} />

      {/* ステータスバッジ */}
      <StatusCell status={job.status} />

      {/* 信頼度 */}
      <ConfidenceCell value={job.confidence_score} status={job.status} />

      {/* 操作 */}
      <div className="flex justify-end gap-1">
        {job.status === "succeeded" && (
          <Link
            href={`/scan/${job.id}`}
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-hover"
          >
            確認 →
          </Link>
        )}
        {(job.status === "reviewed" || (job.status === "failed")) && (
          <Link
            href={`/scan/${job.id}`}
            className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] text-neutral-500"
          >
            詳細
          </Link>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
          className="grid h-[26px] w-[26px] place-items-center rounded-md border border-neutral-200 text-neutral-400 hover:border-stamp hover:bg-red-50 hover:text-stamp"
          aria-label="削除"
        >
          <Trash2 className="h-3 w-3" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

function FileIcon({ fileType }: { fileType: ScanJob["file_type"] }) {
  const cls = "grid h-7 w-7 place-items-center rounded-sm border";
  if (fileType === "pdf")
    return (
      <div className={cn(cls, "border-stamp/30 bg-stamp/10 text-stamp")}>
        <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
      </div>
    );
  if (fileType === "image")
    return (
      <div className={cn(cls, "border-status-billed/30 bg-status-billed/10 text-status-billed")}>
        <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.6} />
      </div>
    );
  return (
    <div className={cn(cls, "border-status-done/30 bg-status-done/10 text-status-done")}>
      <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.6} />
    </div>
  );
}

function ProgressCell({
  job,
  isProcessing,
  isFailed,
}: {
  job: ScanJob;
  isProcessing: boolean;
  isFailed: boolean;
}) {
  if (isFailed) {
    return (
      <div>
        <div className="h-1 w-full rounded-full bg-stamp" />
        <div className="mt-1 font-mono text-[10px] text-stamp">
          {job.error_message ?? "処理エラー"}
        </div>
      </div>
    );
  }
  if (isProcessing) {
    return (
      <div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-status-start to-brand animate-pulse" />
        </div>
        <div className="mt-1 font-mono text-[10px] text-neutral-500">
          {job.status === "pending" ? "処理待ち…" : "解析中…"}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="h-1 w-full rounded-full bg-brand" />
      <div className="mt-1 font-mono text-[10px] text-neutral-500">
        {job.item_count != null ? `${job.item_count}項目抽出` : "完了"}
      </div>
    </div>
  );
}

function StatusCell({ status }: { status: ScanJob["status"] }) {
  const labels: Record<ScanJob["status"], string> = {
    pending:    "処理待ち",
    processing: "処理中",
    succeeded:  "レビュー待ち",
    reviewed:   "完了",
    failed:     "エラー",
  };
  const colors: Record<ScanJob["status"], string> = {
    pending:    "bg-neutral-100 text-neutral-500",
    processing: "bg-status-start/15 text-status-start",
    succeeded:  "bg-status-progress/15 text-status-progress",
    reviewed:   "bg-status-done/15 text-status-done",
    failed:     "bg-stamp/15 text-stamp",
  };
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", colors[status])}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "processing" ? "animate-pulse bg-status-start" : "bg-current opacity-60",
        )}
      />
      {labels[status]}
    </span>
  );
}

function ConfidenceCell({
  value,
  status,
}: {
  value: number | null | undefined;
  status: ScanJob["status"];
}) {
  if (status === "processing" || status === "pending" || value == null) {
    return <span className="text-neutral-400">—</span>;
  }
  const pct = Math.round(value * 100);
  const cls =
    pct >= 90
      ? "text-status-done bg-status-done/15"
      : pct >= 75
      ? "text-amber-700 bg-amber-50"
      : "text-stamp bg-stamp/15";
  return (
    <span className={cn("inline-flex justify-self-end items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold", cls)}>
      {pct}%
    </span>
  );
}
