/** QCDS関連の型定義。 */

export type QCDSCategory = "subcontract" | "material" | "other";
export type ExpenseSection = "B_site" | "B_dept" | "C";

export interface ExpenseItemInput {
  id?: string;
  section: ExpenseSection;
  row_no: number;
  system_key?: string | null;
  item_name: string;
  formula_description?: string | null;
  amount_override?: number | null;
  is_custom?: boolean;
}

export interface ExpenseItemRead {
  id: string;
  qcds_id: string;
  section: ExpenseSection;
  row_no: number;
  system_key: string | null;
  item_name: string;
  formula_description: string | null;
  amount_override: number | null;
  is_custom: boolean;
}

export const CATEGORY_LABEL: Record<QCDSCategory, string> = {
  subcontract: "外注",
  material: "資材",
  other: "その他",
};

export interface DirectWorkInput {
  row_no: number;
  work_type?: string | null;
  vendor_id?: string | null;
  vendor_name_snapshot?: string | null;
  category?: QCDSCategory | null;
  budget_amount?: number | null;
  agreed_amount?: number | null;
  settlement_amount?: number | null;
  agreement_checked?: boolean;
  payment_month_4?: number | null;
  payment_month_5?: number | null;
  payment_month_6?: number | null;
  payment_month_7?: number | null;
  payment_month_8?: number | null;
  payment_month_9?: number | null;
  payment_month_10?: number | null;
  payment_month_11?: number | null;
  payment_month_12?: number | null;
  payment_month_1?: number | null;
  payment_month_2?: number | null;
  payment_month_3?: number | null;
  payment_completed?: boolean;
  note?: string | null;
}

export interface DirectWorkRead extends DirectWorkInput {
  id: string;
  vendor_name?: string | null;
  source_scan_result_id?: string | null;
}

export interface QCDSInput {
  revision?: number;
  spare_cost?: number | null;
  industrial_waste_cost?: number | null;
  labor_insurance_rate?: number;
  construction_insurance_rate?: number;
  special_insurance_rate?: number;
  office_supplies?: number;
  communication_cost?: number;
  misc_cost?: number;
  site_staff_salary_rate?: number;
  common_overhead_rate?: number | null;
  shared_overhead_rate?: number;
  general_admin_rate?: number;
  target_operating_profit_rate?: number;
  actual_site_personnel_cost?: number | null;
  direct_works?: DirectWorkInput[];
  expense_items?: ExpenseItemInput[] | null;
}

export interface QCDSCalcFields {
  direct_cost_budget: number;
  direct_cost_agreed: number;
  direct_cost_settlement: number;
  labor_insurance: number;
  construction_insurance: number;
  stamp_cost: number;
  receipt_cost: number;
  special_insurance: number;
  site_personnel_cost: number;
  fixed_overhead: number;
  site_overhead_total: number;
  construction_cost_total: number;
  construction_dept_overhead: number;
  shared_overhead: number;
  total_cost: number;
  general_admin_cost: number;
  operating_profit: number;
  operating_profit_rate: number;
  target_operating_profit: number;
}

export interface QCDSResponse {
  id: string;
  project_id: string;
  revision: number;
  spare_cost: number | null;
  industrial_waste_cost: number | null;
  labor_insurance_rate: number;
  construction_insurance_rate: number;
  special_insurance_rate: number;
  office_supplies: number;
  communication_cost: number;
  misc_cost: number;
  site_staff_salary_rate: number;
  common_overhead_rate: number | null;
  shared_overhead_rate: number;
  general_admin_rate: number;
  target_operating_profit_rate: number;
  actual_site_personnel_cost: number | null;
  created_at: string;
  updated_at: string;
  direct_works: DirectWorkRead[];
  expense_items: ExpenseItemRead[];
  calc: QCDSCalcFields;
}
