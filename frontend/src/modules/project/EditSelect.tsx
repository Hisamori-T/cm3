/**
 * 案件詳細ページ用インライン編集セレクト。
 * .k（ラベル）/ .v（選択欄）を fragment で返す。
 * 親要素の CSS グリッドに依存するため、単体で使わないこと。
 *
 * 抽出元: src/app/projects/[id]/page.tsx
 */

interface Option {
  value: string;
  label: string;
}

interface EditSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}

export function EditSelect({ label, value, options, onChange }: EditSelectProps) {
  return (
    <>
      <div className="k">{label}</div>
      <div className="v">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            height: 28,
            width: "100%",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--c-border)",
            background: "var(--c-surface)",
            color: "var(--c-text)",
            padding: "0 8px",
            fontSize: 13,
            outline: "none",
          }}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </>
  );
}
