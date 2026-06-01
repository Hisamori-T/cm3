/**
 * Construction Manager v3 — スキャンジョブ 1行
 *
 * frontend/src/components/scan/JobRow.tsx
 *
 * 8カラム grid（前回デザイン .jl-row）：
 *   [☑] [アイコン] [ファイル名/業者] [形式] [進捗] [ステータス] [信頼度] [操作]
 * 行クリックで個別編集画面 /scan/[id] へ。
 * 削除アイコンは論理削除 → 親が Toast を出す。
 */

'use client';

import Link from 'next/link';
import { FileText, Image, FileSpreadsheet, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScanJob } from '@/types/scan';

interface Props {
  job: ScanJob;
  selected: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function JobRow({ job, selected, onToggle, onDelete }: Props) {
  return (
    <div
      className={cn(
        'grid items-center gap-3 px-4 py-2.5 text-xs border-b border-neutral-200 dark:border-neutral-800 transition-colors',
        // 8カラム: checkbox / icon / name / format / progress / status / confidence / actions
        'grid-cols-[28px_36px_1fr_90px_1fr_130px_80px_96px]',
        selected ? 'bg-brand/10 dark:bg-brand/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30',
      )}
    >
      <div className="grid place-items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(job.id)}
          className="h-3.5 w-3.5 accent-brand"
          aria-label={`${job.filename} を選択`}
        />
      </div>

      <FileIcon format={job.fileFormat} />

      <Link href={`/scan/${job.id}`} className="block min-w-0">
        <div className="truncate font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-brand">
          {job.filename}
        </div>
        <div className="truncate font-mono text-[11px] text-neutral-500">
          {job.vendorName ?? '— 解析中 —'} · {new Date(job.uploadedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </Link>

      <div className="text-neutral-500">
        {job.fileFormat.toUpperCase()}
      </div>

      <ProgressCell job={job} />
      <StatusCell status={job.status} />
      <ConfidenceCell value={job.confidence} status={job.status} />

      <div className="flex justify-end gap-1">
        {job.status === 'review' && (
          <Link
            href={`/scan/${job.id}`}
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-hover"
          >
            確認 →
          </Link>
        )}
        {job.status === 'transferred' && (
          <Link
            href={`/scan/${job.id}`}
            className="rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[11px] text-neutral-500"
          >
            詳細
          </Link>
        )}
        <button
          type="button"
          onClick={() => onDelete(job.id)}
          className="grid h-[26px] w-[26px] place-items-center rounded-md border border-neutral-200 text-neutral-400 hover:border-stamp hover:bg-red-50 hover:text-stamp dark:border-neutral-700"
          aria-label="削除"
        >
          <Trash2 className="h-3 w-3" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

function FileIcon({ format }: { format: ScanJob['fileFormat'] }) {
  const cls = 'grid h-7 w-7 place-items-center rounded-sm border';
  if (format === 'pdf')
    return (
      <div className={cn(cls, 'border-stamp/30 bg-stamp/10 text-stamp')}>
        <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
      </div>
    );
  if (format === 'image')
    return (
      <div className={cn(cls, 'border-status-billed/30 bg-status-billed/10 text-status-billed')}>
        <Image className="h-3.5 w-3.5" strokeWidth={1.6} />
      </div>
    );
  return (
    <div className={cn(cls, 'border-status-done/30 bg-status-done/10 text-status-done')}>
      <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.6} />
    </div>
  );
}

function ProgressCell({ job }: { job: ScanJob }) {
  if (job.status === 'failed') {
    return (
      <div>
        <div className="h-1 w-full rounded-full bg-stamp" />
        <div className="mt-1 font-mono text-[10px] text-stamp">画像が不鮮明 · 一部認識不可</div>
      </div>
    );
  }
  if (job.status === 'processing') {
    return (
      <div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-status-start to-brand animate-pulse"
            style={{ width: `${job.progressPercent}%` }}
          />
        </div>
        <div className="mt-1 font-mono text-[10px] text-neutral-500">
          解析中… {job.progressPercent}%
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="h-1 w-full rounded-full bg-brand" />
      <div className="mt-1 font-mono text-[10px] text-neutral-500">
        {job.itemCount}項目抽出
      </div>
    </div>
  );
}

function StatusCell({ status }: { status: ScanJob['status'] }) {
  const labels: Record<ScanJob['status'], string> = {
    pending: '待機中',
    processing: '処理中',
    review: 'レビュー待ち',
    transferred: '完了',
    failed: '要再撮影',
  };
  const colors: Record<ScanJob['status'], string> = {
    pending: 'bg-neutral-100 text-neutral-500',
    processing: 'bg-status-start/15 text-status-start',
    review: 'bg-status-done/15 text-status-done',
    transferred: 'bg-status-done/15 text-status-done',
    failed: 'bg-stamp/15 text-stamp',
  };
  return (
    <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', colors[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'processing' ? 'animate-pulse bg-status-start' : 'bg-current opacity-60')} />
      {labels[status]}
    </span>
  );
}

function ConfidenceCell({ value, status }: { value: number; status: ScanJob['status'] }) {
  if (status === 'processing' || status === 'pending') {
    return <span className="text-neutral-400">—</span>;
  }
  const pct = Math.round(value * 100);
  const cls =
    pct >= 90
      ? 'text-status-done bg-status-done/15'
      : pct >= 75
      ? 'text-amber-700 bg-amber-50'
      : 'text-stamp bg-stamp/15';
  return (
    <span className={cn('inline-flex justify-self-end items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold', cls)}>
      {pct}%
    </span>
  );
}
