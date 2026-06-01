/**
 * Construction Manager v3 — 注文書画面
 *
 * frontend/src/app/projects/[id]/order/page.tsx
 *
 * /projects/[id]/layout.tsx の中で動く前提（案件サブナビは layout が表示）。
 *
 * 改修ポイント：
 *   - 上部にステータスバッジ + ドロップダウン（OrderStatusDropdown）
 *   - 右上に [PDF出力] [Excel出力] ボタン
 *   - ステータスが 'signed' のとき [注文請書を発行] 緑ボタン表示
 *   - 押下 → POST /api/v1/orders/{id}/acknowledgement → 注文請書画面へ遷移
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FileText, Download, FilePlus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OrderStatusDropdown } from '@/components/order/OrderStatusDropdown';
import type { Order, OrderStatus } from '@/types/order';

/**
 * デモ用のフェッチャ。本実装は SWR / TanStack Query / RSC のいずれかに置き換え。
 */
function useOrder(projectId: string, orderId: string) {
  // ここで GET /api/v1/orders/{id}
  const [order, setOrder] = useState<Order | null>(/* server-fetched */ null);
  return { order, setOrder };
}

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const orderId = search.get('orderId') ?? 'latest';

  const { order, setOrder } = useOrder(params.id, orderId);
  const [issuingAck, setIssuingAck] = useState(false);

  if (!order) return <div className="p-6 text-sm text-neutral-500">読み込み中…</div>;

  const exportPdf = async () => {
    // ここで GET /api/v1/orders/{id}/pdf （ブラウザでダウンロード）
    window.open(`/api/v1/orders/${order.id}/pdf`, '_blank');
  };
  const exportExcel = async () => {
    // ここで GET /api/v1/orders/{id}/excel
    window.location.href = `/api/v1/orders/${order.id}/excel`;
  };

  /** 注文請書を発行（status === 'signed' のときのみ表示する緑ボタンから呼ぶ） */
  const issueAcknowledgement = async () => {
    setIssuingAck(true);
    try {
      // ここで POST /api/v1/orders/{id}/acknowledgement
      const res = await fetch(`/api/v1/orders/${order.id}/acknowledgement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('failed');
      const ack = await res.json();
      toast.success('注文請書ドラフトを生成しました', {
        action: {
          label: '注文請書を開く →',
          onClick: () => router.push(`/projects/${params.id}/acknowledgement?id=${ack.id}`),
        },
      });
      // ステータスを acknowledged に進める
      setOrder({ ...order, status: 'acknowledged', acknowledgementId: ack.id });
      router.push(`/projects/${params.id}/acknowledgement?id=${ack.id}`);
    } catch (e) {
      toast.error('注文請書の発行に失敗しました');
    } finally {
      setIssuingAck(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* === Order hero === */}
      <div className="rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800">
        <div className="flex items-center gap-4 p-4">
          <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-500">
            {order.orderNumber}
          </span>
          <div>
            <h2 className="text-base font-bold">{order.subject}</h2>
            <p className="text-xs text-neutral-500">
              {/* TODO: vendor name from /api/v1/vendors/{id} */}
              福井配管工業 株式会社 · 工期 {order.deliveryFrom} 〜 {order.deliveryTo}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <OrderStatusDropdown
              orderId={order.id}
              status={order.status}
              onChange={(next) => setOrder({ ...order, status: next })}
            />

            <div className="mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

            <Button variant="outline" size="sm" onClick={exportPdf}>
              <FileText className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.6} />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.6} />
              Excel
            </Button>

            {/* ステータスが signed のときのみ「注文請書を発行」緑ボタンを出す */}
            {order.status === 'signed' && (
              <Button
                size="sm"
                onClick={issueAcknowledgement}
                disabled={issuingAck}
                className="bg-status-done hover:bg-status-done/90 text-white"
              >
                <FilePlus className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.6} />
                注文請書を発行
              </Button>
            )}
          </div>
        </div>

        {/* Status timeline (前回デザイン .ord-timeline) — 詳細は実装側で */}
        {/* <OrderStatusTimeline order={order} /> */}
      </div>

      {/* === ボディ：発注先 / 件名 / 明細 / 注文条件 ===
          前回デザイン screens/order.html を参照して shadcn/ui Card で組む。
          - 発注先カード（業者リンク + 担当者 + 登録番号 + 件名 + 工事場所 + 納期 + 支払条件 + 備考）
          - 明細テーブル（編集モード時のみインライン編集）
          - 注文条件（基本契約約款テンプレートから挿入）
       */}
      <OrderBody order={order} onEdit={() => router.push(`?orderId=${order.id}&edit=1`)} />

      {/* === Right rail: 合計 + 印紙税 + signed 時の発行カード + アクティビティ === */}
      {/* 詳細は handoff/screens/order.html を参照 */}
    </div>
  );
}

function OrderBody({ order, onEdit }: { order: Order; onEdit: () => void }) {
  // 実装側で展開。プレースホルダ。
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-sm text-neutral-500">
      [発注先 / 明細 / 注文条件 のボディ — screens/order.html を参照]
      <Button variant="outline" size="sm" className="ml-3" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5 mr-1" />編集
      </Button>
    </div>
  );
}
