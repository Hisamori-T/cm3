export type AcknowledgmentStatus = "draft" | "issued";

export const ACKNOWLEDGMENT_STATUS_LABEL: Record<AcknowledgmentStatus, string> = {
  draft: "下書き",
  issued: "発行済み",
};

export interface AcknowledgmentRead {
  id: string;
  order_id: string;
  project_id: string;
  acknowledgment_number: string | null;
  issue_date: string | null;
  client_address: string | null;
  client_company: string | null;
  client_person: string | null;
  amount_excl_tax: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  stamp_tax: number | null;
  construction_period_start: string | null;
  construction_period_end: string | null;
  payment_condition: string | null;
  terms_and_conditions: string | null;
  status: AcknowledgmentStatus;
  created_at: string;
  updated_at: string;
}
