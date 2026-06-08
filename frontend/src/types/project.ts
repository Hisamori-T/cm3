/** 案件（Project）関連の型定義。 */

export type ProjectStatus =
  | "quote"
  | "ordered"
  | "started"
  | "in_progress"
  | "completed"
  | "billed"
  | "paid";

export type OrderType = "private" | "government";
export type ContractType = "prime" | "sub";
export type AwardingType = "special" | "competitive";
export type PrevConstructionType = "own" | "other" | "none";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  quote: "見積中",
  ordered: "受注",
  started: "着工",
  in_progress: "施工中",
  completed: "完工",
  billed: "請求済",
  paid: "入金済",
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  private: "民間",
  government: "官庁",
};

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  prime: "元請",
  sub: "下請",
};

export const AWARDING_TYPE_LABEL: Record<AwardingType, string> = {
  special: "特命",
  competitive: "競争",
};

export const PREV_CONSTRUCTION_LABEL: Record<PrevConstructionType, string> = {
  own: "当社",
  other: "他社",
  none: "なし",
};

// Phase R-1: 案件立場
export type ProjectRole = "prime" | "sub" | "public";

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  prime: "元請",
  sub: "下請",
  public: "公共",
};

export const PROJECT_ROLE_COLOR: Record<ProjectRole, string> = {
  prime: "#1d4ed8",
  sub: "#ea580c",
  public: "#16a34a",
};

export interface ProjectListItem {
  id: string;
  project_number: string;
  project_name: string;
  client_name: string | null;
  status: ProjectStatus;
  order_type: OrderType | null;
  contract_type: ContractType | null;
  project_role: ProjectRole | null;
  project_price: number | null;
  sales_person_name: string | null;
  construction_person_name: string | null;
  created_at: string;
}

export interface ProjectListResponse {
  items: ProjectListItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface ProjectCreate {
  project_name: string;
  project_number?: string;
  client_name?: string;
  project_location?: string;
  order_type?: OrderType;
  contract_type?: ContractType;
  sales_person_id?: string;
  construction_person_id?: string;
  project_price?: number;
}

export interface ProjectDetail {
  id: string;
  project_number: string;
  project_name: string;
  client_name: string | null;
  client_id: string | null;
  client_site_id: string | null;
  original_client_name: string | null;
  project_location: string | null;
  status: ProjectStatus;
  order_type: OrderType | null;
  contract_type: ContractType | null;
  awarding_type: AwardingType | null;
  payment_condition: string | null;
  project_summary: string | null;
  prev_construction_type: PrevConstructionType | null;
  prev_construction_year: number | null;
  prev_construction_other: string | null;
  client_contact_company: string | null;
  client_contact_person: string | null;
  client_contact_phone: string | null;
  sales_person_id: string | null;
  sales_person_name: string | null;
  construction_person_id: string | null;
  construction_person_name: string | null;
  created_by: string;
  project_price: number | null;
  project_role: ProjectRole | null;
  period_quote_start: string | null;
  period_quote_end: string | null;
  period_contract_start: string | null;
  period_contract_end: string | null;
  period_actual_start: string | null;
  period_actual_end: string | null;
  created_at: string;
  updated_at: string;
  qcds_count: number;
  quote_count: number;
  order_count: number;
  invoice_count: number;
  progress_log_count: number;
}

/** 案件サブナビ・ProjectPickerCard で使う軽量ヘッダ型。 */
export interface ProjectHeader {
  id: string;
  projectNumber: string;
  name: string;
  status: ProjectStatus;
  client: string;
  counts: Record<string, number>;
}

export interface ProjectUpdate {
  project_name?: string;
  project_number?: string;
  client_name?: string | null;
  client_id?: string | null;
  client_site_id?: string | null;
  original_client_name?: string | null;
  project_location?: string | null;
  order_type?: OrderType | null;
  contract_type?: ContractType | null;
  awarding_type?: AwardingType | null;
  payment_condition?: string | null;
  project_summary?: string | null;
  prev_construction_type?: PrevConstructionType | null;
  prev_construction_year?: number | null;
  prev_construction_other?: string | null;
  client_contact_company?: string | null;
  client_contact_person?: string | null;
  client_contact_phone?: string | null;
  sales_person_id?: string | null;
  construction_person_id?: string | null;
  project_price?: number | null;
  period_quote_start?: string | null;
  period_quote_end?: string | null;
  period_contract_start?: string | null;
  period_contract_end?: string | null;
  period_actual_start?: string | null;
  period_actual_end?: string | null;
}
