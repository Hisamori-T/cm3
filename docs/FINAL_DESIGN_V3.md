# 工事台帳 v3 - 最終設計書（完全統合版）

**作成日**: 2026-05-27
**ステータス**: 最終版
**用途**: この 1 ファイルだけを VS Code Claude Code に投げる

---

## ⚠️ 実装済み変更差分（2026-05-29 更新）

以下の項目は本設計書から変更して実装した。本設計書の該当セクションより優先する。

### §4.2 スキャン転記 → 変更あり
- ADDITIONAL_CHANGES_V1.md の方針で実装済み（業者見積タブ内統合）
- さらに 2026-05-29 時点で「転記」ボタンを廃止
  - 「転記（過去案件コピー）」→ 廃止
  - 「業者マスタから追加」→ **過去単価履歴を自動取込**して版を作成（新設計）
  - 「手動で作成」→ 業者名自由入力で空版を作成（新設計）

### §2.2 QCDSリビジョン管理 → 変更あり
- 「実行予算書確定/改訂実行予算書」の2タブUI → **廃止**
- 常に最新リビジョンを単一表示するシンプルなUIに変更
- バックエンドのリビジョン機能（create_new_revision API）は残存

### Phase 実装状況（2026-05-29 時点）
- Phase 1-A: ✅ 完了
- Phase 1-A'（ADDITIONAL指示書）: ✅ 完了
- Phase 1-B（PDF出力）: ⬜ **次の作業**
- Phase 1-C（権限・請求管理）: ⬜ 未着手

---

## 1. 背景と現状

### 1.1 プロジェクト概要

株式会社クラップ（福井県坂井市）の工事台帳を Excel → Web に移行するプロジェクト。
技術スタック: FastAPI + Next.js 14 + PostgreSQL 16 + Gemini API
デプロイ: WebARENA Indigo VPS + Coolify (Docker Compose)

### 1.2 現在の問題（修正ループに陥っている）

Phase 1 の実装は大部分が完了しているが、以下の問題で修正ループに入っている。

**問題1: スキャン転記が個別行を全展開する**
業者見積スキャン（20行）→ QCDS に 20 行がバラバラに展開される。
本来は「業者ごとに 1 行（合計金額）」で転記すべき。

**問題2: 掛率が反映されない**
業者見積で掛率 1.2 を設定しても、内訳の販売単価が変わらない。
さらに、ある版の掛率を変更すると全版に波及するバグがある。

**問題3: スキャン→QCDS→顧客見積に多重転記される**
スキャンデータが QCDS にも顧客見積にも同時に転記され、データが重複する。

**問題4: 顧客見積の粗利率が常に 100%**
Excel インポートした顧客見積行は cost_price = NULL のため、
粗利計算で原価が 0 扱いになり、粗利率が常に 100% になる。

**問題5: quote_items テーブルが業者見積と顧客見積で兼用**
version_id の有無で区別しているが、フィルタが不安定で修正ループの直接原因。

**問題6: PDF 出力が未実装**
見積書・注文書・注文請書・請求書の Excel 出力はあるが、PDF 出力がない。

### 1.3 修正方針

「修正」ではなく、問題のある部分を「設計し直して再実装」する。
既に動いている機能（認証、案件管理、日報、カンバン等）は触らない。

---

## 2. アーキテクチャ方針の変更

### 2.1 「1 つのアプリ、2 つの入口」設計

```
┌─────────────────────────────────────────────┐
│            Construction Manager v3           │
│                                             │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │  入口A       │    │  入口B              │ │
│  │  Web 作成    │    │  Excel インポート   │ │
│  │  (若い人)    │    │  (高齢者)           │ │
│  └──────┬──────┘    └─────────┬───────────┘ │
│         │                     │             │
│         └──────────┬──────────┘             │
│                    ▼                        │
│         ┌──────────────────┐                │
│         │  共通データベース │                │
│         └────────┬─────────┘                │
│                  ▼                          │
│         ┌──────────────────┐                │
│         │  ダッシュボード   │ ← 全員が見る  │
│         │  通知・アラーム   │                │
│         └──────────────────┘                │
└─────────────────────────────────────────────┘
```

### 2.2 権限ロール

| ロール | 対象者 | 入口 | 権限 |
|--------|--------|------|------|
| admin | 社長・システム管理者 | 全画面 | 全権限 |
| staff | 若い現場・営業 | 入口A（Web作成） | 案件・QCDS・見積書・業者見積スキャン・日報・進捗 |
| legacy | 高齢者 | 入口B（Excelインポート専用） | Excelアップロード・確認画面・閲覧 |
| accounting | 経理 | 注文書・請求書・入金管理 | 注文書・注文請書・請求書発行・入金管理 |

**ログイン後の自動振り分け**:
```
ログイン
  ↓ ユーザーの role を確認
  ↓
  admin → ダッシュボード（全機能メニュー表示）
  staff → ダッシュボード（案件中心のメニュー）
  legacy → Excel インポート専用画面
  accounting → 請求・入金管理画面
```

---

## 3. データベーススキーマの修正

### 3.1 現在のスキーマ（確認済み）

```
quote_versions:
  id, quote_id, version_no, vendor_id, vendor_name_snapshot,
  markup_rate, is_active, notes, created_at, updated_at

quote_items:
  id, quote_id, row_no, item_name, spec,
  unit, quantity, unit_price, amount,
  cost_price, item_markup_rate,
  version_id, section_id,
  source_vendor_id, source_scan_result_id, remarks

quote_sections:
  id, quote_id, section_letter, section_name, row_no, amount
```

### 3.2 修正するカラム

```sql
-- quote_items に追加
-- ※ display_order は追加しない。既存の row_no を表示順序にも使用する
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS
  source_type VARCHAR(20) DEFAULT 'manual';  -- 'manual' / 'import' / 'scan'

-- invoices テーブル（新規）
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  invoice_number VARCHAR(50),           -- 請求書番号
  invoice_date DATE,                    -- 請求日
  due_date DATE,                        -- 入金予定日
  amount DECIMAL(14,2) NOT NULL,        -- 請求額（税抜）
  tax_amount DECIMAL(14,2),             -- 消費税額
  total_amount DECIMAL(14,2),           -- 合計（税込）
  status VARCHAR(20) DEFAULT 'draft',   -- draft/sent/paid/overdue
  payment_received_at TIMESTAMP,        -- 実際の入金日
  payment_amount DECIMAL(14,2),         -- 実際の入金額
  installment_no INT DEFAULT 1,         -- 分割請求の何回目か
  total_installments INT DEFAULT 1,     -- 全何回の分割か
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- invoice_items テーブル（新規）
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  description TEXT NOT NULL,            -- 工事名・備考
  amount DECIMAL(14,2) NOT NULL,
  remarks TEXT
);

-- payment_schedules テーブル（新規：入金予定管理）
CREATE TABLE payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  invoice_id UUID REFERENCES invoices(id),
  scheduled_date DATE NOT NULL,         -- 入金予定日
  expected_amount DECIMAL(14,2),        -- 予定入金額
  actual_date DATE,                     -- 実際の入金日
  actual_amount DECIMAL(14,2),          -- 実際の入金額
  status VARCHAR(20) DEFAULT 'pending', -- pending/received/overdue
  notified_at TIMESTAMP,                -- 通知済み日時
  created_at TIMESTAMP DEFAULT NOW()
);

-- orders テーブルに追加（注文書・注文請書）
-- ※ orders テーブルが存在しない場合は CREATE する。実装時に確認すること。
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS
--   acknowledgement_status VARCHAR(20) DEFAULT 'none';
--   -- none / drafted / sent / received
-- もし orders テーブルが存在しなければ:
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  vendor_id UUID REFERENCES vendors(id),
  order_number VARCHAR(50),
  order_date DATE,
  amount DECIMAL(14,2),
  tax_amount DECIMAL(14,2),
  total_amount DECIMAL(14,2),
  work_name TEXT,
  work_location TEXT,
  work_period TEXT,
  payment_terms TEXT,
  work_content TEXT,
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  acknowledgement_status VARCHAR(20) DEFAULT 'none',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. 修正対象の実装内容

### 4.1 掛率の修正（問題2）

**現在のバグ**: ある版の掛率を変更すると全版に波及する

**原因の推定**: フロント側で `quote_versions` の `markup_rate` を更新する際に、
全版の `markup_rate` を一括更新している可能性がある。

**修正方針**:
- API: `/api/v1/quotes/versions/{version_id}` の PUT で `markup_rate` を更新
- フロント: 版ごとに独立した state を持つ
- 計算: `item_markup_rate` が NULL なら `quote_versions.markup_rate` を使用、
  `item_markup_rate` に値があればそちらを優先

```
掛率の優先順位:
  1. item_markup_rate（品目レベル）が設定されていればそれを使用
  2. 未設定なら quote_versions.markup_rate（版レベル）を使用

販売単価の計算:
  unit_price = cost_price × 適用される掛率
  amount = unit_price × quantity
```

### 4.2 スキャン転記の修正（問題1, 3）

**現在のバグ**: 個別品目が全展開 + QCDS と顧客見積に多重転記

**修正方針**:
- スキャン確認後、転記先を明示的に選択させる
- QCDS 転記時は「業者名 + 合計金額」で 1 行にまとめる
- 顧客見積への転記は別操作（「業者見積から取込」ボタン経由のみ）

```
スキャン → 確認 → 転記先選択ダイアログ
  ├─「QCDS に転記」→ 業者名 + 合計金額で 1 行追加
  └─「業者見積として保存のみ」→ DB に保存、転記はしない

顧客見積への反映は、顧客見積ページの「業者見積から取込」ボタンから行う。
スキャン時に顧客見積に自動転記してはいけない。
```

**API の修正**:

```python
# POST /api/v1/scan/results/{job_id}/transfer-to-qcds
# リクエスト: { qcds_id, section_id }
# 処理:
#   1. スキャン結果の全品目の合計金額を計算
#   2. QCDS の指定セクションに 1 行追加（業者名, 合計金額）
#   3. 顧客見積には何もしない

# POST /api/v1/scan/results/{job_id}/save-as-version
# リクエスト: { project_id }
# 処理:
#   1. スキャン結果を QuoteVersion として保存
#   2. 個別品目を quote_items に保存（version_id 付き）
#   3. QCDS にも顧客見積にも転記しない
```

### 4.3 粗利率 100% 問題の修正（問題4）

**現在のバグ**: quote_items.cost_price = NULL → 原価 0 → 粗利率 100%

**根本原因**: 粗利率の計算元が quote_items.cost_price になっている。
しかし原価の正しいソースは **QCDS（実行予算書）** である。

**修正方針**: 粗利率の計算元を QCDS に変更する

```
粗利率の計算ロジック（修正後）:

  原価 = QCDS の全セクション合計
       = A計（外注取決計 + 資材計 + その他計）
       + B計 + C計 + ... + 経費計
  
  売価 = 顧客見積の合計（税抜）
  
  粗利 = 売価 - 原価
  粗利率 = 粗利 / 売価 × 100

  QCDS が未作成の場合:
    → 「原価未設定（QCDS を作成してください）」と表示
    → 粗利率 100% とは表示しない
```

**実装**:

```python
# backend/app/services/profit_calculator.py

async def calculate_gross_profit(project_id: UUID, db: AsyncSession) -> dict:
    """
    粗利率を計算する
    
    原価 = QCDS の合計（実行予算書が「原価の正」）
    売価 = 顧客見積の合計
    """
    # QCDS から原価を取得
    qcds = await get_qcds_by_project(project_id, db)
    if not qcds:
        return {
            "total_revenue": 0,
            "total_cost": 0,
            "gross_profit": 0,
            "gross_profit_rate": None,  # None = 未設定
            "message": "QCDSを作成してください"
        }
    
    total_cost = qcds.grand_total  # A計 + B計 + C計 + ... + 経費計
    
    # 顧客見積から売価を取得
    quote = await get_customer_quote(project_id, db)
    total_revenue = quote.subtotal if quote else 0  # 税抜合計
    
    if total_revenue == 0:
        return {
            "total_revenue": 0,
            "total_cost": total_cost,
            "gross_profit": 0,
            "gross_profit_rate": None,
            "message": "顧客見積を作成してください"
        }
    
    gross_profit = total_revenue - total_cost
    gross_profit_rate = (gross_profit / total_revenue) * 100
    
    return {
        "total_revenue": total_revenue,
        "total_cost": total_cost,
        "gross_profit": gross_profit,
        "gross_profit_rate": round(gross_profit_rate, 1),
        "message": None
    }
```

**フロント側の表示**:

```
粗利率が計算可能な場合:
  粗利率 24.2%
  原価 ¥5,470,000  粗利 ¥1,730,000

QCDS が未作成の場合:
  粗利率 ---
  原価未設定（QCDSを作成してください）

顧客見積が未作成の場合:
  粗利率 ---
  売価未設定（顧客見積を作成してください）
```

**メリット**:
- Excel インポートでもスキャンでも、QCDS さえあれば粗利率が正しく計算される
- quote_items.cost_price に依存しない（NULL でも問題ない）
- QCDS が「原価の正」という業務実態に合っている

**注意**: quote_items.cost_price は削除しない。
業者見積から取込時に参考情報として保持するが、粗利率計算には使わない。

### 4.4 PDF 出力の実装（問題6）

**方針**: WeasyPrint（HTML → PDF）で既存 Excel のレイアウトを再現

**対象帳票と構成**:

```
見積書 PDF:
  ├─ 表紙（A4 縦）
  │   ├─ 右上: 弊社工事番号、年月日
  │   ├─ タイトル「御　見　積　書」
  │   ├─ 左: 宛先「〇〇 御中」
  │   ├─ 右: CLAP ロゴ + 会社情報
  │   ├─ 見積金額（税込）
  │   ├─ 承認欄（承認・審査・担当の印影枠）
  │   ├─ 工事名称、工事場所、見積有効期限、支払条件、工期、備考
  │   └─ 担当者情報
  ├─ 内訳書（A4 縦、複数ページ）
  │   ├─ ヘッダ: 名称、仕様、単位、数量、単価、金額、摘要
  │   ├─ 大項目（A, B, C...）ごとに明細行
  │   ├─ 出精値引き
  │   ├─ 計、消費税、合計
  │   └─ フッタ: 株式会社クラップ P-n
  └─ 大項目ごとの詳細ページ

請求書 PDF:
  ├─ 右上: 弊社工事番号、年月日
  ├─ タイトル「請　求　書」
  ├─ 宛先「〇〇 御中」
  ├─ CLAP ロゴ + 会社情報 + 登録番号
  ├─ 前月請求額 / 御入金 / 差引残高 / 当月買上額 / 消費税額 / 今回請求額
  ├─ 明細（日付、工事名・備考、金額、摘要）
  ├─ 計、消費税、合計
  └─ 振込先情報

注文書 PDF:
  ├─ 右上: 弊社工事番号、年月日
  ├─ タイトル「注　文　書」
  ├─ 注文内容（工事名称、工事場所、工事代金、消費税、請負代金額）
  ├─ 工事期間、支払条件、工事内容、適要
  └─ 基本契約約款（第1条～第9条）

注文請書 PDF:
  ├─ 注文書と同じレイアウト
  ├─ 「注文請書」タイトル
  └─ 請負者の署名欄
```

**重要な制約**:
- Excel テンプレートのレイアウトを忠実に再現すること
- フォント: Noto Serif CJK JP（明朝体）/ Noto Sans CJK JP（ゴシック体）
  ※ MS 明朝・MS ゴシックは Docker コンテナに入れられないため Noto で代替
  ※ Docker イメージに `fonts-noto-cjk` パッケージをインストールすること
- 印影: 赤丸に名字（#C00000）
- ページ番号: 「株式会社クラップ P-n」形式

### 4.5 請求・入金管理とアラーム機能（新規）

**請求書管理**:
```
案件ページ → 「請求書」タブ
  ├─ 請求書一覧（分割請求対応）
  │   ├─ 第1回 請求: ¥3,000,000 (2026/06/30) [入金済]
  │   ├─ 第2回 請求: ¥2,000,000 (2026/09/30) [発行済]
  │   └─ 第3回 請求: ¥1,500,000 (2026/12/31) [予定]
  ├─ 「請求書を追加」ボタン
  └─ 入金状況の表示
```

**ダッシュボード通知**:
```
通知の仕組み（Phase 1）:
  - ダッシュボードページロード時にオンデマンドで計算
  - notifications テーブルは不要（DB から直接クエリ）
  - 将来（Phase 2）で Celery Beat + notifications テーブル + Slack/メール通知

計算ロジック:
  SELECT * FROM invoices WHERE status = 'sent' AND due_date <= NOW() + INTERVAL '7 days'
  → 請求書発行アラーム

  SELECT * FROM payment_schedules WHERE status = 'pending' AND scheduled_date <= NOW() + INTERVAL '3 days'
  → 入金予定アラーム

  SELECT * FROM payment_schedules WHERE status = 'pending' AND scheduled_date < NOW()
  → 入金遅延警告

通知種別:
  1. 請求書発行アラーム
     → 請求予定日の 7 日前に通知
     → 「〇〇案件の第2回請求書を発行してください」

  2. 入金予定アラーム
     → 入金予定日の 3 日前に通知
     → 「〇〇案件の入金予定日が近づいています（¥2,000,000）」

  3. 入金遅延警告
     → 入金予定日を過ぎても入金がない場合に通知
     → 「〇〇案件の入金が予定日（6/30）を過ぎています」

表示場所:
  ├─ ダッシュボード上部にベル型通知アイコン
  ├─ ダッシュボードのカード（赤色ハイライト）
  └─ 将来: Slack/メール通知（Phase 2）
```

**入金管理**:
```
入金管理画面（経理アカウント用）:
  ├─ 入金予定一覧（期日順ソート）
  │   ├─ 〇〇案件 ¥3,000,000 予定:6/30 [入金済 6/28]
  │   ├─ △△案件 ¥2,000,000 予定:7/15 [未入金] ← 赤色
  │   └─ □□案件 ¥1,500,000 予定:8/31 [予定]
  ├─ 「入金を記録」ボタン → 入金日・入金額を手入力
  └─ フィルタ: 全件 / 未入金のみ / 遅延のみ
```

---

## 5. 大項目の順序変更機能（新規）

**要件**: 顧客見積の大項目（A, B, C...）をドラッグまたは矢印ボタンで上下入れ替え

**実装方針**:
- `quote_sections.row_no` を使って表示順を制御
- フロント: dnd-kit（既にインストール済み）でドラッグ&ドロップ
- または上下矢印ボタンで `row_no` をスワップ

```
顧客見積ページ:
  [▲] [▼] A. 共通仮設工事     ¥500,000
  [▲] [▼] B. 直接仮設工事     ¥430,000
  [▲] [▼] C. 工場内間仕切... ¥148,400
  ...

API: PATCH /api/v1/quotes/{quote_id}/sections/reorder
  body: { section_ids: [uuid1, uuid2, uuid3, ...] }  ← 新しい順序
```

---

## 6. 既存要件との対応表

| 要件 | 内容 | 現状 | 本設計での対応 |
|------|------|------|---------------|
| F-01 | 案件 CRUD | ✅ 実装済み | 変更なし |
| F-02 | 工事番号自動採番 | ✅ 実装済み | 変更なし |
| F-03 | 7段階ステータス | ✅ 実装済み | 変更なし |
| F-04 | QCDS CRUD | ✅ 実装済み | スキャン転記ロジック修正 |
| F-05 | 見積書 PDF/Excel | 🟡 Excel のみ | PDF 出力を追加 |
| F-06 | 注文書 PDF/Excel | 🟡 Excel のみ | PDF 出力を追加 |
| F-07 | 請求書 PDF/Excel | 🟡 Excel のみ | PDF 出力を追加 + 入金管理 |
| F-08 | 印紙税自動算定 | ✅ 実装済み | 変更なし |
| F-09 | 業者見積スキャン | ✅ 実装済み | 転記ロジック修正 |
| F-10 | スキャン→QCDS 転記 | ❌ バグあり | 業者ごと 1 行に修正 |
| F-11 | スキャン→取決見通表 | ❌ バグあり | 同上 |
| F-12 | 見積書内訳候補生成 | 🟡 取込ボタンあり | 掛率反映を修正 |
| F-13 | 業者マスタ・単価履歴 | ✅ 実装済み | 変更なし |
| F-14 | Excel インポート | 🟡 動作不安定 | 入口B として分離 |
| F-15 | Excel エクスポート | ✅ 実装済み | 変更なし |
| F-16 | ダッシュボード | 🟡 一部実装 | 通知・アラーム追加 |
| F-17 | 案件カードビュー | 🟡 一部実装 | 粗利率表示修正 |
| F-19 | 認証 | ✅ 実装済み | ロール追加 |
| F-20 | 権限制御 | ❌ 未実装 | 4 ロール実装 |
| F-21 | 編集履歴 | ✅ 実装済み | 変更なし |

---

## 7. 実装スケジュール

### Phase 1-A: バグ修正と基盤整備（1 週間）

```
Day 1-2:
  ☐ DB マイグレーション（invoices, payment_schedules, source_type, orders 等）
  ☐ 掛率バグ修正（版ごとに独立 + 品目レベル優先）
  ☐ テスト: 版1の掛率変更 → 版2に影響しないこと
  ☐ テスト: 品目レベル掛率 > 版レベル掛率であること

Day 3-4:
  ☐ スキャン転記ロジック修正（UI 全面置き換え）
    - 既存の「選択した案件に転記▼」ドロップダウンを廃止
    - 新UI:「QCDSに転記」と「業者見積として保存」の2択ボタン
    - QCDS 転記: 業者名 + 合計で 1 行
    - 顧客見積への自動転記を削除
  ☐ テスト: スキャン → QCDS に 1 行のみ追加されること
  ☐ テスト: 顧客見積にデータが入らないこと

Day 5:
  ☐ 粗利率計算ロジック修正（QCDS ベースに変更）
  ☐ テスト: QCDS 未作成 → 「QCDSを作成してください」表示
  ☐ テスト: QCDS あり + 顧客見積あり → 正しい粗利率表示
```

### Phase 1-B: PDF 出力（1 週間）

```
Day 6-7:
  ☐ WeasyPrint セットアップ
    - Docker に fonts-noto-cjk パッケージをインストール
    - Noto Serif CJK JP / Noto Sans CJK JP が使えることを確認
  ☐ 見積書表紙 HTML テンプレート作成（Excel レイアウト再現）
  ☐ 見積書内訳 HTML テンプレート作成
  ☐ テスト: PDF 出力 → Excel と見比べてレイアウト確認

Day 8-9:
  ☐ 請求書 HTML テンプレート作成
  ☐ 注文書・注文請書 HTML テンプレート作成
  ☐ テスト: 各帳票の PDF 出力確認

Day 10:
  ☐ フロント: 各ページに「PDF 出力」ボタン追加
  ☐ テスト: ボタン → PDF ダウンロード → 内容確認
```

### Phase 1-C: 権限・請求・入金管理（1 週間）

```
Day 11-12:
  ☐ ユーザーロール実装（admin/staff/legacy/accounting）
  ☐ ログイン後の自動振り分け
  ☐ メニュー表示の権限制御
  ☐ テスト: 各ロールで適切な画面が表示されること

Day 13-14:
  ☐ 請求書管理画面（分割請求対応）
  ☐ 入金管理画面（手入力）
  ☐ ダッシュボード通知（請求アラーム・入金アラーム・遅延警告）
  ☐ テスト: 請求書作成 → PDF 出力 → 入金記録 → ステータス更新

Day 15:
  ☐ 大項目の順序変更（上下ボタン or ドラッグ）
  ☐ 全体テスト
  ☐ VPS デプロイ
```

---

## 8. 動作確認チェックリスト

### Phase 1-A 完了時

```
掛率:
  ☐ 版1の掛率を 1.2 に変更 → 版2 の掛率は 1.0 のまま
  ☐ 版1の品目1 の掛率を 1.5 に変更 → 品目1 だけ 1.5、他は版の 1.2
  ☐ 販売単価 = 原価単価 × 掛率 が正しく表示される
  ☐ 金額 = 販売単価 × 数量 が正しく表示される

スキャン転記:
  ☐ スキャン確認後「QCDS に転記」→ QCDS に業者名 + 合計の 1 行のみ
  ☐ 顧客見積にはデータが入らない
  ☐ 「業者見積として保存」→ 業者見積版に保存される
  ☐ 顧客見積の「業者見積から取込」→ 選択した版の品目が追加される

粗利率:
  ☐ QCDS 未作成 → 粗利率「---」＋「QCDSを作成してください」表示
  ☐ 顧客見積 未作成 → 粗利率「---」＋「顧客見積を作成してください」表示
  ☐ 両方あり → 粗利率 = (顧客見積合計 - QCDS合計) / 顧客見積合計 が正しく表示
  ☐ 粗利率 100% と表示されるケースがないこと
```

### Phase 1-B 完了時

```
PDF 出力:
  ☐ 見積書表紙 PDF → Excel の見積書表紙と同じレイアウト
  ☐ 見積書内訳 PDF → 大項目ごとの明細が正しく表示
  ☐ 請求書 PDF → Excel の請求書と同じレイアウト
  ☐ 注文書 PDF → Excel の注文書と同じレイアウト
  ☐ 注文請書 PDF → 注文書と同じレイアウト + 請負者署名欄
  ☐ 全帳票: 会社ロゴ、印影、ページ番号が正しく表示
```

### Phase 1-C 完了時

```
権限:
  ☐ admin でログイン → 全メニュー表示
  ☐ staff でログイン → 注文書・請求書メニュー非表示
  ☐ legacy でログイン → Excel インポート専用画面
  ☐ accounting でログイン → 注文書・請求書・入金管理画面

請求・入金:
  ☐ 請求書を作成（第1回/全3回）→ PDF 出力
  ☐ 第2回請求書を追加 → 分割請求として管理
  ☐ 入金を記録 → ステータスが「入金済」に更新
  ☐ ダッシュボードに請求アラームが表示される
  ☐ 入金予定日が近づくと通知が表示される
  ☐ 入金遅延 → 赤色で警告表示

順序変更:
  ☐ 大項目 A と B を入れ替え → 表示順が変わる
  ☐ 入れ替え後も金額計算が正しい
```

---

## 9. CLAUDE.md に追加すべきルール

既存の CLAUDE.md に以下を追加:

```markdown
## 追加ルール（2026-05-27 修正）

### 転記ルール
1. スキャン → QCDS 転記は「業者名 + 合計金額」で 1 行にまとめる。個別品目を展開してはいけない
2. スキャン時に顧客見積に自動転記してはいけない。顧客見積への反映は「業者見積から取込」ボタン経由のみ
3. 転記先（QCDS or 業者見積保存）はユーザーに明示的に選択させる

### 掛率ルール
1. 掛率は版（quote_versions）ごとに独立。ある版の掛率変更が他の版に影響してはいけない
2. 品目レベルの掛率（item_markup_rate）が設定されていればそちらを優先
3. 販売単価 = 原価単価 × 適用される掛率

### 粗利率ルール
1. 粗利率 = (顧客見積合計 - QCDS合計) / 顧客見積合計。quote_items.cost_price は使わない
2. QCDS が未作成の場合は「QCDSを作成してください」と表示。粗利率 100% と表示してはいけない
3. quote_items.cost_price は参考情報として保持するが、粗利率計算には使わない

### 帳票ルール
1. PDF 出力は WeasyPrint で HTML → PDF 変換
2. レイアウトは既存 Excel テンプレートを完全再現
3. Excel テンプレートのスタイル変更は禁止

### 権限ルール
1. ユーザーには admin / staff / legacy / accounting の 4 ロールがある
2. ログイン後、ロールに応じた画面に自動振り分け
3. メニュー表示もロールに応じて制御
```

---

## 10. 会社情報（帳票出力用、再掲）

```
会社名: 株式会社クラップ（CLAP CORPORATION）
住所: 〒913-0043 福井県坂井市三国町錦3-4-2
TEL: 0776-81-8330
FAX: 0776-81-8331
代表取締役: 奴間 正人
登録番号: T5210001007332（適格請求書発行事業者番号）
振込先: 福井銀行 経田支店 普通 1068586 株式会社クラップ
```

---

以上。この設計書に従って実装してください。
