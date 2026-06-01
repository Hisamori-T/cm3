/**
 * Construction Manager v3 — 注文書まわりの型
 */

/** 注文書のステータス（5段階） */
export type OrderStatus =
  | 'draft'         // 下書き
  | 'sent'          // 送付済
  | 'signed'        // 先方押印済
  | 'acknowledged'  // 受領済（注文請書発行済）
  | 'cancelled';    // キャンセル

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'draft（下書き）',
  sent: 'sent（送付済）',
  signed: 'signed（先方押印済）',
  acknowledged: 'acknowledged（受領済）',
  cancelled: 'cancelled（キャンセル）',
};

/** 注文書本体 */
export interface Order {
  id: string;
  orderNumber: string;          // 26-OR-014-01
  projectId: string;
  vendorId: string;
  subject: string;
  workLocation: string;
  deliveryFrom: string;
  deliveryTo: string;
  paymentTerms: string;
  paymentSite?: string;
  remarks?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;          // 税込
  stampTaxAmount: number;       // 印紙税自動算定
  status: OrderStatus;

  // 承認関連
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  currentApprovalRequestId: string | null;

  // ステータス変化のタイムスタンプ
  sentAt: string | null;
  signedAt: string | null;
  acknowledgedAt: string | null;
  cancelledAt: string | null;

  // 注文請書（acknowledgement）が発行されているか
  acknowledgementId: string | null;
}

export interface OrderItem {
  rowNo: number;
  itemName: string;
  spec: string | null;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
}
