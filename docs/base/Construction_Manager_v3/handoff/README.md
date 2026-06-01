# Construction Manager v3 — Claude Code 向けハンドオフ

このディレクトリは、Claude Design で作ったプロトタイプを Claude Code（Cursor / VSCode）で実装するためのソース一式です。

## スタック前提
- **Next.js 14**（App Router）
- **TypeScript** strict mode
- **Tailwind CSS** + **shadcn/ui** + **Recharts** + **Lucide React** + **dnd-kit**
- 配色・トークンは `frontend/src/styles/tokens.css` に集約（プロトタイプの `assets/tokens.css` をそのまま移植する想定）

## このバンドルの中身

```
handoff/
├── README.md                          ← このファイル
├── tailwind.config.ts                 ← クラップ配色 + status カラーをTailwind tokenに登録
├── tokens.css                         ← グローバルCSS変数（assets/tokens.css と同一）
├── types/
│   ├── project.ts                     ← 案件・QCDS・取決見通表の型
│   ├── scan.ts                        ← スキャンジョブ・抽出結果の型
│   └── order.ts                       ← 注文書・ステータスの型
├── app/
│   ├── projects/[id]/layout.tsx       ← 案件サブナビ共通レイアウト（新規）
│   ├── projects/[id]/order/page.tsx   ← 注文書画面（改修）
│   ├── scan/page.tsx                  ← スキャン一覧 + 一括操作（改修）
│   └── scan/[id]/page.tsx             ← スキャン編集 + デカい案件選択（改修）
└── components/
    ├── project/ProjectSubNav.tsx      ← 案件サブナビ（新規）
    ├── project/ProjectStatusBadge.tsx
    ├── qcds/AgreementTable.tsx        ← 取決見通表（業者ごとアコーディオン）
    ├── scan/BulkActionBar.tsx
    ├── scan/JobRow.tsx
    ├── scan/ProjectPickerCard.tsx     ← デカい案件選択カード
    └── order/OrderStatusDropdown.tsx
```

## API 想定（バックエンド側、参考）

```
GET    /api/v1/projects/{id}                      案件詳細
GET    /api/v1/projects/{id}/agreements           取決見通表（業者単位ネスト）
GET    /api/v1/projects/{id}/orders               注文書一覧
GET    /api/v1/orders/{id}
PATCH  /api/v1/orders/{id}/status                 ステータス変更
POST   /api/v1/orders/{id}/acknowledgement        注文請書ドラフト作成

GET    /api/v1/scan/jobs                          スキャンジョブ一覧
GET    /api/v1/scan/jobs/{id}
DELETE /api/v1/scan/jobs                          一括削除（IDs配列を body で送る）
POST   /api/v1/scan/jobs/bulk-transfer            一括転記（target_project_id + targets[]）
POST   /api/v1/scan/jobs/{id}/transfer            個別転記
```

## 不足する shadcn/ui コンポーネント

以下を追加してください：

```bash
npx shadcn@latest add button input select dropdown-menu dialog \
    sheet table tabs badge card toast checkbox \
    command popover separator avatar accordion
```

## 新規必要ライブラリ

```bash
pnpm add cmdk             # 案件検索ピッカー用（shadcn/ui の Command の依存）
pnpm add sonner           # トースト（shadcn/ui の Toast の上位互換、推奨）
```

`dnd-kit` / `recharts` / `lucide-react` は既存で OK。

## 配色（Tailwind 拡張）

`tailwind.config.ts` 側で次のように使えるようにしています：

```ts
colors: {
  brand: {
    DEFAULT: '#1B2A52',  // クラップネイビー
    hover: '#2A3A6B',
    50: '#EEF1F8',
    100: '#DCE2F0',
  },
  accent: { DEFAULT: '#0E7C7B', hover: '#0B6968' },
  stamp: '#C00000',
  status: {
    quote:    '#9CA3AF',  // 見積中
    order:    '#3B82F6',  // 受注
    start:    '#06B6D4',  // 着工
    progress: '#F59E0B',  // 施工中
    done:     '#10B981',  // 完工
    billed:   '#8B5CF6',  // 請求済
    paid:     '#059669',  // 入金済
  },
  // 注文書ステータス
  order: {
    draft:        '#6B7280',
    sent:         '#3B82F6',
    signed:       '#F59E0B',
    acknowledged: '#10B981',
    cancelled:    '#C00000',
  },
}
```

## 作業順序の推奨

1. **tailwind.config.ts と tokens.css を入れる**（既存の Tailwind と統合）
2. **types/** を `frontend/src/types/` へ配置
3. **`app/projects/[id]/layout.tsx` + `ProjectSubNav.tsx`** を入れる（最重要）
   - すべての案件サブ画面が共通ヘッダ + サブナビを持つようになる
4. 各画面（注文書／スキャン一覧／スキャン編集／取決見通表）を順に置き換え
5. API 呼び出しを実装側で繋ぎ込み（コメントの「ここで GET /api/v1/...」を実装）

## 既存デザインシステムとの整合

- **本ファイル群は前回セッション（Phase 1〜3）のデザイントークンと完全に整合**
- 角丸は最大 `rounded-md`（6px）または `rounded-lg`（8px）。`rounded-2xl` 以上は使わない
- 余白：カード `p-4`（16px）、テーブルセル `px-3 py-2`
- フォント：本文 `text-sm`（14px）、数値・工事番号は `font-mono`
- 印影色：`#C00000` のみ（他UIには使わない）
- 「承認」「印影」「差戻し」関連の状態は既存 `quote.html` / `approval-modal.html` を参照

## ⚠️ 帳票レイアウトに関する重要注意

**見積書 / 注文書 / 請求書 のレイアウトは、ユーザー（株式会社クラップ）が提出した
Excel で作成された本来のレイアウトと内容を重視してください。レイアウト変更は
してはいけません。**

- 添付された Excel テンプレートが「正」のレイアウト。Web 画面側でこれを変更する提案・
  改変は不可。
- 列構成・行構成・印影枠の位置・項目名・見出しの字間など、可能な限り原本を踏襲する。
- 画面側 UI（編集 UX）と帳票出力（PDF/Excel）は別物として扱う：
  - 画面 UI は本デザインシステム（shadcn/ui）に従う
  - 帳票出力は原本テンプレートに値を埋める方式（openpyxl）。スタイルは触らない
- PDF 出力（WeasyPrint）の HTML テンプレートも、原本 Excel の見た目を**再現**する
  ことが目標であり、勝手に「モダン化」しない。

ハンドオフに含まれる `print/quote-cover.html` `print/order.html` `print/invoice.html`
は参考実装。実装時は **必ず原本 Excel と並べて確認** すること。

---

## してはいけないこと（再掲）
- 新規にデザインシステムを構築すること
- 角丸を `rounded-2xl` 以上にすること
- 配色を独自追加すること（必要なら本番にトークン追加 PR を別途）
- **Excel テンプレートのスタイル変更**
- **帳票レイアウト（見積書・注文書・請求書）の Excel 原本からの逸脱**
