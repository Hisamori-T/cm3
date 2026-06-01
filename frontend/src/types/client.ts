/** 顧客マスタ関連の型定義。 */

export type ClientRank = "A" | "B" | "C";

export interface ClientCreate {
  client_code?: string | null;
  client_name: string;
  client_name_kana?: string | null;
  postal_code?: string | null;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  representative?: string | null;
  client_rank?: ClientRank | null;
  payment_condition_default?: string | null;
  credit_limit?: number | null;
  tax_id?: string | null;
  is_active?: boolean;
  note?: string | null;
}

export interface ClientUpdate {
  client_code?: string | null;
  client_name?: string | null;
  client_name_kana?: string | null;
  postal_code?: string | null;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  representative?: string | null;
  client_rank?: ClientRank | null;
  payment_condition_default?: string | null;
  credit_limit?: number | null;
  tax_id?: string | null;
  is_active?: boolean | null;
  note?: string | null;
}

export interface ClientListItem {
  id: string;
  client_code: string | null;
  client_name: string;
  client_name_kana: string | null;
  client_rank: ClientRank | null;
  phone: string | null;
  is_active: boolean;
  site_count: number;
  project_count: number;
  created_at: string;
}

export interface ClientListResponse {
  items: ClientListItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface ClientDetail extends ClientListItem {
  postal_code: string | null;
  address: string | null;
  fax: string | null;
  email: string | null;
  representative: string | null;
  payment_condition_default: string | null;
  credit_limit: number | null;
  tax_id: string | null;
  note: string | null;
  updated_at: string;
}

export interface ClientSiteCreate {
  site_code?: string | null;
  site_name: string;
  region?: string | null;
  postal_code?: string | null;
  address?: string | null;
  site_manager?: string | null;
  site_phone?: string | null;
  note?: string | null;
}

export interface ClientSiteRead {
  id: string;
  client_id: string;
  site_code: string | null;
  site_name: string;
  region: string | null;
  postal_code: string | null;
  address: string | null;
  site_manager: string | null;
  site_phone: string | null;
  note: string | null;
  created_at: string;
}

export interface ClientContactCreate {
  client_site_id?: string | null;
  department?: string | null;
  name: string;
  name_kana?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  is_primary?: boolean;
  note?: string | null;
}

export interface ClientContactRead {
  id: string;
  client_id: string;
  client_site_id: string | null;
  department: string | null;
  name: string;
  name_kana: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  note: string | null;
  created_at: string;
}
