/**
 * Construction Manager v3 — 取決見通表（業者ごとアコーディオン）
 *
 * frontend/src/components/qcds/AgreementTable.tsx
 *
 * 旧版「項目ごとに 30行展開」を廃止し、**1業者 = 1行のグロス表示** に変更。
 * 各行の右端「▼ N項目」ボタンで明細をアコーディオン展開（shadcn/ui Accordion を流用）。
 * 業者名はクリックで業者マスタへ遷移。
 *
 * 前回デザインの project-detail.html の取決見通表セクションと完全に同一。
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Sparkles, Plus, FileScan } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgreementRow } from '@/types/project';

interface Props {
  projectId: string;
  rows: AgreementRow[];
  months: string[];                // ["2026-04", "2026-05", ...]
  onAddRow: () => void;
  onImportScan: () => void;
}

export function AgreementTable({ projectId, rows, months, onAddRow, onImportScan }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 集計行
  const totalAmount = rows.reduce((s, r) => s + r.agreementAmount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidTotal, 0);
  const monthlyTotals = months.map((m) =>
    rows.reduce((s, r) => s + (r.monthlyPayments[m] ?? 0), 0)
  );

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <div>
          <div className="text-sm font-bold tracking-wide">取決見通表 · 専門業者取決伺</div>
          <div className="text-xs text-neutral-500">
            1業者 = 1行グロス表示 · <kbd className="font-mono">▼</kbd> で明細展開 · 業者名クリックで業者マスタへ
          </div>
        </div>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onImportScan}
            className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <FileScan className="h-3.5 w-3.5" strokeWidth={1.5} />
            業者見積から取込
          </button>
          <button
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            行追加
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500">
              <th rowSpan={2} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-left font-semibold w-8">No</th>
              <th rowSpan={2} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-left font-semibold min-w-[200px]">業者</th>
              <th rowSpan={2} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-left font-semibold min-w-[80px]">工種</th>
              <th rowSpan={2} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-semibold min-w-[100px]">取決金額</th>
              <th rowSpan={2} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-center font-semibold w-10">伺</th>
              <th colSpan={months.length} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-1 text-center font-semibold bg-status-progress/10">
                精算（支払）見通表
              </th>
              <th rowSpan={2} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-semibold min-w-[90px]">支払計</th>
              <th rowSpan={2} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-semibold min-w-[80px]">残支払</th>
              <th rowSpan={2} className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-center font-semibold w-20">明細</th>
            </tr>
            <tr className="bg-status-progress/5 text-neutral-500">
              {months.map((m) => (
                <th key={m} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-1 text-right font-semibold">
                  {parseInt(m.slice(5), 10)}月
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = expanded.has(row.id);
              return (
                <>
                  <tr
                    key={row.id}
                    className={cn(
                      'transition-colors',
                      isOpen
                        ? 'bg-brand/5 dark:bg-brand/20'
                        : 'bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50',
                    )}
                  >
                    <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-center font-mono text-neutral-500">{row.rowNo}</td>
                    <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2">
                      <Link
                        href={`/vendors/${row.vendor.id}`}
                        className="font-semibold text-brand hover:underline dark:text-blue-200"
                      >
                        {row.vendor.name}
                      </Link>
                      {row.vendor.location && (
                        <span className="block text-[10px] text-neutral-400 mt-0.5">{row.vendor.location}</span>
                      )}
                    </td>
                    <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-neutral-500">{row.trade}</td>
                    <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono">{row.agreementAmount.toLocaleString()}</td>
                    <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-center">
                      <span
                        className={cn(
                          'inline-block h-3.5 w-3.5 rounded-sm border-[1.5px]',
                          row.requested
                            ? 'bg-accent border-accent after:content-["✓"] after:text-white after:text-[10px] after:font-bold after:leading-none after:relative after:-top-0.5'
                            : 'border-neutral-300',
                        )}
                      />
                    </td>
                    {months.map((m) => {
                      const v = row.monthlyPayments[m];
                      return (
                        <td key={m} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono text-neutral-500">
                          {v ? v.toLocaleString() : '—'}
                        </td>
                      );
                    })}
                    <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono font-bold bg-brand/5">
                      {row.paidTotal.toLocaleString()}
                    </td>
                    <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono">
                      {row.isPaid ? (
                        <span className="rounded-full bg-status-paid/15 px-2 py-0.5 text-[10px] font-semibold text-status-paid">済</span>
                      ) : (
                        <span className="text-neutral-400">¥0</span>
                      )}
                    </td>
                    <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-center">
                      <button
                        onClick={() => toggle(row.id)}
                        aria-expanded={isOpen}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                          isOpen
                            ? 'bg-brand text-white'
                            : 'border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                        )}
                      >
                        ▼ {row.details.length}項目
                        <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-brand/[0.04] dark:bg-brand/10 border-b-2 border-brand/40">
                      <td colSpan={months.length + 9} className="p-0">
                        <DetailExpand row={row} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}

            {/* Totals row */}
            <tr className="bg-brand/8 font-bold border-t-2 border-neutral-400 dark:border-neutral-600">
              <td colSpan={3} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right">直接工事費 計</td>
              <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono">{totalAmount.toLocaleString()}</td>
              <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-center text-[10px] text-neutral-500">
                {rows.filter((r) => r.requested).length}/{rows.length}
              </td>
              {monthlyTotals.map((mt, i) => (
                <td key={i} className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono">
                  {mt > 0 ? mt.toLocaleString() : '—'}
                </td>
              ))}
              <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono">{totalPaid.toLocaleString()}</td>
              <td className="border-r border-b border-neutral-200 dark:border-neutral-800 px-2 py-2 text-right font-mono">—</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailExpand({ row }: { row: AgreementRow }) {
  const hasScan = row.details.some((d) => d.source === 'scan');
  const avgConfidence = hasScan
    ? row.details
        .filter((d) => d.source === 'scan')
        .reduce((s, d) => s + (d.confidence ?? 0), 0) /
      row.details.filter((d) => d.source === 'scan').length
    : null;

  return (
    <div className="relative py-2 pl-[60px] pr-5">
      {/* 縦のアクセントライン */}
      <div className="absolute left-9 top-0 bottom-3 w-0.5 bg-brand" />

      <div className="mb-1.5 flex items-center gap-2">
        <strong className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">明細</strong>
        {hasScan ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand dark:text-blue-200">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2} />
            スキャン由来 {Math.round((avgConfidence ?? 0) * 100)}%
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
            手動入力
          </span>
        )}
      </div>

      <table className="w-full border-collapse overflow-hidden rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800 text-[11px]">
        <thead>
          <tr className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500">
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-left font-semibold w-8">No</th>
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-left font-semibold">項目名</th>
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-left font-semibold w-14">仕様</th>
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-right font-semibold w-14">数量</th>
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-left font-semibold w-10">単位</th>
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-right font-semibold w-20">単価</th>
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-right font-semibold w-24">金額</th>
            <th className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-left font-semibold">摘要</th>
          </tr>
        </thead>
        <tbody>
          {row.details.map((d) => (
            <tr key={d.rowNo}>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-center font-mono text-neutral-500">{d.rowNo}</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5">{d.itemName}</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-neutral-500">{d.spec ?? '—'}</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-right font-mono">{d.qty}</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5">{d.unit}</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-right font-mono">{d.unitPrice.toLocaleString()}</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-right font-mono">{d.amount.toLocaleString()}</td>
              <td className="border-b border-neutral-200 dark:border-neutral-800 px-2 py-1.5 text-neutral-500 text-[10px]">
                {d.note ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
