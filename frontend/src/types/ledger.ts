export interface LedgerApprovalRead {
  id: string;
  role_label: string;
  approver_id: string | null;
  approver_name: string | null;
  approved_at: string | null;
  comment: string | null;
  display_order: number;
}

export interface LedgerDirectWorkRead {
  id: string;
  row_no: number;
  vendor_name: string | null;
  work_type: string | null;
  budget_amount: number | null;
  agreed_amount: number | null;
  settlement_amount: number | null;
  agreement_checked: boolean;
  payment_completed: boolean;
  monthly_payments: Record<string, number | null>;
  note: string | null;
}

export interface LedgerExpenseItemRead {
  item_name: string;
  amount: number | null;
  section: string;
}

export interface LedgerCostSummary {
  direct_cost_budget: number;
  direct_cost_agreed: number;
  direct_cost_settlement: number;
  site_overhead_total: number;
  construction_dept_overhead: number;
  general_admin_cost: number;
  operating_profit: number;
  operating_profit_rate: number;
  target_operating_profit: number;
}

export interface LedgerResponse {
  project_id: string;
  project_number: string;
  project_name: string;
  project_location: string | null;
  client_name: string | null;
  original_client_name: string | null;
  project_summary: string | null;
  payment_condition: string | null;
  period_quote_start: string | null;
  period_quote_end: string | null;
  period_contract_start: string | null;
  period_contract_end: string | null;
  period_actual_start: string | null;
  period_actual_end: string | null;
  prev_construction_type: string | null;
  prev_construction_year: number | null;
  prev_construction_other: string | null;
  prev_construction_self: boolean | null;
  sales_person_name: string | null;
  construction_person_name: string | null;
  project_price: number | null;
  quote_number: string | null;
  quote_issue_date: string | null;
  quote_total_amount: number | null;
  award_date: string | null;
  information_history: string | null;
  client_requirements: string | null;
  target_profit_rate: number | null;
  target_profit_amount: number | null;
  cost_summary: LedgerCostSummary | null;
  direct_works: LedgerDirectWorkRead[];
  expense_items: LedgerExpenseItemRead[];
  approvals: LedgerApprovalRead[];
}
