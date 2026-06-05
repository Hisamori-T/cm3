/** 認証・ユーザー関連の型定義。 */

export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "staff"
  | "legacy"
  | "accounting"
  | "member";

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "システム管理者",
  admin: "管理者",
  manager: "上長",
  staff: "現場・営業",
  legacy: "Excel専用",
  accounting: "経理担当",
  member: "一般",
};

export const ROLE_COLOR: Record<UserRole, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  manager: "bg-cyan-100 text-cyan-800",
  staff: "bg-green-100 text-green-800",
  legacy: "bg-gray-100 text-gray-600",
  accounting: "bg-orange-100 text-orange-800",
  member: "bg-gray-100 text-gray-600",
};

export interface User {
  id: string;
  email: string;
  full_name: string;
  employee_number: number | null;
  role: UserRole;
  roles: UserRole[];
  department: string | null;
  is_active: boolean;
  stamp_text: string | null;
  stamp_style: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
