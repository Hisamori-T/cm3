/**
 * Construction Manager v3 — 案件サブナビ共通レイアウト
 *
 * frontend/src/app/projects/[id]/layout.tsx
 *
 * 全ての /projects/[id]/* 配下のページに共通の：
 *   - 案件ヘッダー（戻る + 工事番号 + 案件名 + ステータスバッジ）
 *   - サブナビ（詳細 / QCDS / 業者見積 / 顧客見積 / 注文書 / 注文請書 / 請求書 / 進捗 / 編集履歴）
 * を持たせます。前回デザインの .proj-header / .proj-subnav と完全に整合。
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ProjectSubNav } from '@/components/project/ProjectSubNav';
import { ProjectStatusBadge } from '@/components/project/ProjectStatusBadge';
import type { ProjectHeader } from '@/types/project';

interface Props {
  params: { id: string };
  children: React.ReactNode;
}

/**
 * バックエンドから案件ヘッダー（基本情報 + 各サブリソースのカウント）を取得。
 * `cache: 'no-store'` で navigation 毎に最新化。
 * バッジ件数は GET /api/v1/projects/{id} のレスポンスに `counts` を含めるよう
 * バックエンド側で集計しておく。
 */
async function fetchProjectHeader(id: string): Promise<ProjectHeader | null> {
  // ここで GET /api/v1/projects/{id}
  const res = await fetch(`${process.env.API_URL}/api/v1/projects/${id}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchProjectHeader failed: ${res.status}`);
  return res.json();
}

export default async function ProjectLayout({ params, children }: Props) {
  const header = await fetchProjectHeader(params.id);
  if (!header) notFound();

  return (
    <div className="space-y-3">
      {/* 案件ヘッダー + サブナビ（前回デザインの .proj-header と同一スタイル） */}
      <header className="rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <a
            href="/projects"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <span className="text-base leading-none">‹</span>案件一覧
          </a>
          <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-500">
            {header.projectNumber}
          </span>
          <h1 className="m-0 text-base font-bold tracking-tight">{header.name}</h1>
          <ProjectStatusBadge status={header.status} />
        </div>

        <ProjectSubNav projectId={params.id} counts={header.counts} />
      </header>

      <Suspense fallback={<div className="text-sm text-neutral-500">読み込み中…</div>}>
        {children}
      </Suspense>
    </div>
  );
}
