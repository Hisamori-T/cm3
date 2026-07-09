/** 案件（Project）関連の型定義。 */

export type ProjectStatus =
  | "draft"
  | "submitted"
  | "won"
  | "lost";

// Phase R-1: 案件立場
export type ProjectRole = "prime" | "sub";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft:     "作成中",
  submitted: "提出済",
  won:       "受注",
  lost:      "失注",
};

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  draft:     "#94a3b8",
  submitted: "#3b82f6",
  won:       "#22c55e",
  lost:      "#ef4444",
};

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  prime: "元請",
  sub: "下請",
};

export const PROJECT_ROLE_COLOR: Record<ProjectRole, string> = {
  prime: "#1d4ed8",
  sub: "#ea580c",
};

export interface ProjectListItem {
  id: string;
  project_number: string;
  project_name: string;
  client_name: string | null;
  status: ProjectStatus;
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
  project_location: string | null;
  status: ProjectStatus;
  project_summary: string | null;
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
  created_at: string;
  updated_at: string;
  quote_count: number;
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
  project_location?: string | null;
  project_role?: ProjectRole | null;
  project_summary?: string | null;
  client_contact_company?: string | null;
  client_contact_person?: string | null;
  client_contact_phone?: string | null;
  sales_person_id?: string | null;
  construction_person_id?: string | null;
  project_price?: number | null;
  period_quote_start?: string | null;
  period_quote_end?: string | null;
}
