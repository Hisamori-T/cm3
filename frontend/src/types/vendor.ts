/** 業者マスタ関連の型定義。 */

export interface VendorCreate {
  vendor_name: string;
  vendor_name_kana?: string | null;
  primary_work_types?: string[] | null;
  postal_code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
  bank_info?: string | null;
  note?: string | null;
}

export interface VendorUpdate {
  vendor_name?: string | null;
  vendor_name_kana?: string | null;
  primary_work_types?: string[] | null;
  postal_code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
  bank_info?: string | null;
  note?: string | null;
  is_active?: boolean | null;
}

export interface VendorListItem {
  id: string;
  vendor_name: string;
  vendor_name_kana: string | null;
  primary_work_types: string[] | null;
  phone: string | null;
  contact_person: string | null;
  is_active: boolean;
  created_at: string;
}

export interface VendorDetail extends VendorListItem {
  postal_code: string | null;
  address: string | null;
  email: string | null;
  bank_info: string | null;
  note: string | null;
  updated_at: string;
}

export interface VendorListResponse {
  items: VendorListItem[];
  total: number;
  page: number;
  per_page: number;
}

export type PriceHistorySource = "scan" | "manual" | "import";

export interface PriceHistoryRead {
  id: string;
  vendor_id: string;
  vendor_name: string | null;
  project_id: string | null;
  item_name: string;
  item_spec: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  quoted_at: string | null;
  source: PriceHistorySource;
  created_at: string;
}

export interface PriceHistoryListResponse {
  items: PriceHistoryRead[];
  total: number;
}
