# 設計書：工事台帳Web化プロジェクト（Construction Manager v3）

**作成者**：平等 久盛
**作成日**：2026年5月13日
**バージョン**：1.0
**対象読者**：Claude Code（VSCode拡張）で実装作業を行うAIアシスタント、および本人

---

## 0. このドキュメントの使い方（Claude Codeへ）

このドキュメントは、Construction Manager v3 を Claude Code（VSCode拡張）で実装するための完全な設計仕様書である。

- 章番号順に読み、各章末の「Claude Code への指示テンプレート」をそのままチャットに投げれば、当該機能の実装が完了する設計になっている
- 不明点があれば必ず本人（ひささん）に質問する。勝手な解釈で進めない
- 各Phaseの最後に動作確認チェックリストがあるので、必ず合格してから次Phaseへ進む
- `CLAUDE.md` をリポジトリルートに配置し、コーディング規約・採用ライブラリ・ディレクトリ構造を明記する（本書11章参照）

---

## 1. システムアーキテクチャ

### 1.1 全体構成

```
┌─────────────────────────────────────────────────────────────────┐
│  ユーザー（社内 6〜20名、PC/タブレット/スマホ、社内外問わず）     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare（DNS、CDN、DDoS保護）※MuuMuoドメイン                 │
│  koujidaichou.clap-corp.example                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  WebARENA Indigo VPS (Ubuntu 22.04, 2vCPU/4GB)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Coolify (管理レイヤ)                                      │  │
│  │  ┌──────────────────┐    ┌──────────────────────────┐    │  │
│  │  │ Nginx (Reverse   │    │ Frontend Container        │    │  │
│  │  │ Proxy + SSL)     │───▶│ Next.js 14 (Node 20)      │    │  │
│  │  └─────────┬────────┘    └──────────┬───────────────┘    │  │
│  │            │                         │ /api/*             │  │
│  │            │              ┌──────────▼───────────────┐    │  │
│  │            └─────────────▶│ Backend Container         │    │  │
│  │                           │ FastAPI (Python 3.11)     │    │  │
│  │                           └──┬───────────────┬────────┘    │  │
│  │                              │               │             │  │
│  │                  ┌───────────▼──┐    ┌──────▼──────────┐  │  │
│  │                  │ PostgreSQL 16│    │ Redis (cache    │  │  │
│  │                  │ Container    │    │ + Celery queue) │  │  │
│  │                  └──────────────┘    └─────────────────┘  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐     │  │
│  │  │ Celery Worker (Gemini解析、PDF生成、Excel I/O)   │     │  │
│  │  └──────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────┐                  │
│  │ Volume: /var/lib/cmv3/uploads (写真・図面)│                  │
│  │ Volume: /var/lib/cmv3/templates (Excel)  │                  │
│  │ Volume: /var/lib/cmv3/pgdata             │                  │
│  └──────────────────────────────────────────┘                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Phase 2: SMB/CIFS同期
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Canon社内サーバー（既存）                                       │
│  写真・図面のマスタ保管先                                        │
└─────────────────────────────────────────────────────────────────┘

           ┌─────────────────────────────────┐
           │ Google Gemini API (gemini-2.5)  │
           │ ※業者見積スキャン解析用          │
           └─────────────────────────────────┘
```

### 1.2 コンテナ構成（docker-compose）

| コンテナ | 役割 | ポート |
|---|---|---|
| `cmv3-web` | Next.js（フロント） | 3000（内部） |
| `cmv3-api` | FastAPI（バック） | 8000（内部） |
| `cmv3-worker` | Celery Worker | - |
| `cmv3-db` | PostgreSQL 16 | 5432（内部のみ） |
| `cmv3-redis` | Redis 7 | 6379（内部のみ） |

Coolifyが Nginx + Let's Encrypt SSL を自動管理する。外部公開はWebのみ。

### 1.3 ディレクトリ構成（リポジトリルート）

```
construction-manager-v3/
├── CLAUDE.md                  # Claude Code用ガイド
├── README.md
├── docker-compose.yml         # 本番用
├── docker-compose.dev.yml     # 開発用
├── .env.example
│
├── backend/                   # FastAPI
│   ├── Dockerfile
│   ├── pyproject.toml         # uv または poetry
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/              # 設定、認証、DB接続
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── security.py
│   │   │   └── deps.py
│   │   ├── models/            # SQLAlchemyモデル
│   │   ├── schemas/           # Pydanticスキーマ
│   │   ├── api/               # APIエンドポイント
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── projects.py
│   │   │       ├── qcds.py
│   │   │       ├── quotes.py
│   │   │       ├── orders.py
│   │   │       ├── invoices.py
│   │   │       ├── vendors.py
│   │   │       ├── scans.py
│   │   │       ├── dashboard.py
│   │   │       ├── uploads.py
│   │   │       └── excel_io.py
│   │   ├── services/          # ビジネスロジック
│   │   │   ├── gemini_scanner.py
│   │   │   ├── pdf_generator.py
│   │   │   ├── excel_exporter.py
│   │   │   ├── excel_importer.py
│   │   │   ├── stamp_tax_calculator.py
│   │   │   └── project_number_generator.py
│   │   ├── tasks/             # Celeryタスク
│   │   │   ├── scan_tasks.py
│   │   │   └── canon_sync_tasks.py  # Phase 2
│   │   └── templates/         # Excelテンプレート、PDFテンプレート
│   │       ├── excel/
│   │       │   ├── quote_cover.xlsx
│   │       │   ├── quote_detail.xlsx
│   │       │   ├── order.xlsx
│   │       │   ├── invoice.xlsx
│   │       │   └── koujidaichou.xlsx
│   │       └── pdf/
│   │           ├── quote.html.j2
│   │           ├── order.html.j2
│   │           └── invoice.html.j2
│   └── tests/
│
└── frontend/                  # Next.js 14
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── src/
    │   ├── app/               # App Router
    │   │   ├── layout.tsx
    │   │   ├── page.tsx       # ダッシュボード
    │   │   ├── login/
    │   │   ├── projects/
    │   │   │   ├── page.tsx           # 案件一覧
    │   │   │   ├── new/page.tsx       # 新規作成
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx       # 案件詳細
    │   │   │       ├── qcds/page.tsx
    │   │   │       ├── quote/page.tsx
    │   │   │       ├── order/page.tsx
    │   │   │       ├── invoice/page.tsx
    │   │   │       ├── progress/page.tsx
    │   │   │       └── history/page.tsx
    │   │   ├── vendors/
    │   │   ├── scan/
    │   │   └── admin/
    │   ├── components/
    │   │   ├── ui/            # shadcn/ui
    │   │   ├── project/
    │   │   ├── qcds/
    │   │   ├── quote/
    │   │   ├── scan/
    │   │   └── dashboard/
    │   ├── lib/
    │   │   ├── api-client.ts  # axios/fetch wrapper
    │   │   ├── auth.ts
    │   │   └── utils.ts
    │   ├── types/             # TypeScript型定義（OpenAPI生成）
    │   └── hooks/
    └── public/
        └── clap-logo.png      # 株式会社クラップロゴ
```

---

## 2. データモデル（ER設計）

### 2.1 主要エンティティ概要

```
User ─── Project ─── QCDS ─── QCDSDirectWork ─── Vendor
                │                                  │
                ├─── Quote ─── QuoteItem            └─── VendorPriceHistory
                ├─── Order
                ├─── Invoice
                ├─── ProgressLog ─── ProgressAttachment
                ├─── ScanJob ─── ScanResult ─── ScanResultItem
                └─── EditHistory
```

### 2.2 テーブル定義

#### users（ユーザー）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR UNIQUE | ログインID |
| hashed_password | VARCHAR | Argon2 |
| full_name | VARCHAR | 平等 久盛 |
| employee_number | INT | 社員番号（工事番号採番に使用） |
| role | ENUM | `admin` / `member` |
| department | VARCHAR | 営業/工事/経理など |
| is_active | BOOL | |
| created_at, updated_at | TIMESTAMP | |

#### projects（工事案件＝工事台帳本体）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_number | VARCHAR UNIQUE | `26-1-001`形式 |
| project_name | VARCHAR | 工事名 |
| project_location | TEXT | 工事場所（〒含む） |
| client_name | VARCHAR | 発注者 |
| original_client_name | VARCHAR | 元発注者 |
| period_quote_start, period_quote_end | DATE | 工期（見積） |
| period_contract_start, period_contract_end | DATE | 工期（契約） |
| period_actual_start, period_actual_end | DATE | 工期（実施） |
| order_type | ENUM | `民間`/`官庁` |
| contract_type | ENUM | `元請`/`下請` |
| awarding_type | ENUM | `特命`/`競争` |
| payment_condition | TEXT | 支払条件 |
| project_summary | TEXT | 工事概要 |
| prev_construction_type | ENUM | `当社`/`他社`/`なし` |
| prev_construction_year | INT | 当社の場合の施工年 |
| prev_construction_other | VARCHAR | 他社の場合の会社名 |
| client_contact_company | VARCHAR | 客先担当（会社） |
| client_contact_person | VARCHAR | 客先担当（担当者） |
| client_contact_phone | VARCHAR | |
| sales_person_id | UUID FK→users | 営業担当 |
| construction_person_id | UUID FK→users | 工事担当 |
| project_price | DECIMAL(12,0) | 工事価格（顧客提示） |
| status | ENUM | `見積中`/`受注`/`着工`/`施工中`/`完工`/`請求済`/`入金済` |
| created_by | UUID FK→users | 作成者（編集権限保有） |
| created_at, updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP NULL | 論理削除 |

#### qcds（QCDS原価算定表）

`projects` と1:1対応。実行予算／取決見通／精算見通の3列を持つ構造で、計算結果は派生フィールドとしてSQL VIEW or アプリ側で算出。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK | |
| revision | INT | 改訂版（実行予算→改訂実行予算） |
| spare_cost | DECIMAL | 予備費 |
| industrial_waste_cost | DECIMAL | 産業廃棄物処理費 |
| labor_insurance_rate | DECIMAL | 労災保険料率（初期0.1973%） |
| construction_insurance_rate | DECIMAL | 工事保険料率（初期0.2095%） |
| special_insurance_rate | DECIMAL | 特殊保険料率（初期0.0110%） |
| office_supplies | DECIMAL | 事務用品費（初期2,000） |
| communication_cost | DECIMAL | 通信交通費（初期10,000） |
| misc_cost | DECIMAL | 雑費（初期5,000） |
| site_staff_salary_rate | DECIMAL | 現場担当者給与率（初期3%） |
| common_overhead_rate | DECIMAL | 工事部経費率 |
| shared_overhead_rate | DECIMAL | 共通経費率（初期3%） |
| general_admin_rate | DECIMAL | 一般管理費率（初期2%） |
| target_operating_profit_rate | DECIMAL | 目標営業利益率（初期10%） |
| actual_site_personnel_cost | DECIMAL | 実際の現場人件費 |
| created_at, updated_at | TIMESTAMP | |

#### qcds_direct_works（QCDS A 直接工事の各行）

工事台帳の「取決見通表」と同期する。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| qcds_id | UUID FK | |
| row_no | INT | 1〜30 |
| work_type | VARCHAR | 工種（仮設、解体、土、内装等） |
| vendor_id | UUID FK→vendors NULL | 業者マスタ参照 |
| vendor_name_snapshot | VARCHAR | 登録時の業者名（マスタ無しでも入力可） |
| category | ENUM | `外注`/`資材`/`その他` |
| budget_amount | DECIMAL | 実行予算 |
| agreed_amount | DECIMAL | 取決金額 |
| settlement_amount | DECIMAL | 精算（支払）金額 |
| agreement_checked | BOOL | 専門業者取決伺チェック |
| payment_month_4 | DECIMAL | 4月〆支払額 |
| payment_month_5 | DECIMAL | 5月〆 |
| payment_month_6 | DECIMAL | 6月〆 |
| payment_month_7 | DECIMAL | 7月〆 |
| payment_month_8 | DECIMAL | 8月〆 |
| payment_month_9 | DECIMAL | 9月〆 |
| payment_month_10 | DECIMAL | 10月〆 |
| payment_month_11 | DECIMAL | 11月〆 |
| payment_month_12 | DECIMAL | 12月〆 |
| payment_month_1 | DECIMAL | 1月〆 |
| payment_month_2 | DECIMAL | 2月〆 |
| payment_month_3 | DECIMAL | 3月〆 |
| payment_completed | BOOL | 「済」 |
| note | TEXT | |

支払月は別テーブル化も検討したが、現行Excelの構造に合わせる方が運用イメージしやすいため横展開。年度変わりで列をリネームする運用とする。

#### vendors（業者マスタ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| vendor_name | VARCHAR | 業者名（HIT、開拓工業など） |
| vendor_name_kana | VARCHAR | カナ |
| primary_work_types | VARCHAR[] | 主な工種（仮設、解体等） |
| postal_code | VARCHAR | |
| address | TEXT | |
| phone | VARCHAR | |
| email | VARCHAR | |
| contact_person | VARCHAR | |
| bank_info | TEXT | 振込先（暗号化推奨） |
| note | TEXT | |
| is_active | BOOL | |
| created_at, updated_at | TIMESTAMP | |

#### vendor_price_histories（業者単価履歴）

スキャン結果や手動入力から蓄積。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| vendor_id | UUID FK | |
| project_id | UUID FK NULL | どの案件で適用したか |
| item_name | VARCHAR | 項目名（例：内装解体工） |
| item_spec | TEXT | 仕様 |
| unit | VARCHAR | 単位 |
| quantity | DECIMAL | 数量 |
| unit_price | DECIMAL | 単価 |
| amount | DECIMAL | 金額 |
| quoted_at | DATE | 見積日 |
| source | ENUM | `scan`/`manual` |
| created_at | TIMESTAMP | |

#### quotes（見積書ヘッダ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK | |
| quote_number | VARCHAR | 見積書No |
| issue_date | DATE | |
| validity_days | INT | 見積有効期限（初期30日） |
| project_name_snapshot | VARCHAR | |
| project_location_snapshot | TEXT | |
| period_start, period_end | DATE | |
| payment_condition | TEXT | |
| remarks | TEXT | |
| subtotal | DECIMAL | |
| tax_amount | DECIMAL | 消費税10% |
| total_amount | DECIMAL | |
| approver_id, reviewer_id, person_in_charge_id | UUID FK | 承認・審査・担当 |
| conditions_text | TEXT | 見積条件書本文 |
| status | ENUM | `draft`/`issued` |
| created_at, updated_at | TIMESTAMP | |

#### quote_items（見積内訳）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| quote_id | UUID FK | |
| row_no | INT | |
| item_name | VARCHAR | 名称 |
| spec | TEXT | 仕様 |
| unit | VARCHAR | |
| quantity | DECIMAL | |
| unit_price | DECIMAL | |
| amount | DECIMAL | |
| remarks | VARCHAR | |
| source_vendor_id | UUID FK NULL | 流用元の業者 |
| source_scan_result_id | UUID FK NULL | 流用元のスキャン |

#### orders（注文書・注文請書）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK | |
| order_number | VARCHAR | |
| issue_date | DATE | |
| client_address, client_company, client_person | VARCHAR | |
| amount_excl_tax | DECIMAL | |
| tax_amount | DECIMAL | |
| total_amount | DECIMAL | |
| construction_period_start, construction_period_end | DATE | |
| payment_condition | TEXT | |
| terms_and_conditions | TEXT | 基本契約約款（テンプレ） |
| stamp_tax | DECIMAL | 印紙税 |
| status | ENUM | `draft`/`issued`/`signed_returned` |

#### invoices（請求書）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK | |
| invoice_number | VARCHAR | |
| issue_date | DATE | |
| previous_balance | DECIMAL | 前月御請求額 |
| received_amount | DECIMAL | 御入金 |
| outstanding_balance | DECIMAL | 差引残高 |
| current_purchase | DECIMAL | 当月御買上額 |
| tax_amount | DECIMAL | 今回消費税額 |
| total_amount | DECIMAL | 今回御請求額 |
| status | ENUM | `draft`/`issued`/`paid` |

#### invoice_items（請求書明細）

工事名・備考／金額／摘要

#### progress_logs（進捗ログ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK | |
| logged_at | TIMESTAMP | |
| logged_by | UUID FK→users | |
| log_type | ENUM | `text`/`photo`/`drawing`/`milestone` |
| title | VARCHAR | |
| body | TEXT | |
| status_changed_to | ENUM NULL | ステータス変化時 |

#### progress_attachments（添付ファイル）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| progress_log_id | UUID FK | |
| file_path | VARCHAR | VPSローカルパス（後にCanon同期） |
| file_name | VARCHAR | 元ファイル名 |
| mime_type | VARCHAR | |
| file_size | BIGINT | |
| canon_sync_status | ENUM | `local_only`/`syncing`/`synced` |
| canon_path | VARCHAR NULL | Canon側のパス |
| created_at | TIMESTAMP | |

#### scan_jobs（業者見積スキャンジョブ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK NULL | 案件に紐付け（後付け可） |
| uploaded_by | UUID FK→users | |
| original_file_path | VARCHAR | |
| original_file_name | VARCHAR | |
| file_type | ENUM | `pdf`/`image`/`excel` |
| status | ENUM | `pending`/`processing`/`succeeded`/`failed`/`reviewed` |
| gemini_model | VARCHAR | 使用モデル名 |
| gemini_response_raw | JSONB | 生レスポンス（デバッグ用） |
| error_message | TEXT NULL | |
| created_at, updated_at | TIMESTAMP | |

#### scan_results（解析結果ヘッダ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| scan_job_id | UUID FK | |
| vendor_name_detected | VARCHAR | 検出された業者名 |
| vendor_id | UUID FK NULL | マスタへのマッチング |
| quoted_date_detected | DATE NULL | |
| subtotal_detected | DECIMAL | |
| tax_detected | DECIMAL | |
| total_detected | DECIMAL | |
| confidence_score | DECIMAL(3,2) | 0.00〜1.00 |
| reviewed_by | UUID FK NULL | レビューした人 |
| reviewed_at | TIMESTAMP NULL | |

#### scan_result_items（解析項目明細）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| scan_result_id | UUID FK | |
| row_no | INT | |
| item_name | VARCHAR | |
| spec | TEXT | |
| unit | VARCHAR | |
| quantity | DECIMAL | |
| unit_price | DECIMAL | |
| amount | DECIMAL | |
| confidence | DECIMAL(3,2) | フィールド単位の信頼度 |
| applied_to_qcds | BOOL | QCDSに転記済 |
| applied_to_quote | BOOL | 見積に転記済 |

#### edit_histories（編集履歴）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| entity_type | VARCHAR | `project`/`qcds`/`quote`/etc |
| entity_id | UUID | |
| project_id | UUID FK NULL | 横断検索用 |
| changed_by | UUID FK→users | |
| changed_at | TIMESTAMP | |
| change_type | ENUM | `create`/`update`/`delete` |
| field_changes | JSONB | `{"field":{"old":..., "new":...}}` |

#### stamp_tax_table（印紙税額テーブル）

QCDS印紙税シートをマスタ化。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| min_amount | DECIMAL | 下限金額 |
| max_amount | DECIMAL | 上限金額 |
| tax_amount | DECIMAL | 印紙税額 |
| effective_from | DATE | 適用開始日 |

#### project_number_sequences（採番管理）

| カラム | 型 | 説明 |
|---|---|---|
| year_yy | INT PK | 西暦下2桁（26） |
| employee_number | INT PK | 社員番号 |
| last_seq | INT | 最終連番 |

---

## 3. API設計

### 3.1 認証

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/v1/auth/login` | ログイン（email+password）→ JWT+refresh token |
| POST | `/api/v1/auth/refresh` | refresh token → 新JWT |
| POST | `/api/v1/auth/logout` | |
| GET | `/api/v1/auth/me` | 自分のユーザー情報 |

### 3.2 案件

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/v1/projects` | 一覧（フィルタ：status, year, sales_person, client, q） |
| POST | `/api/v1/projects` | 新規作成（自動採番） |
| GET | `/api/v1/projects/{id}` | 詳細（QCDS、見積、注文、請求、進捗の概要含む） |
| PATCH | `/api/v1/projects/{id}` | 更新（権限：admin or created_by） |
| DELETE | `/api/v1/projects/{id}` | 論理削除（admin only） |
| POST | `/api/v1/projects/{id}/status` | ステータス変更 |
| GET | `/api/v1/projects/{id}/history` | 編集履歴 |

### 3.3 QCDS

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/v1/projects/{id}/qcds` | 取得 |
| PUT | `/api/v1/projects/{id}/qcds` | 一括更新（直接工事行も含む） |
| POST | `/api/v1/projects/{id}/qcds/calculate` | 派生フィールドの再計算（dry-run可） |

### 3.4 見積／注文／請求

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST/PATCH | `/api/v1/projects/{id}/quotes` | 見積CRUD |
| GET | `/api/v1/quotes/{id}/export?format=pdf|xlsx` | 帳票出力 |
| GET/POST/PATCH | `/api/v1/projects/{id}/orders` | 注文書 |
| GET | `/api/v1/orders/{id}/export?format=pdf|xlsx` | |
| GET/POST/PATCH | `/api/v1/projects/{id}/invoices` | 請求書 |
| GET | `/api/v1/invoices/{id}/export?format=pdf|xlsx` | |

### 3.5 業者見積スキャン

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/v1/scan/upload` | ファイルアップロード（multipart） |
| GET | `/api/v1/scan/jobs/{job_id}` | ジョブ状態 |
| GET | `/api/v1/scan/results/{result_id}` | 解析結果 |
| PATCH | `/api/v1/scan/results/{result_id}` | レビュー編集 |
| POST | `/api/v1/scan/results/{result_id}/apply` | QCDS/見積へ転記 |

### 3.6 業者マスタ

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/v1/vendors` | CRUD |
| GET | `/api/v1/vendors/{id}/price-history` | 単価履歴 |
| GET | `/api/v1/vendors/{id}/price-history/search?item_name=...` | 項目検索 |

### 3.7 進捗

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/v1/projects/{id}/progress` | 進捗一覧 |
| POST | `/api/v1/projects/{id}/progress` | 進捗追加 |
| POST | `/api/v1/projects/{id}/progress/{log_id}/attachments` | ファイル添付 |
| GET | `/api/v1/attachments/{attachment_id}` | ダウンロード |

### 3.8 ダッシュボード

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/v1/dashboard/summary?year=2026` | 年間集計（受注額、原価、粗利、件数） |
| GET | `/api/v1/dashboard/status-distribution` | ステータス別案件数 |
| GET | `/api/v1/dashboard/monthly-trend?year=2026` | 月別推移 |
| GET | `/api/v1/dashboard/profit-ranking?limit=10` | 利益率ランキング |

### 3.9 Excel I/O

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/v1/excel/import` | Excel工事台帳のインポート |
| GET | `/api/v1/projects/{id}/excel/export` | 工事台帳一式をExcel出力 |

---

## 4. 画面設計

### 4.1 画面一覧

| 画面ID | 名称 | パス |
|---|---|---|
| S01 | ログイン | `/login` |
| S02 | ダッシュボード | `/` |
| S03 | 案件一覧 | `/projects` |
| S04 | 案件詳細（工事台帳） | `/projects/[id]` |
| S05 | QCDS | `/projects/[id]/qcds` |
| S06 | 見積書 | `/projects/[id]/quote` |
| S07 | 注文書 | `/projects/[id]/order` |
| S08 | 請求書 | `/projects/[id]/invoice` |
| S09 | 進捗 | `/projects/[id]/progress` |
| S10 | 編集履歴 | `/projects/[id]/history` |
| S11 | 業者見積スキャン | `/scan` |
| S12 | スキャン結果レビュー | `/scan/[job_id]` |
| S13 | 業者マスタ | `/vendors` |
| S14 | 業者詳細・単価履歴 | `/vendors/[id]` |
| S15 | Excelインポート | `/import` |
| S16 | 管理（ユーザー、印紙税表、設定） | `/admin` |

### 4.2 案件詳細画面（S04）レイアウト方針

現行Excel「工事台帳」のレイアウトを尊重し、初見でも違和感がない構成にする。

```
┌──────────────────────────────────────────────────────────────┐
│ [株式会社クラップ ロゴ]    工事番号: 26-1-001   [編集] [PDF]  │
│ ステータス: ●施工中  ←ドロップダウンで変更可                  │
├────────────────────────┬─────────────────────────────────────┤
│ 案件情報               │ 工事割出（実行予算／取決見通／精算）  │
│ ・工事名               │ ┌─────────────┬──────┬──────┐         │
│ ・工事場所             │ │            │実行予算│取決見通│         │
│ ・発注者               │ │直接工事費   │      │      │         │
│ ・工期(見積/契約/実施) │ │現場経費    │      │      │         │
│ ・発受注区分           │ │経費        │      │      │         │
│ ・支払条件             │ │営業利益①   │      │      │         │
│ ・工事概要             │ │目標営業利益│      │      │         │
│ ・前施工区分           │ └─────────────┴──────┴──────┘         │
│ ・客先担当             │                                       │
│ ・当社担当             │ 現場経費計     ●●●●円                │
│                        │ ・契約印紙代  ・事務用品費            │
├────────────────────────┴─────────────────────────────────────┤
│ 取決見通表 ／ 専門業者取決伺                                  │
│ ┌──┬──────┬────┬───────┬───────┬──────┬────────────────┐    │
│ │No│支払先 │工種│実行予算│取決金額│ﾁｪｯｸ │月別支払表→     │    │
│ │1 │HIT   │仮設│500,000│450,000│ ☑   │4月: 250,000…  │    │
│ │2 │…    │…  │…     │…     │     │                │    │
│ └──┴──────┴────┴───────┴───────┴──────┴────────────────┘    │
│ [+ 行追加] [業者見積スキャンから読み込み]                     │
├──────────────────────────────────────────────────────────────┤
│ クイックリンク: [QCDS] [見積書] [注文書] [請求書] [進捗] [履歴]│
└──────────────────────────────────────────────────────────────┘
```

### 4.3 ダッシュボード（S02）

| エリア | 内容 |
|---|---|
| ヘッダー | 年度切替、自分担当のみ表示トグル |
| KPIカード | 今期受注額／粗利／案件数／平均営業利益率 |
| ステータス分布 | 円グラフ（見積中、受注、施工中、完工、請求済、入金済の件数） |
| 月別推移 | 棒＋線グラフ（月別受注額、粗利、案件数） |
| 利益率ランキング | 上位10案件のテーブル |
| 期限アラート | 工期超過、請求書未発行、入金未確認の案件リスト |
| 最近の活動 | 編集履歴の直近20件 |

### 4.4 業者見積スキャン画面（S11/S12）

**S11（アップロード画面）**

- ドラッグ＆ドロップでファイル投入（PDF/画像/Excel複数可）
- 「対象案件」を選択（後付けも可）
- アップロード後はジョブ一覧に表示。`pending` → `processing` → `succeeded`の状態遷移

**S12（レビュー画面）**

左右2ペインのスプリットビュー。
- 左：元ファイルのプレビュー（PDF/画像はそのまま、Excelはレンダリング表示）
- 右：解析結果テーブル。低信頼度フィールドは黄色強調、編集可能

下部に「QCDSに転記」「見積に転記」「両方転記」「業者マスタに保存」のボタン群。

---

## 5. 業者見積スキャン処理フロー（F-09〜F-13 詳細設計）

### 5.1 全体シーケンス

```
[ユーザー] アップロード
   │
   ▼
[API] /scan/upload
   │ ファイルをVPS一時保存（/var/lib/cmv3/scan_tmp/）
   │ scan_jobs INSERT (status=pending)
   │ Celery enqueue
   ▼
[Worker] scan_tasks.process_scan_job
   │ 1. ファイル種別判定
   │    - PDF: pdf2imageでページごとPNG化
   │    - 画像: そのまま
   │    - Excel: openpyxlで読み取り、構造化テキスト化
   │ 2. Gemini API呼び出し（gemini-2.5-pro Vision）
   │    プロンプト: 業者見積として表構造を読み取り、JSON Schema準拠で返却
   │ 3. レスポンスをパース、信頼度スコア付与
   │ 4. scan_results, scan_result_items INSERT
   │ 5. 業者名でvendorマスタを fuzzy matching（pg_trgm）
   │ 6. status=succeeded
   ▼
[ユーザー] レビュー画面で確認・編集
   │
   ▼
[API] /scan/results/{id}/apply
   │ target: qcds / quote / both
   │ - qcds: qcds_direct_works に行追加（vendor_id, vendor_name_snapshot, work_type, budget_amount等）
   │ - quote: quote_items に行追加
   │ - 業者マスタになければ自動登録（ユーザー確認後）
   │ - vendor_price_histories にも蓄積（再利用用）
```

### 5.2 Geminiプロンプト設計

プロンプトは構造化出力を強制するため、Pydantic→JSON Schema化したものを `responseSchema` パラメータで渡す。

```python
class ScanResultSchema(BaseModel):
    vendor_name: Optional[str] = Field(None, description="業者名・会社名")
    quoted_date: Optional[str] = Field(None, description="見積日 YYYY-MM-DD")
    project_name: Optional[str] = Field(None, description="工事名・件名")
    items: list[ScanItem]
    subtotal: Optional[Decimal] = Field(None, description="税抜小計")
    tax_amount: Optional[Decimal] = Field(None, description="消費税額")
    total_amount: Optional[Decimal] = Field(None, description="税込合計")
    confidence_overall: float = Field(..., ge=0, le=1)

class ScanItem(BaseModel):
    item_name: str
    spec: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    confidence: float = Field(..., ge=0, le=1)
```

プロンプト本文（抜粋）：

```
あなたは日本の建設業界の業者見積書を読み取る専門AIです。
添付された見積書（PDF/画像/Excel変換テキスト）から、項目を構造化して抽出してください。

ルール:
- 数値は半角に統一し、カンマは除去する
- 「式」「人工」「m2」など単位はそのまま保持
- 不明なフィールドは null
- 各項目に信頼度 (0.0〜1.0) を付与
- 合計欄、消費税欄、小計欄は items に含めず、各専用フィールドに記載
- 値引きや諸経費は items に含めるが、spec に "値引き" 等を明記
```

### 5.3 Excelファイルの業者見積処理

業者からExcelで送られてきた見積はレイアウトがバラバラなので、以下の二段構えで処理する：

1. **第一段：構造化テキスト変換**
   `openpyxl` で全シート全セルを `(座標, 値)` のリストに展開。さらに罫線・結合セル情報を付加し、Markdownライクな表形式テキストに変換する。
2. **第二段：Geminiに投入**
   PDFと同じプロンプトで解析。Excelは直接Visionに渡せないため、テキスト化＋テキストプロンプトとして処理する。

### 5.4 業者マスタへの fuzzy matching

`pg_trgm` 拡張を使って類似度0.6以上の業者を候補表示。ユーザー確認後に紐付け。
新規業者は「業者マスタに新規登録」ボタンで即時追加可能。

---

## 6. 帳票出力設計（PDF / Excel 両対応）

### 6.1 Excel出力（既存テンプレート方式）

各帳票のExcelテンプレートをリポジトリ内 `backend/app/templates/excel/` に配置。
`openpyxl` で開き、定められたセル座標に値を埋め込んで返す。レイアウト・書式・ロゴはテンプレートが保持。

```python
# 例：請求書出力
wb = load_workbook("templates/excel/invoice.xlsx")
ws = wb["請求書"]
ws["R1"] = invoice.project.project_number
ws["T2"] = invoice.issue_date.year
ws["W2"] = invoice.issue_date.month
ws["Z2"] = invoice.issue_date.day
ws["J8"] = invoice.project.client_name
ws["L19"] = float(invoice.current_purchase)
ws["P19"] = float(invoice.tax_amount)
ws["T19"] = float(invoice.total_amount)
# ...
```

各帳票のセルマッピングは `backend/app/templates/excel/cell_mappings.yaml` に集約管理する。

### 6.2 PDF出力（HTML/CSS + WeasyPrint）

Jinja2でHTMLテンプレートをレンダリングし、WeasyPrintでPDF化。
レイアウトはExcelテンプレートを参考に再現するが、完全一致ではなくWebに馴染むモダンな見た目に調整する（ロゴ・社名・住所などのアイデンティティは維持）。

```python
from weasyprint import HTML
html_str = jinja_env.get_template("pdf/invoice.html.j2").render(invoice=invoice)
pdf_bytes = HTML(string=html_str).write_pdf()
```

### 6.3 印紙税自動算定

QCDSの印紙税額算定表をDB化し、注文書作成時に契約金額から自動算出。

```python
def calculate_stamp_tax(contract_amount: Decimal, contract_date: date) -> Decimal:
    row = db.query(StampTaxTable).filter(
        StampTaxTable.effective_from <= contract_date,
        StampTaxTable.min_amount <= contract_amount,
        StampTaxTable.max_amount >= contract_amount,
    ).order_by(StampTaxTable.effective_from.desc()).first()
    return row.tax_amount if row else Decimal(0)
```

---

## 7. Excelインポート設計

### 7.1 想定する利用ケース

- 高齢従業員が現行Excelで案件を作成→Webにアップロードして取り込み
- 既存の過去案件Excelをまとめて取り込み（初期データ移行）

### 7.2 処理フロー

```
[ユーザー] /import 画面でExcelアップロード
   │
   ▼
[API] /excel/import
   │ 1. openpyxlで開く
   │ 2. シート構成チェック（工事台帳/QCDS/見積/注文/請求があるか）
   │ 3. 各シートからセル座標ベースで値を抽出
   │    - 工事番号 → L11
   │    - 工事名 → L12
   │    - 工事場所 → L14
   │    - 発注者 → L16
   │    - ...（cell_mappings.yamlを共用）
   │ 4. 既存案件との照合（工事番号で）
   │    - 既存あり → 「上書きしますか？」確認画面
   │    - 既存なし → 新規作成
   │ 5. QCDS直接工事の取決見通表からqcds_direct_worksを生成
   │ 6. 業者名から業者マスタ参照／自動登録
   │ 7. インポート結果サマリを返却（成功○件、エラー○件、警告○件）
```

### 7.3 セル座標マッピング

工事台帳記入例の調査結果を元に、以下を `cell_mappings.yaml` に定義：

```yaml
koujidaichou:
  project_number: L11
  project_name: L12
  project_location: L14
  client_name: L16
  original_client_name: L18
  period_quote_start: L19
  period_quote_end: X19
  period_contract_start: L20
  period_contract_end: X20
  period_actual_start: L21
  period_actual_end: X21
  order_type: L22       # 民間/官庁判定が必要
  contract_type: T22
  awarding_type: AA22
  payment_condition: L23
  project_summary: B26  # 工事概要 ・情報経緯 ・発注者要望事項
  prev_construction_company: L33
  client_contact_company: Q34
  client_contact_person: Q35
  client_contact_phone: Q36
  sales_person: L37
  construction_person: L38
  project_price: BB11

  # 工事割出
  direct_construction_budget: AS14
  site_overhead: AS15
  direct_total: AS16
  overhead: AS17
  operating_profit_1: AS19
  target_operating_profit: AS20

  # 取決見通表（30行）
  direct_works_start_row: 24
  direct_works_end_row: 53
  direct_works_columns:
    no: AJ
    vendor_name: AK
    work_type: AO
    budget: AR
    agreed: AX
    check: BD
    diff: BE
    # 月別支払: BK(4月)..CM(3月) ※実セル要追加調査
```

### 7.4 Phase 1で割り切る点

- Excelに手書きや図形が混じっている場合は無視
- 数式が入っているセルは計算済み値（data_only=True）を読み取る
- 不完全な記入のExcelは「警告」として人間レビューに回す

---

## 8. 認証・権限・編集履歴

### 8.1 認証

- FastAPI Users + JWT（アクセストークン15分、リフレッシュ7日）
- パスワードは Argon2id でハッシュ
- ログイン試行5回失敗で15分ロック
- Phase 2：Google SSO 追加（Workspaceドメイン制限）

### 8.2 権限制御

| 操作 | 全員 | 作成者 | 管理者 |
|---|---|---|---|
| 案件閲覧 | ○ | ○ | ○ |
| 案件作成 | ○ | - | ○ |
| 案件編集 | ✕ | ○ | ○ |
| 案件削除 | ✕ | ✕ | ○ |
| 業者マスタ閲覧 | ○ | ○ | ○ |
| 業者マスタ編集 | ✕ | - | ○ |
| 進捗追加 | ○ | ○ | ○ |
| 編集履歴閲覧 | ○ | ○ | ○ |
| ユーザー管理 | ✕ | ✕ | ○ |
| 印紙税表編集 | ✕ | ✕ | ○ |

FastAPI側で `Depends(get_current_user)` ＋ 操作ごとの permission decorator で制御。

### 8.3 編集履歴

SQLAlchemyのイベントリスナで全エンティティの変更を自動キャプチャ。

```python
@event.listens_for(Session, "before_flush")
def capture_changes(session, flush_context, instances):
    for obj in session.dirty:
        if hasattr(obj, '__history_tracked__'):
            old = {col.name: history.deleted[0] if history.deleted else None
                   for col in obj.__table__.columns
                   for history in [inspect(obj).attrs[col.name].history]
                   if history.has_changes()}
            new = {col.name: getattr(obj, col.name)
                   for col in obj.__table__.columns
                   if col.name in old}
            session.add(EditHistory(
                entity_type=obj.__tablename__,
                entity_id=obj.id,
                project_id=getattr(obj, 'project_id', obj.id if obj.__tablename__ == 'projects' else None),
                changed_by=current_user_var.get(),
                change_type='update',
                field_changes={k: {"old": old[k], "new": new[k]} for k in old},
            ))
```

### 8.4 同時編集対策（楽観的ロック）

各エンティティに `updated_at` を持たせ、PATCHリクエスト時にクライアントから `If-Unmodified-Since` 相当の値を送る。サーバ側で不一致なら 409 Conflict を返し、フロントで「他のユーザーが編集しました。再読込してください」と表示。

---

## 9. 写真・図面ストレージとCanon連携

### 9.1 Phase 1: VPSローカル保存

```
/var/lib/cmv3/uploads/
  └── {year}/
       └── {project_number}/
            └── {progress_log_id}/
                 ├── {uuid}_{original_filename}
                 └── ...
```

データベースには相対パスのみ保持。ファイル本体はFastAPIから `StreamingResponse` で配信、権限チェック後に返す。

### 9.2 Phase 2: Canonサーバー連携の選択肢

ひささんのCanonサーバーが具体的にどの製品かによって接続方式が変わる：

| 製品例 | プロトコル | 実装方法 |
|---|---|---|
| Canon imageWARE Document Manager / Therefore | Web API or WebDAV | カスタムAPIクライアント |
| Canon複合機（iR系）の共有フォルダ | SMB/CIFS | `pysmb` ライブラリで同期 |
| Canon Office Online Box | クラウドストレージ | ベンダAPI（要確認） |

Phase 1中にCanonサーバーの具体的な仕様を調査し、Phase 2で以下のいずれかを実装：

1. **同期型（推奨）**：Celery Beatで毎時、VPSローカルの新規/更新ファイルをCanonへコピー
2. **直接書込型**：アップロード時にVPS経由でそのままCanonへ書き込み（ネットワーク断時のリスクあり）

`canon_sync_status` カラムでファイルごとの同期状態を管理し、ダッシュボードに同期遅延アラートを表示。

### 9.3 大容量ファイルへの配慮

写真は1枚あたり数MB、図面PDFは数十MBを想定。

- アップロード時：MIME検証、最大サイズ 50MB/ファイル、合計 200MB/リクエスト
- 画像はsharp等でWebP変換した縮小版とオリジナルの2系統保持
- VPSローカルは月次でディスク容量監視、80%超でアラート

---

## 10. 工事番号採番ロジック

```python
def generate_project_number(employee_number: int, project_date: date, db: Session) -> str:
    year_yy = project_date.year % 100  # 2026 → 26
    seq_row = db.query(ProjectNumberSequence).filter_by(
        year_yy=year_yy, employee_number=employee_number
    ).with_for_update().first()

    if seq_row is None:
        seq_row = ProjectNumberSequence(
            year_yy=year_yy, employee_number=employee_number, last_seq=0
        )
        db.add(seq_row)

    seq_row.last_seq += 1
    db.flush()

    return f"{year_yy:02d}-{employee_number}-{seq_row.last_seq:03d}"
```

手動編集も可能。手動編集時は重複チェックを行い、UNIQUE違反なら拒否。

---

以上、設計書の前半。続きは別ファイル（実装手順、Claude Code指示テンプレート、テスト計画）。
