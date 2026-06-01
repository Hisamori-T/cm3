# AI 開発向けアーキテクチャ移行計画

> 作成日: 2026-06-01
> 前提: `docs/architecture_analysis.md` の分析結果に基づく
> 方針: コードの動作を変えず、**ファイル構成とモジュール境界のみ**を整理する

---

## 設計原則

| 原則 | 内容 |
|-----|------|
| **コンテキスト境界** | 1 機能 = 1 コンテキスト。1 モジュールが LLM 1 回の要求で完結できる規模（〜500行/ファイル） |
| **単方向依存** | 下位モジュールは上位を import しない。循環参照を禁止 |
| **Shared は安定** | Shared 層への変更は全モジュールに影響するため、慎重に設計・最小化する |
| **ページ構造は変えない** | Next.js の `app/` ルーティング（URL）はそのまま維持。移行はコンポーネント分割のみ |
| **DB スキーマは変えない** | Alembic migration・テーブル定義は触らない。モデルファイルの置き場所のみ変更 |

---

## 1. 推奨フォルダ構成

### Backend

```
backend/app/
│
├── core/                          # ★ 変更なし（横断インフラ）
│   ├── config.py                  # 環境変数・設定
│   ├── database.py                # AsyncSession / Base
│   ├── security.py                # JWT / Argon2id
│   └── deps.py                    # get_current_user 依存注入
│
├── shared/                        # ★ NEW（横断ビジネスロジック）
│   ├── models/
│   │   ├── base.py                # TimestampMixin（現 models/base.py）
│   │   ├── enums.py               # 全 Enum 定義（現 models/enums.py）
│   │   └── history.py             # EditHistory（現 models/history.py）
│   ├── schemas/
│   │   └── common.py              # ページネーション・共通レスポンス型
│   └── services/
│       ├── history.py             # 編集履歴記録ヘルパー（現 services/history.py）
│       ├── notification.py        # Slack Webhook 通知（現 services/notification.py）
│       └── project_number.py      # 工事番号採番（現 services/project_number.py）
│
├── modules/                       # ★ NEW（ドメインモジュール群）
│   │
│   ├── auth/                      # 認証・ユーザー管理
│   │   ├── models.py              # User（現 models/user.py）
│   │   ├── schemas.py             # LoginRequest / TokenResponse / UserRead
│   │   ├── router.py              # /auth/* / /admin/users（現 auth.py + admin.py の user 部分）
│   │   └── service.py             # ログイン・トークン処理
│   │
│   ├── customer/                  # 顧客マスタ
│   │   ├── models.py              # Client / ClientSite / ClientContact
│   │   ├── schemas.py             # ClientCreate / ClientDetail
│   │   └── router.py              # /clients/*（現 clients.py）
│   │
│   ├── vendor/                    # 業者マスタ
│   │   ├── models.py              # Vendor / VendorPriceHistory
│   │   ├── schemas.py             # VendorCreate / VendorDetail / PriceHistoryRead
│   │   └── router.py              # /vendors/*（現 vendors.py）
│   │
│   ├── project/                   # 案件管理
│   │   ├── models.py              # Project / ProjectComment
│   │   ├── schemas.py             # ProjectCreate / ProjectDetail / ProjectCounts
│   │   ├── router.py              # /projects/* / /kanban（現 projects.py + kanban.py）
│   │   └── comments_router.py     # /projects/{id}/comments（現 comments.py）
│   │
│   ├── estimate/                  # 見積・原価（Construction/Estimate）
│   │   ├── models.py              # QCDS / QCDSDirectWork / QCDSExpenseItem
│   │   │                          # Quote / QuoteVersion / QuoteSection / QuoteItem
│   │   │                          # Acknowledgment / SectionTemplate
│   │   ├── schemas/
│   │   │   ├── qcds.py            # QCDS 入出力スキーマ
│   │   │   ├── quote_core.py      # QuoteCreate / QuoteDetail
│   │   │   ├── quote_versions.py  # QuoteVersionCreate / QuoteVersionRead
│   │   │   └── quote_sections.py  # QuoteSectionCreate / QuoteItemInput
│   │   ├── routers/
│   │   │   ├── qcds.py            # /projects/{id}/qcds/*（現 qcds.py）
│   │   │   ├── quote_core.py      # /projects/{id}/quotes CRUD・approve（現 quotes.py 前半）
│   │   │   ├── quote_versions.py  # /quotes/{id}/versions/*（現 quotes.py 中盤）
│   │   │   ├── quote_sections.py  # /quotes/{id}/sections/*（現 quotes.py 後半）
│   │   │   └── acknowledgments.py # /acknowledgments/*（現 acknowledgments.py）
│   │   └── services/
│   │       ├── qcds_calculator.py # QCDS 計算ロジック（現 services/qcds_calculator.py）
│   │       └── section_templates.py # テンプレート適用サービス
│   │
│   ├── schedule/                  # 工程管理（Construction/Schedule）
│   │   ├── models.py              # ProjectTask / WorkTypeMaster / ScheduleEvent / ScheduleEventAttendee
│   │   ├── schemas.py             # TaskCreate / ScheduleEventCreate
│   │   └── router.py              # /gantt/* / /schedule/*（現 gantt.py + schedule.py）
│   │
│   ├── site/                      # 現場管理（Construction/Site）
│   │   ├── models.py              # ProgressLog / ProgressAttachment
│   │   │                          # DailyReport / DailyReportEntry / VendorAttendance
│   │   ├── schemas.py             # ProgressCreate / ReportCreate / AttendanceCreate
│   │   └── router.py              # /progress/* / /daily-reports/* / /attendance/*
│   │                              # （現 progress.py + daily_reports.py + attendance.py）
│   │
│   ├── purchase/                  # 発注管理・スキャン
│   │   ├── models.py              # PurchaseOrder / PurchaseOrderItem / VendorDelivery
│   │   │                          # ScanJob / ScanResult / ScanResultItem
│   │   ├── schemas/
│   │   │   ├── purchase.py        # PurchaseOrderCreate / PurchaseOrderRead
│   │   │   └── scan.py            # ScanJobRead / ScanJobDetailRead / ScanResultRead
│   │   ├── routers/
│   │   │   ├── orders.py          # /purchase-orders/*（現 purchase.py）
│   │   │   ├── scan_upload.py     # POST /scan/upload（現 scan.py 前半）
│   │   │   ├── scan_review.py     # GET/PATCH /scan/results/*（現 scan.py 中盤）
│   │   │   └── scan_transfer.py   # POST /scan/results/*/apply|transfer|save（現 scan.py 後半）
│   │   ├── services/
│   │   │   └── gemini_scanner.py  # Gemini Vision API（現 services/gemini_scanner.py）
│   │   └── tasks/
│   │       └── scan_tasks.py      # Celery 非同期スキャン（現 tasks/scan_tasks.py）
│   │
│   ├── report/                    # 帳票・請求・ダッシュボード
│   │   ├── models.py              # Order / Invoice / InvoiceItem / Payment
│   │   │                          # StampTaxTable / QuoteConditionTemplate / CompanySettings
│   │   ├── schemas/
│   │   │   ├── order.py           # OrderCreate / OrderRead
│   │   │   └── invoice.py         # InvoiceCreate / InvoiceRead / InvoiceSummary
│   │   ├── routers/
│   │   │   ├── orders.py          # /projects/{id}/orders/*（現 orders.py）
│   │   │   ├── invoices.py        # /projects/{id}/invoices/*（現 invoices.py）
│   │   │   ├── exports.py         # /*/export / /*/export-pdf（現 exports.py）
│   │   │   └── dashboard.py       # /dashboard（現 dashboard.py）
│   │   └── services/
│   │       ├── excel_export.py    # openpyxl 帳票出力（現 services/excel_export.py）
│   │       └── pdf_export.py      # WeasyPrint PDF 出力（現 services/pdf_export.py）
│   │
│   └── admin/                     # システム管理
│       ├── models.py              # CompanySettings（report/models.py と共有）
│       ├── schemas.py             # CompanySettingsUpdate
│       └── router.py              # /admin/* / /company-settings（現 admin.py + company_settings.py）
│
├── tasks/                         # ★ 維持（Celery 設定）
│   ├── celery_app.py              # beat_schedule 含む
│   └── invoice_tasks.py          # 入金期限チェック定期実行
│
└── main.py                        # ルーター登録（modules/* を include_router）
```

### Frontend

```
frontend/src/
│
├── lib/                           # ★ 拡張
│   ├── api-client.ts              # 変更なし（JWT Bearer fetch wrapper）
│   ├── format.ts                  # ★ NEW: fmtYen / 日付フォーマット / 数値フォーマット
│   └── utils.ts                   # 変更なし（cn ユーティリティ）
│
├── components/
│   ├── ui/                        # ★ 拡張（汎用 UI プリミティブ）
│   │   ├── button.tsx             # 変更なし
│   │   ├── input.tsx              # 変更なし
│   │   ├── table.tsx              # 変更なし
│   │   ├── dialog.tsx             # 変更なし
│   │   ├── dropdown-menu.tsx      # 変更なし
│   │   ├── command.tsx            # 変更なし
│   │   ├── StatusBadge.tsx        # ★ NEW: ステータスバッジ共通化
│   │   ├── Pagination.tsx         # ★ NEW: ページネーション UI 共通化
│   │   ├── DropZone.tsx           # ★ NEW: D&D ゾーン共通化
│   │   └── AuthImage.tsx          # ★ NEW: 認証付き画像表示
│   └── layout/
│       └── AppShell.tsx           # 変更なし
│
├── contexts/                      # 変更なし
│   ├── auth-context.tsx
│   └── project-context.tsx
│
├── modules/                       # ★ NEW（ドメイン別コンポーネント・型）
│   ├── customer/
│   │   ├── SiteSearch.tsx         # 移動（現 components/client/SiteSearch.tsx）
│   │   └── types.ts               # 移動（現 types/client.ts）
│   ├── vendor/
│   │   └── types.ts               # 移動（現 types/vendor.ts）
│   ├── project/
│   │   ├── CreateProjectModal.tsx  # 移動（現 components/projects/create-project-modal.tsx）
│   │   ├── ProjectStatusBadge.tsx  # 移動（現 components/project/ProjectStatusBadge.tsx）
│   │   ├── ProjectSubNav.tsx       # 移動（現 components/project/ProjectSubNav.tsx）
│   │   └── types.ts               # 移動（現 types/project.ts）
│   ├── estimate/
│   │   ├── QCDSDirectWorkTable.tsx # ★ NEW: qcds/page.tsx から分離
│   │   ├── QCDSExpensePanel.tsx    # ★ NEW: qcds/page.tsx から分離
│   │   ├── SectionBlock.tsx        # ★ NEW: quote/[quote_id]/page.tsx から分離
│   │   ├── ApprovalStamps.tsx      # ★ NEW: quote/[quote_id]/page.tsx から分離
│   │   ├── QuoteTotals.tsx         # ★ NEW: quote/[quote_id]/page.tsx から分離
│   │   ├── ScanZone.tsx            # ★ NEW: estimate/page.tsx から分離
│   │   ├── VersionCard.tsx         # ★ NEW: estimate/page.tsx から分離
│   │   └── types.ts               # 移動（現 types/quote.ts + types/qcds.ts）
│   ├── schedule/
│   │   └── types.ts
│   ├── site/
│   │   └── types.ts
│   ├── purchase/
│   │   ├── JobRow.tsx             # 移動（現 components/scan/JobRow.tsx）
│   │   ├── BulkActionBar.tsx      # 移動（現 components/scan/BulkActionBar.tsx）
│   │   ├── ProjectPickerCard.tsx  # 移動（現 components/scan/ProjectPickerCard.tsx）
│   │   └── types.ts              # 移動（現 types/scan.ts）
│   └── report/
│       └── types.ts              # 移動（現 types/order.ts + types/invoice.ts）
│
└── app/                           # 変更なし（URL ルーティング構造は維持）
    └── ...（35ページ、構造そのまま）
```

---

## 2. モジュール一覧

| モジュール | 担当ドメイン | Backend ファイル数 | Frontend ファイル数 | 依存先 |
|-----------|------------|:-----------------:|:------------------:|-------|
| **auth** | 認証・ユーザー | 4 | 2 | shared, core |
| **customer** | 顧客マスタ | 3 | 2 | shared, core |
| **vendor** | 業者マスタ | 3 | 2 | shared, core |
| **project** | 案件管理 | 4 | 4 | shared, core, customer |
| **estimate** | 見積・QCDS・原価 | 9 | 8 | shared, core, project, vendor |
| **schedule** | 工程・ガント・スケジュール | 3 | 2 | shared, core, project |
| **site** | 現場・日報・写真・出面 | 3 | 2 | shared, core, project |
| **purchase** | 発注書・スキャン（Gemini） | 8 | 5 | shared, core, project, vendor |
| **report** | 注文書・請求書・帳票・ダッシュボード | 8 | 4 | shared, core, project, estimate |
| **admin** | 会社設定・システム管理 | 3 | 3 | shared, core |

### モジュール別責務と制約

#### auth
- **責務**: JWT ログイン / リフレッシュ / ユーザー CRUD
- **制約**: 他のモジュールから import される（deps.py 経由）。変更は全体に影響するため安定化優先

#### customer
- **責務**: 顧客・店舗・担当者のマスタ管理
- **制約**: 他モジュールへの依存なし。`Project` からの FK 参照のみ受ける（参照は project モジュール側で持つ）

#### vendor
- **責務**: 業者マスタ・単価履歴管理
- **制約**: `purchase` モジュールから参照される。単価履歴の書き込みは purchase モジュールの scan_tasks から行う

#### project
- **責務**: 案件 CRUD・ステータス遷移・カンバン・コメント・編集履歴
- **制約**: 全モジュールの親。project_id を FK で持つテーブルは全ドメインに分散するが、Project モデル本体はこのモジュールのみが持つ

#### estimate（最複雑）
- **責務**: QCDS 原価算定・業者見積版・顧客見積書・稟議承認・見積テンプレート
- **制約**: 現 quotes.py (1,279行) を 4 ルーターに分割。`project` モジュールの create_project から Quote 自動生成を `estimate/routers/quote_core.py` に移管

#### schedule
- **責務**: ガントチャートタスク・工種マスタ・スケジュールイベント・出席回答
- **制約**: project への読み取り依存のみ。外部ドメインへの書き込みなし

#### site
- **責務**: 進捗ログ・写真台帳・日報・出面記録
- **制約**: project への読み取り依存のみ。ファイルアップロードは `core/config.py` のアップロードディレクトリを使用

#### purchase
- **責務**: 発注書管理・業者見積スキャン（Gemini Vision）・Celery 非同期処理
- **制約**: 現 scan.py (1,001行) を 3 ルーターに分割。Celery タスクと API ルーターの分離が重要。vendor モジュールへの書き込み（業者マスタ自動登録）は vendor の公開 service を呼ぶ形に変更

#### report
- **責務**: 注文書・請求書・入金記録・Excel/PDF 帳票出力・ダッシュボード集計
- **制約**: 全モジュールの集計を行う。ダッシュボードは読み取り専用。帳票出力は project/estimate/purchase の各モデルを参照するため、SQLAlchemy の cross-module select が必要

#### admin
- **責務**: 会社設定・印紙税マスタ・見積条件テンプレート・ユーザー管理（auth と分離）
- **制約**: super_admin / admin ロールチェックが必須

---

## 3. Shared 一覧

### Backend Shared

| 機能 | 現在の場所 | 移行先 | 全モジュールへの影響 |
|-----|------------|--------|:------------------:|
| `TimestampMixin` | `models/base.py` | `shared/models/base.py` | 全モデルが継承 |
| 全 Enum 定義 | `models/enums.py` | `shared/models/enums.py` | 全モジュールが import |
| `EditHistory` モデル | `models/history.py` | `shared/models/history.py` | project, estimate, report が利用 |
| 編集履歴記録ヘルパー | `services/history.py` | `shared/services/history.py` | project, estimate, report が利用 |
| 工事番号採番 | `services/project_number.py` | `shared/services/project_number.py` | project のみ |
| Slack 通知 | `services/notification.py` | `shared/services/notification.py` | project, report が利用 |
| ページネーション共通型 | 各スキーマに散在 | `shared/schemas/common.py` | 全モジュール |
| `get_current_user` 依存注入 | `core/deps.py` | 変更なし | 全ルーター |
| DB セッション | `core/database.py` | 変更なし | 全ルーター |
| JWT / パスワードハッシュ | `core/security.py` | 変更なし | auth のみ |
| 環境変数設定 | `core/config.py` | 変更なし | 全モジュール |

### Frontend Shared（新規作成）

| ファイル | 内容 | 現在の散在状況 |
|---------|------|--------------|
| `lib/format.ts` | `fmtYen()` / 日付フォーマット / 分→時間変換 | 各ページで重複定義（例: `fmtYen` が purchase, purchases, estimate 等に存在） |
| `components/ui/StatusBadge.tsx` | ステータス名・色・バッジ UI | 各ページに `STATUS_LABEL` / `STATUS_COLOR` レコードが重複 |
| `components/ui/Pagination.tsx` | 前へ/次へボタン・ページ表示 | 各ページに重複実装 |
| `components/ui/DropZone.tsx` | D&D ゾーン（ドラッグオーバー・ファイル選択） | purchase/page.tsx, estimate/page.tsx で重複 |
| `components/ui/AuthImage.tsx` | 認証ヘッダー付き fetch → blob URL 変換 | progress/page.tsx, photo-album/page.tsx で重複 |
| `lib/api-client.ts` | 変更なし | — |
| `contexts/auth-context.tsx` | 変更なし | — |
| `contexts/project-context.tsx` | 変更なし | — |
| `components/layout/AppShell.tsx` | 変更なし | — |

---

## 4. 移行順序

移行は**ゼロダウンタイム**・**段階的**・**ロールバック可能**な順序で行います。

```
Phase 0  ──── Phase 1  ──── Phase 2  ──── Phase 3  ──── Phase 4  ──── Phase 5
基盤確認     Shared整備    葉モジュール   中間モジュール   複雑モジュール   仕上げ
```

---

### Phase 0: 現状確認・テスト基盤整備（事前作業）

**目的:** 移行前のベースラインを確保する。コード変更なし。

| 作業 | 詳細 | 担当 |
|-----|------|------|
| 全エンドポイント疎通確認 | Postman/curl で主要 API の 200 応答を記録 | ひさん |
| フロントエンド画面スクリーンショット | 移行後との比較用（主要10画面） | ひさん |
| `git tag v0-pre-migration` 作成 | ロールバックポイント | Claude |
| pytest 実行・テスト結果記録 | 現状のテスト通過率を把握 | Claude |

---

### Phase 1: Shared 整備（Backend + Frontend）

**影響範囲:** 全モジュール（import パスが変わるため注意）
**推奨期間:** 1〜2日

#### Phase 1-A: Backend Shared（低リスク）

```
作業:
1. shared/ ディレクトリ作成
2. models/base.py → shared/models/base.py に移動
3. models/enums.py → shared/models/enums.py に移動
4. models/history.py → shared/models/history.py に移動
5. services/history.py → shared/services/history.py に移動
6. services/project_number.py → shared/services/project_number.py に移動
7. services/notification.py → shared/services/notification.py に移動
8. 旧パスに後方互換 re-export を残す（from shared.xxx import xxx）
9. Docker rebuild → 全エンドポイント疎通確認
```

#### Phase 1-B: Frontend Shared（低リスク）

```
作業:
1. lib/format.ts 新規作成（fmtYen, fmtDate, fmtMinutes を集約）
2. components/ui/StatusBadge.tsx 新規作成
3. components/ui/Pagination.tsx 新規作成
4. components/ui/DropZone.tsx 新規作成
5. components/ui/AuthImage.tsx 新規作成
6. 既存ページの重複実装を新コンポーネントに差し替え（ページ単位で順次）
7. cmv3-web rebuild → 全画面目視確認
```

**チェックポイント:**
- [ ] `alembic upgrade head` が通ること
- [ ] 全 API エンドポイントが 200/401 を返すこと
- [ ] フロントエンド全画面がエラーなく表示されること

---

### Phase 2: 葉モジュール（Customer / Vendor / Admin）

**影響範囲:** 限定的（他モジュールへの依存なし）
**推奨期間:** 1日

```
作業:
1. modules/customer/ ディレクトリ作成
   - clients.py → modules/customer/router.py（パス維持）
   - models/client.py → modules/customer/models.py
   - schemas/client.py → modules/customer/schemas.py
   - components/client/SiteSearch.tsx → modules/customer/SiteSearch.tsx

2. modules/vendor/ ディレクトリ作成
   - vendors.py → modules/vendor/router.py
   - models/vendor.py → modules/vendor/models.py
   - schemas/vendor.py → modules/vendor/schemas.py

3. modules/admin/ ディレクトリ作成
   - admin.py → modules/admin/router.py
   - company_settings.py → modules/admin/router.py に統合

4. main.py の include_router パスを更新
5. Docker rebuild → 疎通確認
```

**チェックポイント:**
- [ ] `/clients/*` 全エンドポイント正常
- [ ] `/vendors/*` 全エンドポイント正常
- [ ] `/admin/*` 全エンドポイント正常
- [ ] 顧客一覧・業者一覧画面が正常表示

---

### Phase 3: Project モジュール

**影響範囲:** 全モジュールの親。慎重に。
**推奨期間:** 1〜2日

```
作業:
1. modules/project/ ディレクトリ作成
   - projects.py → modules/project/router.py
   - kanban.py → modules/project/kanban_router.py
   - comments.py → modules/project/comments_router.py
   - models/project.py → modules/project/models.py
   - schemas/project.py → modules/project/schemas.py

2. 重要: create_project 内の Quote 自動生成ロジックを
         modules/estimate/services/quote_service.py に移管予定
         （Phase 4 まで一時的に project/router.py に残す）

3. 旧 modules/project/models.py から他モジュールが
   project_id FK を参照できるよう shared な Project import パスを整備

4. Docker rebuild → 案件 CRUD / ステータス遷移 / カンバン 疎通確認
```

**チェックポイント:**
- [ ] 案件作成→詳細→ステータス変更→削除 フロー正常
- [ ] カンバン画面正常
- [ ] 工事番号自動採番正常
- [ ] Slack 通知（ステータス変更時）正常

---

### Phase 4: Construction サブモジュール（Schedule / Site）

**影響範囲:** 中程度（project に依存するが他への影響なし）
**推奨期間:** 1日

```
作業:
1. modules/schedule/ ディレクトリ作成
   - gantt.py + schedule.py → modules/schedule/router.py
   - models/gantt.py + models/schedule.py → modules/schedule/models.py

2. modules/site/ ディレクトリ作成
   - progress.py + daily_reports.py + attendance.py → modules/site/router.py
   - models/progress.py + models/daily_report.py + models/attendance.py → modules/site/models.py

3. Docker rebuild → 疎通確認
```

**チェックポイント:**
- [ ] ガントチャート・全社工程表 正常
- [ ] スケジュールカレンダー 正常
- [ ] 日報作成・提出 正常
- [ ] 出面台帳 正常
- [ ] 進捗ログ・写真アップロード 正常

---

### Phase 5: Purchase モジュール（scan.py 分割）

**影響範囲:** scan.py 1,001行 の分割。Celery タスクへの影響あり。
**推奨期間:** 2〜3日（最高リスク）

```
作業:
1. modules/purchase/ ディレクトリ作成

2. scan.py の分割（最大の作業）:
   scan_upload.py   ← POST /scan/upload, GET /scan/jobs, GET /scan/jobs/{id}
   scan_review.py   ← GET/PATCH /scan/results/*, POST /confirm
   scan_transfer.py ← POST /apply, /transfer-to-qcds, /save-as-version
                      POST /bulk-apply, /bulk-delete, /bulk-restore, /bulk-purge

3. Celery タスクの scan_tasks.py が scan_transfer.py を呼ぶように依存調整
4. purchase.py → modules/purchase/routers/orders.py
5. models/purchase.py + models/scan.py → modules/purchase/models.py
6. schemas/scan.py → modules/purchase/schemas/scan.py

7. Docker rebuild（cmv3-api + cmv3-worker 両方）→ 疎通確認
8. 実際のファイルをアップロードしてスキャン→転記フローをエンドツーエンドテスト
```

**チェックポイント:**
- [ ] PDF アップロード → Celery ジョブ pending → processing → succeeded
- [ ] スキャン結果レビュー画面 正常
- [ ] QCDS への転記 正常
- [ ] 業者見積版として保存 正常
- [ ] 一括操作（bulk-apply / bulk-delete）正常
- [ ] 発注書 CRUD・ステータス遷移 正常
- [ ] 発注書 D&D スキャン 正常

---

### Phase 6: Estimate モジュール（最複雑・最高リスク）

**影響範囲:** quotes.py 1,279行 の分割。全ページ最大の変更。
**推奨期間:** 3〜5日

```
作業:
1. modules/estimate/ ディレクトリ作成

2. quotes.py の分割:
   routers/quote_core.py      ← 見積書 CRUD / approve / import-items（〜400行）
   routers/quote_versions.py  ← 版 CRUD / reflect-from-version（〜300行）
   routers/quote_sections.py  ← 大項目 CRUD / 明細 CRUD（〜400行）

3. qcds.py → routers/qcds.py（単純移動、内部は変更なし）

4. _quote_reflect.py → services/quote_service.py に統合

5. Frontend の分割（最大の作業）:
   qcds/page.tsx (1,293行):
     ← modules/estimate/QCDSDirectWorkTable.tsx
     ← modules/estimate/QCDSExpensePanel.tsx

   quote/[quote_id]/page.tsx (1,292行):
     ← modules/estimate/SectionBlock.tsx
     ← modules/estimate/ApprovalStamps.tsx
     ← modules/estimate/QuoteTotals.tsx

   estimate/page.tsx (1,267行):
     ← modules/estimate/ScanZone.tsx
     ← modules/estimate/VersionCard.tsx

6. project/router.py の create_project から Quote 自動生成を
   estimate/services/quote_service.py に移管

7. Docker rebuild → 全見積フローをエンドツーエンドテスト
```

**チェックポイント:**
- [ ] 見積書作成・大項目追加・明細追加 正常
- [ ] 業者見積版管理・掛率設定 正常
- [ ] 稟議承認スタンプ 正常（押印→リロード後も保持）
- [ ] QCDS 原価算定表・経費行 正常
- [ ] スキャン→版作成→QCDS 反映→顧客見積反映 フロー正常
- [ ] 見積書 Excel / PDF 出力 正常

---

### Phase 7: Report モジュール + 仕上げ

**影響範囲:** 中程度（帳票出力サービスの移動）
**推奨期間:** 1〜2日

```
作業:
1. modules/report/ ディレクトリ作成
   - orders.py → modules/report/routers/orders.py
   - invoices.py → modules/report/routers/invoices.py
   - exports.py → modules/report/routers/exports.py
   - dashboard.py → modules/report/routers/dashboard.py
   - services/excel_export.py → modules/report/services/excel_export.py
   - services/pdf_export.py → modules/report/services/pdf_export.py

2. 旧 api/v1/ の残ファイルをすべて modules/ に統合
3. 旧 api/v1/__init__.py を削除、main.py を modules/* からの include_router に更新
4. 旧 models/*.py の後方互換 re-export を削除（Phase 1 で追加した暫定 import）
5. Docker rebuild → 全エンドポイント最終疎通確認

6. git tag v1-modular-complete
```

**チェックポイント:**
- [ ] 注文書 CRUD + PDF 出力 正常
- [ ] 請求書 CRUD + 入金記録 + PDF 出力 正常
- [ ] ダッシュボード KPI / チャート / 未払いアラート 正常
- [ ] Excel インポート 正常
- [ ] 旧 import パスの後方互換コードが存在しないこと（grep 確認）

---

## 5. リスク

### 🔴 高リスク

| リスク | 影響範囲 | 発生フェーズ | 対策 |
|-------|---------|:----------:|------|
| **SQLAlchemy relationship の import 循環** | 全モデル | Phase 2〜6 | モデルは `TYPE_CHECKING` ブロック内で `from __future__ import annotations` を使用。実行時 import を遅延させる |
| **quotes.py 1,279行 の分割によるバグ** | 見積全機能 | Phase 6 | 分割前に curl による全エンドポイント応答を記録し、分割後に再確認。git revert で即ロールバック可能にしておく |
| **scan.py 分割と Celery タスクの不整合** | スキャン機能全般 | Phase 5 | `scan_tasks.py` が参照する関数を先に `scan_transfer.py` に移動してから routers を分割する順序を守る |
| **Alembic env.py の models import パス変更** | DB マイグレーション | Phase 2〜 | `alembic/env.py` の `target_metadata` に全モジュールの metadata を登録し直す。マイグレーション生成前に必ず `alembic check` を実行 |

### 🟠 中リスク

| リスク | 影響範囲 | 発生フェーズ | 対策 |
|-------|---------|:----------:|------|
| **project.create_project → Quote 自動生成の移管** | 案件作成フロー | Phase 3→6 | Phase 3 では project/router.py に残し、Phase 6 で estimate に移管。中間期間は二重管理になるが動作は変わらない |
| **cross-module の SQLAlchemy select** | dashboard, exports | Phase 7 | report モジュールは他モジュールのモデルを直接 import してよい（依存方向: report → 全モジュール）。この方向は許容する |
| **Frontend ページの巨大コンポーネント分割** | qcds / quote / estimate ページ | Phase 6 | コンポーネント分割は「抽出」であり既存ロジックを変えない。props 設計を間違えると state 管理が壊れる。1コンポーネントずつ抽出して都度動作確認 |
| **AppShell のナビ項目参照がモジュール移動で壊れる** | 全画面ナビ | Phase 2〜 | AppShell は `app/` の URL を直接参照するため、コンポーネント移動の影響なし |

### 🟡 低リスク

| リスク | 影響範囲 | 対策 |
|-------|---------|------|
| **`shared/models/enums.py` への import パス変更** | 全モデルファイル | 旧パス（`from app.models.enums import ...`）に後方互換 re-export を残し、各フェーズで順次更新 |
| **`lib/format.ts` 導入後の既存重複コードの残存** | フロント各ページ | 新ファイル導入は即座に効果があるが、旧重複コードの削除は任意。段階的でよい |
| **Celery worker のイメージ再ビルド忘れ** | スキャン処理 | cmv3-api と cmv3-worker は同一コードベースなので api の rebuild 時に worker も必ず再ビルドする |

### リスク総括マトリクス

```
          影響大                           影響小
          │                               │
深刻  ────┼──────────────────────────────┼────
度    │   │  quotes.py 分割   scan.py分割 │
高    │   │  Alembic import              │
      │   │  project→estimate移管        │
      ────┼──────────────────────────────┼────
      │   │  cross-module select         │  enums import
低    │   │  AppShell ナビ               │  format.ts 導入
      ────┴──────────────────────────────┴────
```

---

## 付録: 移行前後の比較

### Backend ファイル数比較

| 場所 | 移行前 | 移行後 | 備考 |
|-----|:------:|:------:|------|
| `api/v1/*.py` | 26 | 0 | すべて `modules/` に移動 |
| `models/*.py` | 23 | 0 | `modules/*/models.py` に移動 |
| `schemas/*.py` | 14 | 0 | `modules/*/schemas/` に移動 |
| `services/*.py` | 9 | 2 | `shared/` と `modules/*/services/` に分散 |
| `modules/*/` | 0 | 〜45 | ドメイン別に整理 |
| `shared/` | 0 | 〜10 | 横断共通のみ |
| `core/` | 4 | 4 | 変更なし |

### Frontend ファイル数比較

| 場所 | 移行前 | 移行後 | 備考 |
|-----|:------:|:------:|------|
| `components/ui/*.tsx` | 6 | 10 | StatusBadge / Pagination / DropZone / AuthImage 追加 |
| `components/project/*.tsx` | 2 | 0 | `modules/project/` に移動 |
| `components/scan/*.tsx` | 3 | 0 | `modules/purchase/` に移動 |
| `components/client/*.tsx` | 1 | 0 | `modules/customer/` に移動 |
| `lib/*.ts` | 2 | 3 | `format.ts` 追加 |
| `types/*.ts` | 10 | 0 | `modules/*/types.ts` に移動 |
| `modules/*/` | 0 | 〜25 | ドメイン別コンポーネント・型 |
| `app/` （ページ） | 35 | 35 | URL 構造・ページ数は変更なし |

### AI 開発時のコンテキスト削減効果（推定）

| 対象タスク | 移行前コンテキスト | 移行後コンテキスト | 削減率 |
|-----------|:----------------:|:----------------:|:-----:|
| 見積書の明細追加修正 | quotes.py 1,279行 + page.tsx 1,292行 | quote_sections.py ~400行 + SectionBlock.tsx ~200行 | **約70%削減** |
| QCDS 計算修正 | qcds.py 508行 + page.tsx 1,293行 | qcds.py 508行 + QCDSExpensePanel.tsx ~300行 | **約50%削減** |
| スキャン転記修正 | scan.py 1,001行 | scan_transfer.py ~300行 | **約70%削減** |
| 発注書修正 | purchase.py 420行 + page.tsx 599行 | orders.py 420行 + page.tsx 599行 | 変化なし（元から適切） |
| ダッシュボード修正 | dashboard.py 314行 + page.tsx ~400行 | 変化なし | — |
