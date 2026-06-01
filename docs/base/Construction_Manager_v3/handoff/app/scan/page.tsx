/**
 * Construction Manager v3 — スキャン一覧画面（改修版）
 *
 * frontend/src/app/scan/page.tsx
 *
 * 改修ポイント：
 *   - 各行の左端にチェックボックス
 *   - 1件以上選択で上部に <BulkActionBar />
 *   - 行クリック → /scan/[id]
 *   - 削除はゴミ箱アイコン（論理削除 → Toast に「元に戻す」3秒）
 */

'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Upload, FileText, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BulkActionBar } from '@/components/scan/BulkActionBar';
import { JobRow } from '@/components/scan/JobRow';
import type { ScanJob, TransferTarget } from '@/types/scan';

/** 実装側で SWR / RSC に置き換え */
function useScanJobs(): { jobs: ScanJob[]; mutate: (next: ScanJob[]) => void } {
  // ここで GET /api/v1/scan/jobs
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  return { jobs, mutate: setJobs };
}

export default function ScanListPage() {
  const { jobs, mutate } = useScanJobs();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'processing' | 'review' | 'transferred'>('all');

  const visible = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'review') return jobs.filter((j) => j.status === 'review');
    if (filter === 'transferred') return jobs.filter((j) => j.status === 'transferred');
    return jobs.filter((j) => j.status === 'processing' || j.status === 'pending');
  }, [jobs, filter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clear = () => setSelected(new Set());

  /** 一括削除 — 論理削除 → Toast で「元に戻す」3秒表示 */
  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    // 楽観 UI: 即座にローカルから消す
    const snapshot = jobs;
    mutate(jobs.filter((j) => !selected.has(j.id)));
    clear();

    try {
      // ここで DELETE /api/v1/scan/jobs  body: { ids }
      const res = await fetch('/api/v1/scan/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('failed');

      toast(`${ids.length}件のジョブを削除しました`, {
        action: {
          label: '元に戻す',
          onClick: async () => {
            // ここで POST /api/v1/scan/jobs/restore  body: { ids }
            await fetch('/api/v1/scan/jobs/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            });
            mutate(snapshot);
            toast.success('削除を取り消しました');
          },
        },
        duration: 3000,
      });
    } catch {
      // ロールバック
      mutate(snapshot);
      toast.error('削除に失敗しました');
    }
  };

  const singleDelete = async (id: string) => {
    setSelected(new Set([id]));
    await bulkDelete();
  };

  /** 一括転記 — 案件選択モーダルを出して target_project_id + targets を渡す */
  const bulkTransfer = async (_targets: TransferTarget[]) => {
    // 1. ここで案件選択 modal を開く（CommandDialog で工事番号・案件名検索）
    // 2. 選択された projectId と targets を POST /api/v1/scan/jobs/bulk-transfer に送る
    //    body: { jobIds: Array.from(selected), targetProjectId, targets }
    toast('案件選択モーダルを実装してください（CommandDialog）');
  };

  const exportCsv = () => {
    // ここで GET /api/v1/scan/jobs/export.csv?ids=...
    const params = new URLSearchParams();
    selected.forEach((id) => params.append('ids', id));
    window.location.href = `/api/v1/scan/jobs/export.csv?${params}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">業者見積スキャン</h1>
        <span className="text-xs text-neutral-500">
          PDF / 画像 / Excel を AI が読み取り、台帳・QCDS・見積書へ転記します
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm">
            <History className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
            履歴
          </Button>
          <Button size="sm">
            <Upload className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
            新規アップロード
          </Button>
        </div>
      </div>

      {/* TODO: KPI cards + drop zone — 前回デザイン screens/scan-upload.html 参照 */}

      {/* Bulk action bar (selected > 0 のときだけ表示) */}
      <BulkActionBar
        count={selected.size}
        onClear={clear}
        onDelete={bulkDelete}
        onExportCsv={exportCsv}
        onBulkTransfer={bulkTransfer}
      />

      {/* Filter tabs */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <div>
            <div className="text-sm font-bold">処理ジョブ</div>
            <div className="text-xs text-neutral-500">直近 30日 · 完了したジョブは結果ページに移動します</div>
          </div>
          <div className="ml-auto">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="h-7">
                <TabsTrigger value="all" className="text-xs">すべて {jobs.length}</TabsTrigger>
                <TabsTrigger value="processing" className="text-xs">処理中</TabsTrigger>
                <TabsTrigger value="review" className="text-xs">未レビュー</TabsTrigger>
                <TabsTrigger value="transferred" className="text-xs">完了</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Head row */}
        <div className="grid grid-cols-[28px_36px_1fr_90px_1fr_130px_80px_96px] gap-3 bg-neutral-50 dark:bg-neutral-800/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          <div></div>
          <div></div>
          <div>ファイル名 / 業者</div>
          <div>形式</div>
          <div>進捗</div>
          <div>ステータス</div>
          <div className="text-right">信頼度</div>
          <div className="text-right">操作</div>
        </div>

        {/* Rows */}
        <div>
          {visible.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              selected={selected.has(job.id)}
              onToggle={toggle}
              onDelete={singleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
