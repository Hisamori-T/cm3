/**
 * 案件詳細ページ用インライン編集フィールド。
 * .k（ラベル）/ .v（入力欄）を fragment で返す。
 * 親要素の CSS グリッド（.field-grid 等）に依存するため、単体で使わないこと。
 *
 * 抽出元: src/app/projects/[id]/page.tsx
 */

import { Input } from "@/components/ui/input";

interface EditFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}

export function EditField({ label, value, onChange, type = "text" }: EditFieldProps) {
  return (
    <>
      <div className="k">{label}</div>
      <div className="v">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-sm w-full"
        />
      </div>
    </>
  );
}
