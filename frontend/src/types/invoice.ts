export type InvoiceStatus = "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
export type BillingMethod = "direct_amount" | "percentage" | "item_selection";
export type InvoicePhase = "advance" | "interim" | "partial" | "final" | "none";
export type DeductionType = "safety_fee" | "materials_advance" | "parking_fee" | "statutory_welfare" | "other";

export const DEDUCTION_LABEL: Record<DeductionType, string> = {
  safety_fee: "安全協力会費",
  materials_advance: "材料費立替",
  parking_fee: "駐車場代",
  statutory_welfare: "法定福利費",
  other: "その他",
};

export interface InvoiceDeductionRead {
  id: string;
  invoice_id: string;
  deduction_type: DeductionType;
  description: string | null;
  amount: number;
  calculation_rate: number | null;
  account_hint: string | null;
  is_deleted: boolean;
  row_no: number;
  created_at: string;
}

export interface ProgressSummaryResponse {
  contract_amount: number | null;
  cumulative_billed: number;
  current_purchase: number | null;
  outstanding_contract: number | null;
  progress_percent: number | null;
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "下書き",
  sent: "送付済み",
  paid: "入金済み",
  partially_paid: "一部入金",
  overdue: "支払遅延",
  cancelled: "キャンセル",
};

export const BILLING_METHOD_LABEL: Record<BillingMethod, string> = {
  direct_amount: "金額直接指定",
  percentage: "割合（%）",
  item_selection: "明細選択",
};

export interface InvoiceItemRead {
  id: string;
  row_no: number;
  item_name: string | null;
  amount: number | null;
  remarks: string | null;
  description: string | null;
}

export interface PaymentRead {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  note: string | null;
  target_split_id: string | null;
  created_at: string;
}

export interface InvoiceRead {
  id: string;
  project_id: string;
  invoice_number: string | null;
  issue_date: string | null;
  previous_balance: number | null;
  received_amount: number | null;
  outstanding_balance: number | null;
  current_purchase: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  quote_id: string | null;
  linked_to_quote: boolean;
  status: InvoiceStatus;
  billing_method: BillingMethod | null;
  billing_percentage: number | null;
  billing_note: string | null;
  payment_due_date: string | null;
  split_sequence: number | null;
  split_total: number | null;
  invoice_type: "standalone" | "total" | "split";
  parent_invoice_id: string | null;
  work_description: string | null;
  work_remarks: string | null;
  completion_date: string | null;
  // Phase R-1
  invoice_phase: InvoicePhase;
  project_role_snapshot: string | null;
  contract_amount_snapshot: number | null;
  total_deduction_amount: number;
  final_payable_amount: number;
  deductions: InvoiceDeductionRead[];
  items: InvoiceItemRead[];
  payments: PaymentRead[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceSummary {
  project_id: string;
  invoice_count: number;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  latest_due_date: string | null;
}
