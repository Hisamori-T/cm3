/** 見積書関連の型定義。 */

export type QuoteStatus = "draft" | "issued";

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "下書き",
  issued: "発行済",
};

export interface QuoteItemInput {
  row_no: number;
  item_name?: string | null;
  spec?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  remarks?: string | null;
}

export interface QuoteItemRead extends QuoteItemInput {
  id: string;
  amount?: number | null;
}

export interface QuoteCreate {
  quote_number?: string | null;
  issue_date?: string | null;
  validity_days?: number;
  project_name_snapshot?: string | null;
  project_location_snapshot?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  payment_condition?: string | null;
  remarks?: string | null;
  conditions_text?: string | null;
  approver_id?: string | null;
  reviewer_id?: string | null;
  person_in_charge_id?: string | null;
  items: QuoteItemInput[];
}

export type QuoteUpdate = QuoteCreate;

export interface QuoteListItem {
  id: string;
  quote_number: string | null;
  issue_date: string | null;
  status: QuoteStatus;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  created_at: string;
}

export interface QuoteDetail {
  id: string;
  project_id: string;
  quote_number: string | null;
  issue_date: string | null;
  validity_days: number;
  project_name_snapshot: string | null;
  project_location_snapshot: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_condition: string | null;
  remarks: string | null;
  conditions_text: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  approver_id: string | null;
  reviewer_id: string | null;
  person_in_charge_id: string | null;
  status: QuoteStatus;
  created_at: string;
  updated_at: string;
  items: QuoteItemRead[];
}
