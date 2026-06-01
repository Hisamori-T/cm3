/**
 * Construction Manager v3 — 案件まわりの型定義
 * バックエンド（FastAPI + Pydantic）の schema とミラーする想定。
 */

/** 案件ステータス（7段階） */
export type ProjectStatus =
  | 'quote'     // 見積中
  | 'order'     // 受注
  | 'start'     // 着工
  | 'progress'  // 施工中
  | 'done'      // 完工
  | 'billed'    // 請求済
  | 'paid';     // 入金済

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  quote: '見積中',
  order: '受注',
  start: '着工',
  progress: '施工中',
  done: '完工',
  billed: '請求済',
  paid: '入金済',
};

/** 案件サブナビの各タブが指すリソース */
export type ProjectSubPath =
  | 'detail'
  | 'qcds'
  | 'vendor-quotes'
  | 'quote'
  | 'order'
  | 'acknowledgement'  // 注文請書
  | 'invoice'
  | 'progress'
  | 'history';

/** 案件 — サブナビでバッジ件数を出すための counts 付きヘッダ用 */
export interface ProjectHeader {
  id: string;
  projectNumber: string; // 26-3-014 etc
  name: string;
  status: ProjectStatus;
  client: string;
  counts: Record<ProjectSubPath, number>;
}

/** 取決見通表 — 業者ごとのグロス行 */
export interface AgreementRow {
  id: string;
  rowNo: number;
  vendor: {
    id: string;
    name: string;
    location?: string;
  };
  trade: string;             // 工種
  agreementAmount: number;   // 取決金額
  requested: boolean;        // 取決伺の提出
  monthlyPayments: Record<string, number | null>; // { "2026-04": 330000, ... }
  paidTotal: number;
  remaining: number;
  isPaid: boolean;
  details: AgreementDetail[]; // アコーディオン展開時の明細
}

/** 取決見通表のアコーディオン明細 (スキャン由来 or 手入力) */
export interface AgreementDetail {
  rowNo: number;
  itemName: string;
  spec: string | null;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
  note?: string;
  source: 'scan' | 'manual';
  confidence?: number;       // 0..1 (source === 'scan' のとき)
}
