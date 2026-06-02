export type OrderStatus = "draft" | "sent" | "signed" | "acknowledged" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "下書き",
  sent: "発行済み",
  signed: "サイン受領済",
  acknowledged: "注文請書発行済",
  cancelled: "キャンセル",
};

export interface OrderCreate {
  issue_date?: string | null;
  client_address?: string | null;
  client_company?: string | null;
  client_person?: string | null;
  amount_excl_tax?: number | null;
  construction_period_start?: string | null;
  construction_period_end?: string | null;
  payment_condition?: string | null;
  work_content?: string | null;
  notes?: string | null;
  terms_and_conditions?: string | null;
}

export interface OrderRead {
  id: string;
  project_id: string;
  order_number: string | null;
  issue_date: string | null;
  client_address: string | null;
  client_company: string | null;
  client_person: string | null;
  amount_excl_tax: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  construction_period_start: string | null;
  construction_period_end: string | null;
  payment_condition: string | null;
  work_content: string | null;
  notes: string | null;
  terms_and_conditions: string | null;
  stamp_tax: number | null;
  quote_id: string | null;
  linked_to_quote: boolean;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}
