/**
 * Construction Manager v3 — スキャン解析まわりの型
 */

/** ジョブのステータス */
export type ScanJobStatus =
  | 'pending'      // 解析待ち
  | 'processing'   // 解析中
  | 'review'       // 解析完了・レビュー待ち
  | 'transferred'  // 転記完了
  | 'failed';

export interface ScanJob {
  id: string;
  filename: string;
  fileFormat: 'pdf' | 'image' | 'xlsx';
  uploadedAt: string;
  uploadedBy: string;
  vendorName: string | null;     // OCR/AIで抽出された業者名候補
  linkedProjectId: string | null;
  status: ScanJobStatus;
  progressPercent: number;       // 0..100
  confidence: number;            // 0..1 全体信頼度
  totalAmount: number | null;
  itemCount: number;
  deletedAt: string | null;      // 論理削除
}

/** スキャン結果の構造化データ（S12 レビュー画面で編集する対象） */
export interface ScanResult {
  jobId: string;
  header: {
    vendorName: string;
    vendorTaxId?: string;        // T9210001XXXXXX
    quoteNumber: string;
    quoteDate: string;
    subject: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    deliveryPeriod?: string;
    paymentTerms?: string;
    remarks?: string;
    // 各フィールドの信頼度
    confidences: Record<string, number>;
  };
  items: ScanResultItem[];
}

export interface ScanResultItem {
  rowNo: number;
  itemName: string;
  spec: string | null;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
  confidence: number; // 0..1
  edited: boolean;    // ユーザーが手で直したか
}

/** 転記先の選択肢（複数選択可） */
export type TransferTarget =
  | 'qcds-direct'         // QCDS A-1 外注 / A-2 資材
  | 'agreement-table'     // 取決見通表
  | 'customer-quote'      // 顧客向け見積書 内訳候補
  | 'vendor-master';      // 業者マスタへ単価保存

export interface TransferRequest {
  jobId: string;
  targetProjectId: string;
  targets: TransferTarget[];
}
