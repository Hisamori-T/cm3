/**
 * Construction Manager v3 — スキャン編集画面（改修版）
 *
 * frontend/src/app/scan/[id]/page.tsx
 *
 * 改修ポイント：
 *   - 上部に「デカい案件選択カード」<ProjectPickerCard /> を配置
 *   - 案件未選択時は黄色背景 + 警告（「選択先に転記する」ボタンは disabled）
 *   - 案件選択済はクラップネイビーの halo + 案件番号・件名・ステータスを大表示
 *   - 「選択先に転記する」押下 → Toast に「QCDSに転記しました [QCDSを見る→] [見積書を見る→]」
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectPickerCard } from '@/components/scan/ProjectPickerCard';
import type { ProjectHeader } from '@/types/project';
import type { ScanResult, TransferTarget } from '@/types/scan';

/** 実装側で SWR / RSC に */
function useScanResult(jobId: string) {
  // GET /api/v1/scan/jobs/{id}
  const [result, setResult] = useState<ScanResult | null>(null);
  return { result, setResult };
}
function useProjectCandidates() {
  // GET /api/v1/projects?status=active
  const [candidates, setCandidates] = useState<ProjectHeader[]>([]);
  return candidates;
}

export default function ScanReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { result } = useScanResult(params.id);
  const candidates = useProjectCandidates();

  const [linkedProject, setLinkedProject] = useState<ProjectHeader | null>(null);
  const [targets, setTargets] = useState<Set<TransferTarget>>(
    new Set(['qcds-direct', 'agreement-table']),
  );
  const [transferring, setTransferring] = useState(false);

  const canTransfer = !!linkedProject && targets.size > 0;

  const transfer = async () => {
    if (!linkedProject) {
      toast.error('案件を選択してください');
      return;
    }
    setTransferring(true);
    try {
      // ここで POST /api/v1/scan/jobs/{id}/transfer
      // body: { targetProjectId, targets }
      const res = await fetch(`/api/v1/scan/jobs/${params.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetProjectId: linkedProject.id,
          targets: Array.from(targets),
        }),
      });
      if (!res.ok) throw new Error('failed');

      // 成功トースト — 各転記先へのリンクを並べる
      toast.success('転記が完了しました', {
        description: '解析結果を選択した転記先に反映しました',
        action: targets.has('qcds-direct')
          ? {
              label: 'QCDSを見る →',
              onClick: () => router.push(`/projects/${linkedProject.id}/qcds`),
            }
          : undefined,
        duration: Infinity,  // 手で閉じるまで残す
      });
    } catch {
      toast.error('転記に失敗しました');
    } finally {
      setTransferring(false);
    }
  };

  if (!result) return <div className="p-6 text-sm text-neutral-500">読み込み中…</div>;

  return (
    <div className="space-y-4">
      {/* === デカい案件選択カード === */}
      <ProjectPickerCard
        linkedProject={linkedProject}
        candidates={candidates}
        onSelect={(p) => setLinkedProject(p)}
        onClear={() => setLinkedProject(null)}
      />

      {/* === 左右2ペイン (前回デザイン .split / .pane) ===
          - Left: 原本PDF/画像/Excel プレビュー (react-pdf / 画像 src 直貼り)
          - Right: 抽出結果テーブル（ヘッダー / 明細 / 転記先選択）
       */}
      <div className="grid grid-cols-[1fr_1.2fr] gap-0 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <PreviewPane jobId={params.id} />
        <ResultPane
          result={result}
          targets={targets}
          onToggleTarget={(t) =>
            setTargets((prev) => {
              const next = new Set(prev);
              next.has(t) ? next.delete(t) : next.add(t);
              return next;
            })
          }
        />
      </div>

      {/* Footer action bar */}
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
        <div className="text-xs text-neutral-500">
          転記先 <strong className="font-mono">{targets.size} / 4</strong>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm">プレビュー</Button>
        <Button
          size="sm"
          disabled={!canTransfer || transferring}
          onClick={transfer}
          className="bg-brand hover:bg-brand-hover text-white"
        >
          <Check className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
          選択先に転記する
        </Button>
      </div>
    </div>
  );
}

function PreviewPane({ jobId }: { jobId: string }) {
  return (
    <div className="border-r border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 p-4">
      <div className="text-xs text-neutral-500">
        [原本プレビュー — PDF は react-pdf、画像は &lt;img&gt;、Excel は exceljs + canvas]
      </div>
    </div>
  );
}

function ResultPane({
  result,
  targets,
  onToggleTarget,
}: {
  result: ScanResult;
  targets: Set<TransferTarget>;
  onToggleTarget: (t: TransferTarget) => void;
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="text-xs text-neutral-500">
        [ヘッダー (信頼度バッジ付き) / 明細テーブル / AI サジェスト — screens/scan-review.html 参照]
      </div>

      {/* 転記先カード（複数チェック可） */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { k: 'qcds-direct',    title: 'QCDS A-1 外注へ',   desc: '3行分の追加 + 既存3行の更新',  where: 'QCDS / 直接工事 / 外注' },
            { k: 'agreement-table',title: '取決見通表 No.1',     desc: '北陸電気工業 行に金額・支払予定を反映', where: '26-3-014 / 取決見通表' },
            { k: 'customer-quote', title: '見積書 内訳候補',     desc: '顧客向け見積書の項目候補に追加',         where: '26-AP-014 / 見積書 内訳' },
            { k: 'vendor-master',  title: '業者マスタに保存',   desc: '業者マスタに登録 + 単価履歴に追加',     where: '業者マスタ / 単価履歴' },
          ] as Array<{ k: TransferTarget; title: string; desc: string; where: string }>
        ).map(({ k, title, desc, where }) => {
          const on = targets.has(k);
          return (
            <label
              key={k}
              className={[
                'flex cursor-pointer items-start gap-2 rounded-md border-[1.5px] p-3',
                on ? 'border-brand bg-brand/10' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggleTarget(k)}
                className="mt-0.5 accent-brand"
              />
              <div className="flex-1">
                <div className="text-xs font-semibold">{title}</div>
                <div className="text-[11px] text-neutral-500">{desc}</div>
                <span className="mt-1 inline-block rounded-sm bg-white dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-brand">
                  {where}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
