export type ScanJobStatus = "pending" | "processing" | "succeeded" | "failed" | "reviewed";
export type ScanJobFileType = "pdf" | "image" | "excel";

export const SCAN_STATUS_LABEL: Record<ScanJobStatus, string> = {
  pending: "処理待ち",
  processing: "解析中",
  succeeded: "解析完了",
  failed: "エラー",
  reviewed: "確認済み",
};

export interface ScanResultItem {
  id: string;
  row_no: number;
  item_name: string | null;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  confidence: number | null;
  applied_to_qcds: boolean;
  applied_to_quote: boolean;
}

export interface ScanResult {
  id: string;
  scan_job_id: string;
  vendor_name_detected: string | null;
  vendor_id: string | null;
  quoted_date_detected: string | null;
  subtotal_detected: number | null;
  tax_detected: number | null;
  total_detected: number | null;
  confidence_score: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  items: ScanResultItem[];
}

export interface ScanJob {
  id: string;
  project_id: string | null;
  uploaded_by: string;
  original_file_name: string;
  file_type: ScanJobFileType;
  status: ScanJobStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  vendor_name_detected?: string | null;
  confidence_score?: number | null;
  item_count?: number | null;
  deleted_at?: string | null;
}

export interface ScanJobDetail extends ScanJob {
  results: ScanResult[];
}

export interface ScanResultItemUpdate {
  id: string;
  item_name?: string | null;
  spec?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  amount?: number | null;
}

export interface ScanResultUpdate {
  vendor_name_detected?: string | null;
  vendor_id?: string | null;
  quoted_date_detected?: string | null;
  subtotal_detected?: number | null;
  tax_detected?: number | null;
  total_detected?: number | null;
  items?: ScanResultItemUpdate[];
}

/** BulkActionBar の転記先識別子。 */
export type TransferTarget = "qcds-direct" | "agreement-table" | "customer-quote" | "vendor-estimate";
