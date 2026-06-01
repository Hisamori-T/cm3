# Construction Manager v3 — AI 開発向けアーキテクチャ分析

> 作成日: 2026-06-01
> 目的: 工事台帳システムをAI開発しやすい構造へ変更するための現状分析

---

## 1. 現在のフォルダ構成（全体マップ）

```
Construction_Manager_v3/
├── backend/app/
│   ├── api/v1/          26ファイル（エンドポイント）
│   ├── models/          23ファイル（ORM）
│   ├── schemas/         14ファイル（Pydantic）
│   ├── services/        9ファイル（ビジネスロジック）
│   ├── tasks/           3ファイル（Celery 非同期）
│   └── core/            4ファイル（横断基盤）
└── frontend/src/
    ├── app/             35ページ（Next.js App Router）
    ├── components/      15コンポーネント
    ├── contexts/        2コンテキスト
    ├── types/           10型定義
    └── lib/             2ユーティリティ
```

**合計規模:** Backend ~6,500行・Frontend ~15,000行・Alembic migration 19本

---

## 2. 業務ドメイン × 現在の実装マッピング

---

### 🏢 Customer（顧客マスタ）

| レイヤー | ファイル | 内容 |
|---------|---------|------|
| API | `api/v1/clients.py` 331行 | 顧客・店舗・担当者 CRUD |
| Model | `models/client.py` | Client / ClientSite / ClientContact |
| Schema | `schemas/client.py` | 顧客 Pydantic スキーマ |
| Frontend | `app/clients/page.tsx` | 顧客一覧（ランクフィルタ・ページネーション） |
| Frontend | `app/clients/[id]/page.tsx` 895行 | 顧客詳細（店舗・担当者・関連案件） |
| Component | `components/client/SiteSearch.tsx` | 顧客+店舗 2段階検索コンポーネント |
| Type | `types/client.ts` | Client 型定義 |

**エンドポイント一覧:**
- `GET /clients/search` — インクリメンタル検索
- `GET /clients` / `POST /clients`
- `GET /clients/{id}` / `PATCH /clients/{id}` / `DELETE /clients/{id}`
- `GET /clients/{id}/sites` / `POST /clients/{id}/sites` / `PATCH /clients/{id}/sites/{site_id}`
- `GET /clients/{id}/contacts` / `POST /clients/{id}/contacts`

**特徴:**
- ほぼ独立。`Project` への FK（`client_id`, `client_site_id`, `client_contact_id`）でのみ他ドメインと結合
- モジュール境界が最も明確で健全度が高い

---

### 📋 Project（案件管理）

| レイヤー | ファイル | 内容 |
|---------|---------|------|
| API | `api/v1/projects.py` 454行 | 案件CRUD・ステータス遷移・履歴・カンバン |
| API | `api/v1/kanban.py` | カンバンビュー・移動 |
| API | `api/v1/comments.py` | コメント・絵文字リアクション |
| Model | `models/project.py`, `models/history.py`, `models/comment.py` | Project / EditHistory / ProjectComment |
| Schema | `schemas/project.py` | ProjectCreate / ProjectUpdate / ProjectDetail / ProjectCounts |
| Service | `services/project_number.py` | 工事番号自動採番（`{西暦下2桁}-{社員番号}-{連番}`） |
| Service | `services/history.py` | 編集履歴記録共通ヘルパー |
| Frontend | `app/projects/page.tsx` | 案件一覧（フィルタバー・ページネーション） |
| Frontend | `app/projects/[id]/page.tsx` 734行 | 案件詳細（7段階ステータス・編集モード） |
| Frontend | `app/projects/[id]/layout.tsx` | サブナビコンテキスト提供 |
| Frontend | `app/projects/[id]/history/page.tsx` | 編集履歴一覧 |
| Frontend | `app/projects/kanban/page.tsx` | カンバン（DnD） |
| Context | `contexts/project-context.tsx` | サブナビ状態（projectId / counts） |
| Type | `types/project.ts` | Project 型定義 |

**エンドポイント一覧:**
- `GET /projects` — 一覧（status / year / sales_person_id / client_id / q フィルタ）
- `POST /projects` — 作成（工事番号自動採番・Quote 自動生成）
- `GET /projects/{id}` — 詳細（関連件数含む）
- `PATCH /projects/{id}` — 更新
- `DELETE /projects/{id}` — 論理削除
- `POST /projects/{id}/status` — ステータス変更（履歴記録・Slack 通知）
- `GET /projects/{id}/history` — 編集履歴
- `GET /projects/kanban` — カンバンビュー
- `PATCH /projects/{id}/kanban/move` — カード移動
- `GET/POST/DELETE /projects/{id}/comments` — コメント CRUD
- `POST /projects/{id}/comments/{id}/react` — リアクション

**特徴:**
- 全ドメインの**親エンティティ**（project_id が全テーブルに伝播）
- 7段階ステータス・Slack 通知・論理削除・自動採番が独自ロジック
- 案件作成時に Quote も自動生成される（quotes.py との暗黙結合）

---

### 🏗 Construction（施工管理）

このドメインは最も複雑で、3つのサブドメインに分かれます。

#### Construction / Estimate（見積・原価）

| レイヤー | ファイル | 行数 | 内容 |
|---------|---------|:----:|------|
| API | `api/v1/qcds.py` | 508 | QCDS 原価算定・リビジョン・経費行 |
| API | `api/v1/quotes.py` | **1,279** | 見積書・版・大項目・明細・稟議 |
| API | `api/v1/_quote_reflect.py` | — | スキャン→見積反映サブモジュール |
| API | `api/v1/section_templates.py` | — | 見積テンプレート CRUD |
| API | `api/v1/acknowledgments.py` | — | 注文請書 |
| Model | `models/qcds.py` | — | QCDS / QCDSDirectWork / QCDSExpenseItem |
| Model | `models/quote.py` | — | Quote / QuoteVersion / QuoteSection / QuoteItem |
| Model | `models/acknowledgment.py` | — | Acknowledgment |
| Schema | `schemas/qcds.py`, `schemas/quote.py` | — | — |
| Service | `services/qcds_calculator.py` | — | 保険料・経費率・粗利計算 |
| Frontend | `app/projects/[id]/qcds/page.tsx` | **1,293** | QCDS 原価算定表 |
| Frontend | `app/projects/[id]/estimate/page.tsx` | **1,267** | 業者見積版管理 |
| Frontend | `app/projects/[id]/quote/[quote_id]/page.tsx` | **1,292** | 顧客見積書エディタ |
| Frontend | `app/projects/[id]/quote/page.tsx` | — | 見積書一覧 |
| Type | `types/quote.ts`, `types/qcds.ts` | — | — |

**エンドポイント一覧（主要）:**
- `GET/PUT /projects/{id}/qcds` — QCDS 取得・一括保存
- `POST /projects/{id}/qcds/new-revision` — リビジョン複製
- `DELETE /projects/{id}/qcds/direct-works/{work_id}` — 直接工事費行削除
- `GET/POST /projects/{id}/quotes` — 見積書一覧・作成
- `GET/PATCH /projects/{id}/quotes/{quote_id}` — 見積書詳細・更新
- `POST /projects/{id}/quotes/{quote_id}/approve` — 稟議押印
- `GET/POST/PATCH/DELETE /projects/{id}/quotes/{quote_id}/versions` — 業者見積版 CRUD
- `GET/POST/PATCH/DELETE /projects/{id}/quotes/{quote_id}/sections` — 大項目 CRUD
- `POST /projects/{id}/qcds/reflect-from-version` — QCDS への反映
- `POST /projects/{id}/quotes/{quote_id}/reflect-from-version` — 顧客見積への反映

#### Construction / Schedule（工程管理）

| レイヤー | ファイル | 内容 |
|---------|---------|------|
| API | `api/v1/gantt.py` 247行 | タスク CRUD・ガント全社ビュー |
| Model | `models/gantt.py` | ProjectTask / WorkTypeMaster |
| Frontend | `app/projects/[id]/gantt/page.tsx` | 案件ガントチャート（遅延ハイライト・担当者） |
| Frontend | `app/gantt/page.tsx` | 全社工程表（案件軸/メンバー軸） |

**エンドポイント一覧:**
- `GET /work-types` — 工種マスタ
- `GET/POST /projects/{id}/tasks` — タスク一覧・作成
- `PATCH/DELETE /projects/{id}/tasks/{task_id}` — タスク更新・削除
- `GET /gantt/all` — 全社ガントチャート（assigned_user_name 含む）

#### Construction / Site（現場管理）

| レイヤー | ファイル | 行数 | 内容 |
|---------|---------|:----:|------|
| API | `api/v1/progress.py` | 211 | 進捗ログ・写真・図面アップロード |
| API | `api/v1/attendance.py` | 222 | 出面記録・月次集計 |
| API | `api/v1/daily_reports.py` | 262 | 日報・エントリ・提出 |
| API | `api/v1/schedule.py` | 208 | スケジュールイベント・出席回答 |
| Model | `models/progress.py`, `models/attendance.py` | — | ProgressLog / ProgressAttachment / VendorAttendance |
| Model | `models/daily_report.py`, `models/schedule.py` | — | DailyReport / ScheduleEvent / ScheduleEventAttendee |
| Frontend | `app/projects/[id]/progress/page.tsx` | 556 | 進捗・施工記録（テキスト/写真/図面） |
| Frontend | `app/projects/[id]/photo-album/page.tsx` | — | 写真台帳・ライトボックス・PDF 出力 |
| Frontend | `app/projects/[id]/attendance/page.tsx` | — | 出面台帳（月次フィルタ） |
| Frontend | `app/daily-report/page.tsx` | — | 日報タイムライン |
| Frontend | `app/calendar/page.tsx` | 721 | カレンダー（イベント・日報・支払期日統合） |

**エンドポイント一覧:**
- `GET/POST /projects/{id}/progress` — 進捗ログ
- `DELETE /projects/{id}/progress/{log_id}` — 進捗削除
- `GET/DELETE /progress/attachments/{attachment_id}` — 添付ファイル
- `GET/POST/PATCH/DELETE /projects/{id}/attendance` — 出面 CRUD
- `GET /projects/{id}/attendance/summary` — 出面月次集計
- `GET/POST/PATCH/DELETE /daily-reports` — 日報 CRUD
- `POST /daily-reports/{id}/submit` — 日報提出
- `GET/POST/PATCH/DELETE /schedule` — スケジュール CRUD
- `PATCH /schedule/{id}/respond` — 出席回答

---

### 📊 Report（帳票・レポート）

| レイヤー | ファイル | 行数 | 内容 |
|---------|---------|:----:|------|
| API | `api/v1/exports.py` | 387 | Excel/PDF 出力エンドポイント 10本 |
| API | `api/v1/orders.py` | 289 | 注文書 CRUD |
| API | `api/v1/invoices.py` | 413 | 請求書・入金記録・サマリー |
| API | `api/v1/dashboard.py` | 314 | KPI・未払いアラート・稼働時間 |
| API | `api/v1/admin.py` | — | 印紙税マスタ・見積条件テンプレート |
| Model | `models/order.py`, `models/invoice.py` | — | Order / Invoice / InvoiceItem / Payment |
| Model | `models/master.py` | — | StampTaxTable / QuoteConditionTemplate |
| Schema | `schemas/order.py`, `schemas/invoice.py` | — | — |
| Service | `services/excel_export.py` | — | openpyxl 帳票出力（見積・注文・請求） |
| Service | `services/pdf_export.py` | — | WeasyPrint PDF（Noto CJK JP） |
| Service | `services/notification.py` | — | Slack Webhook 通知 |
| Service | `services/document_sync_service.py` | — | 帳票間データ同期 |
| Frontend | `app/projects/[id]/order/page.tsx` | — | 注文書（案件適用ボタン・発行権限） |
| Frontend | `app/projects/[id]/invoice/page.tsx` | — | 請求書一覧・サマリーバー |
| Frontend | `app/projects/[id]/invoice/[invoice_id]/page.tsx` | — | 請求書詳細・入金記録 |
| Frontend | `app/dashboard/page.tsx` | — | ダッシュボード（SVG チャート） |
| Frontend | `app/admin/*.tsx` | — | 印紙税・見積条件・ユーザー管理 |
| Type | `types/order.ts`, `types/invoice.ts` | — | — |

**エンドポイント一覧:**
- `GET/POST /projects/{id}/orders` — 注文書一覧・作成
- `GET/PATCH /projects/{id}/orders/{order_id}` — 注文書詳細・更新
- `GET/POST /projects/{id}/invoices` — 請求書一覧・作成
- `GET/PATCH /projects/{id}/invoices/{invoice_id}` — 請求書詳細・更新
- `POST /projects/{id}/invoices/{invoice_id}/payments` — 入金記録追加
- `DELETE /projects/{id}/invoices/{invoice_id}/payments/{payment_id}` — 入金記録削除
- `GET /projects/{id}/invoice-summary` — 請求集計
- `GET /dashboard` — KPI・ステータス分布・未払いアラート・稼働時間
- `GET /projects/{id}/quotes/{quote_id}/export` — 見積書 Excel 出力
- `GET /projects/{id}/orders/{order_id}/export` — 注文書 Excel 出力
- `GET /projects/{id}/invoices/{invoice_id}/export` — 請求書 Excel 出力
- `GET /projects/{id}/quotes/{quote_id}/export-pdf` — 見積書 PDF 出力
- `GET /projects/{id}/orders/{order_id}/export-pdf` — 注文書 PDF 出力
- `GET /projects/{id}/invoices/{invoice_id}/export-pdf` — 請求書 PDF 出力
- `GET /acknowledgments/{id}/export-pdf` — 注文請書 PDF 出力
- `GET /projects/{id}/photo-album/export-pdf` — 写真帳 PDF 出力

---

### 🛒 Purchase（発注管理）

| レイヤー | ファイル | 行数 | 内容 |
|---------|---------|:----:|------|
| API | `api/v1/purchase.py` | 420 | 発注書 CRUD・ステータス遷移・支払期日 |
| API | `api/v1/scan.py` | **1,001** | スキャンジョブ・Gemini 連携・転記 |
| Model | `models/purchase.py` | — | PurchaseOrder / PurchaseOrderItem / VendorDelivery |
| Model | `models/scan.py` | — | ScanJob / ScanResult / ScanResultItem |
| Schema | `schemas/scan.py` | — | ScanJobRead / ScanJobDetailRead / ScanResultRead |
| Service | `services/gemini_scanner.py` | — | Google Gemini Vision API 呼び出し |
| Task | `tasks/scan_tasks.py` | — | Celery 非同期スキャン処理 |
| Task | `tasks/invoice_tasks.py` | — | 入金期限チェック定期実行（毎朝 9 時 JST） |
| Frontend | `app/projects/[id]/purchase/page.tsx` | 599 | 発注書（D&D スキャン・ステータス遷移） |
| Frontend | `app/purchases/page.tsx` | — | 全案件横断発注書一覧 |
| Frontend | `app/scan/page.tsx` | 701 | スキャンジョブ管理（KPI・フィルタ・一覧） |
| Frontend | `app/scan/[job_id]/page.tsx` | 995 | スキャンレビュー・転記（分割ペイン） |
| Component | `components/scan/JobRow.tsx` | — | ジョブ行コンポーネント |
| Component | `components/scan/BulkActionBar.tsx` | — | 一括操作バー |
| Component | `components/scan/ProjectPickerCard.tsx` | — | 案件選択コンポーネント |
| Type | `types/scan.ts` | — | ScanJob / ScanResult 型 |

**エンドポイント一覧:**
- `GET /purchase-orders/upcoming-payments` — 支払期日が近い発注書（カレンダー用）
- `GET /purchase-orders/all` — 全案件横断発注書一覧
- `GET/POST /projects/{id}/purchase-orders` — 発注書一覧・作成
- `GET /purchase-orders/{id}` — 発注書詳細
- `PUT /purchase-orders/{id}` — 発注書全体更新（全置換）
- `PATCH /purchase-orders/{id}` — 発注書部分更新
- `DELETE /purchase-orders/{id}` — 発注書削除
- `POST /purchase-orders/{id}/issue` — 発注書発行（未発注→発注済）
- `POST /purchase-orders/{id}/mark-delivered` — 納品済化
- `POST /purchase-orders/{id}/mark-paid` — 支払済化
- `POST /purchase-orders/{id}/items/{item_id}/deliveries` — 納品記録
- `POST /scan/upload` — ファイルアップロード（PDF/Excel/画像 20MB 上限）
- `GET /scan/jobs` — ジョブ一覧
- `GET /scan/jobs/{job_id}` — ジョブ詳細（results 含む）
- `PATCH /scan/results/{result_id}` — 結果更新
- `POST /scan/results/{result_id}/confirm` — 確認済化
- `POST /scan/results/{result_id}/apply` — 見積項目に反映
- `POST /scan/results/{result_id}/transfer-to-qcds` — QCDS に転送
- `POST /scan/results/{result_id}/save-as-version` — 業者見積版として保存
- `POST /scan/bulk-apply` — 一括反映
- `POST /scan/bulk-delete/restore/purge` — 一括操作

---

### 🏭 Vendor（業者マスタ）

| レイヤー | ファイル | 内容 |
|---------|---------|------|
| API | `api/v1/vendors.py` 300行 | 業者 CRUD・単価履歴・一括無効化 |
| Model | `models/vendor.py` | Vendor / VendorPriceHistory |
| Schema | `schemas/vendor.py` | VendorCreate / VendorDetail / PriceHistoryRead |
| Frontend | `app/vendors/page.tsx` | 業者一覧（検索・有効/無効フィルタ） |
| Frontend | `app/vendors/[id]/page.tsx` | 業者詳細（SVG 単価推移チャート・単価履歴） |
| Type | `types/vendor.ts` | Vendor 型定義 |

**エンドポイント一覧:**
- `GET /vendors` — 一覧（検索・active_only）
- `POST /vendors` — 作成（admin のみ）
- `POST /vendors/bulk-deactivate` — 一括無効化（admin のみ）
- `GET /vendors/{id}` — 詳細
- `PATCH /vendors/{id}` — 更新（admin のみ）
- `GET /vendors/{id}/price-history` — 単価履歴
- `GET /vendors/price-history/search` — 全業者横断単価履歴検索

**特徴:**
- `Purchase` ドメインから参照される（スキャン→業者マスタ自動登録・発注書の vendor_id）
- `UNIQUE 制約（vendor_name）` により重複登録を DB レベルで防止

---

## 3. モジュール境界候補

```
┌─────────────────────────────────────────────────────────────────┐
│                        Shared / Core                             │
│  auth, company-settings, admin, history-helper, notification     │
│  api-client.ts, AppShell.tsx, apiFetch                          │
└──────┬──────────────────────────────────────────┬───────────────┘
       │                                          │
  ┌────▼────┐   ┌──────────┐   ┌─────────────────▼────────────┐
  │Customer │   │  Vendor  │   │          Project              │
  │         │   │          │   │   (全ドメインの親エンティティ)  │
  └────┬────┘   └────┬─────┘   └──────────────────┬───────────┘
       │             │                            │
  ┌────▼─────────────▼───┐    ┌──────────────────▼────────────┐
  │       Purchase        │    │         Construction           │
  │  ┌─ 発注書管理        │    │  ┌─ Estimate（見積・QCDS）    │
  │  └─ スキャン（Gemini）│    │  ├─ Schedule（ガント）         │
  └──────────┬────────────┘    │  └─ Site（現場・日報・出面）  │
             │                 └──────────────────┬───────────┘
  ┌──────────▼──────────────────────────────────┐ │
  │                   Report                     │◄┘
  │  注文書・請求書・帳票出力・ダッシュボード      │
  └──────────────────────────────────────────────┘
```

### 依存ルール（推奨）

| モジュール | 依存してよい | 依存禁止 |
|-----------|------------|---------|
| Customer | Shared | 他全て |
| Vendor | Shared | 他全て |
| Project | Customer, Shared | Construction 内部, Purchase |
| Construction/Estimate | Project, Vendor, Shared | Purchase, Report |
| Construction/Schedule | Project, Shared | — |
| Construction/Site | Project, Shared | — |
| Purchase | Project, Vendor, Shared | Construction 内部 |
| Report | Project, Construction/Estimate, Purchase, Shared | — |

---

## 4. Shared 化できる機能

### ✅ 現在すでに共通化されているもの

| 機能 | 場所 | 状態 |
|-----|------|------|
| JWT 認証 | `core/security.py`, `core/deps.py` | 完全共通 |
| DB セッション | `core/database.py` | 完全共通 |
| API fetch ラッパー | `frontend/lib/api-client.ts` | 完全共通（自動リフレッシュ付き） |
| 編集履歴記録 | `services/history.py` | 共通ヘルパー |
| 認証 Context | `contexts/auth-context.tsx` | 完全共通 |
| AppShell | `components/layout/AppShell.tsx` | 完全共通 |
| 工事番号採番 | `services/project_number.py` | 共通サービス |
| Slack 通知 | `services/notification.py` | 共通サービス |

### ⚠️ 共通化すべきだが現在散在しているもの

| 機能 | 現状の散在場所 | 推奨移動先 |
|-----|--------------|----------|
| `fmtYen()`（金額フォーマット） | purchase/page.tsx, purchases/page.tsx 等で重複定義 | `lib/format.ts` |
| 日付フォーマット関数 | 各ページで個別実装 | `lib/format.ts` |
| ステータスバッジ | 各ページにハードコード | `components/ui/StatusBadge.tsx` |
| ページネーション UI | 各ページに重複実装 | `components/ui/Pagination.tsx` |
| ファイル D&D ゾーン | purchase/page.tsx, estimate/page.tsx 等で重複 | `components/ui/DropZone.tsx` |
| `AuthImage` コンポーネント | progress, photo-album で重複 | `components/ui/AuthImage.tsx` |
| `apiFetch` エラーバナー | 各ページで個別 catch・個別 UI | 共通エラーハンドラー |
| `_to_read()` パターン | 各 API ファイルで独自実装 | ドメイン内共通ヘルパー化 |
| `selectinload` パターン | 全 API ファイルで重複 | リポジトリパターン導入候補 |

---

## 5. AI 開発時にコンテキスト肥大化する箇所

### 🔴 最重度（単一ファイル 1,000行超）

| ファイル | 行数 | 原因 | 分割案 |
|---------|:----:|------|------|
| `api/v1/quotes.py` | **1,279** | 見積本体・版・大項目・明細・稟議・スキャン連携が混在 | `quote_versions.py`, `quote_sections.py`, `quote_approvals.py` に分割 |
| `app/projects/[id]/qcds/page.tsx` | **1,293** | 原価算定表・経費行・計算表示が 1 ファイル | `QCDSExpensePanel`, `QCDSDirectWorkTable` コンポーネント分離 |
| `app/projects/[id]/quote/[quote_id]/page.tsx` | **1,292** | 明細テーブル・大項目・稟議スタンプ・粗利ゲージが混在 | `SectionBlock`, `ApprovalStamps`, `QuoteTotals` 分離 |
| `app/projects/[id]/estimate/page.tsx` | **1,267** | スキャン統合・版管理・D&D・ポーリングが混在 | `ScanZone`, `VersionCard`, `EstimateItems` 分離 |
| `api/v1/scan.py` | **1,001** | アップロード・ポーリング・レビュー・転記・一括操作が混在 | `scan_upload.py`, `scan_review.py`, `scan_transfer.py` に分割 |

### 🟠 高度（500〜1,000行）

| ファイル | 行数 | 問題 |
|---------|:----:|------|
| `app/scan/[job_id]/page.tsx` | 995 | スプリットペイン・PDF プレビュー・転記 UI が単一ファイル |
| `app/clients/[id]/page.tsx` | 895 | 基本情報・店舗・担当者・関連案件が単一ファイル |
| `app/projects/[id]/page.tsx` | 734 | ステータス・編集モード・QCDS ウィジェット・担当者が混在 |
| `app/calendar/page.tsx` | 721 | イベント管理・日報作成・支払期日が単一ファイル |
| `app/scan/page.tsx` | 701 | KPI・D&D・ジョブ一覧・フィルタが単一ファイル |
| `app/projects/[id]/progress/page.tsx` | 556 | テキスト/写真/図面の 3 モード + ライトボックスが単一 |

### 🟡 中度（ドメイン間結合が問題）

| 箇所 | 結合の問題 |
|-----|-----------|
| `quotes.py` ↔ `qcds.py` | `reflect-from-version` が見積→QCDS を直接更新（API またぎ） |
| `scan.py` → `quotes.py`, `purchase.py`, `vendors.py` | スキャン転記が 3 ドメインを直接更新（Fat API） |
| `exports.py` | 全帳票ドメインの DB クエリを 1 ファイルで実行（帳票ごとのサービス分割推奨） |
| `dashboard.py` | 全ドメインのデータを 1 エンドポイントで集計（314 行） |
| `projects.py` の `create_project` | Quote + QuoteVersion を内部で自動生成（暗黙の Estimate 依存） |

---

## 6. AI 開発時の推奨コンテキスト戦略

タスクの種類ごとに必要な最小コンテキストセットを絞り込むことで、LLM のコンテキスト消費を削減できます。

| タスク種別 | 必要なコンテキスト（最小セット） |
|-----------|-------------------------------|
| 見積書の修正 | `quotes.py` + `schemas/quote.py` + `types/quote.ts` + `quote/[quote_id]/page.tsx` |
| QCDS 計算修正 | `qcds.py` + `qcds_calculator.py` + `qcds/page.tsx` + `schemas/qcds.py` |
| スキャン修正 | `scan.py` + `gemini_scanner.py` + `scan_tasks.py` + `types/scan.ts` |
| 発注書修正 | `purchase.py` + `projects/[id]/purchase/page.tsx` |
| 顧客関連修正 | `clients.py` + `schemas/client.py` + `clients/[id]/page.tsx` |
| 帳票出力修正 | `exports.py` + `excel_export.py` または `pdf_export.py` のみ |
| 業者マスタ修正 | `vendors.py` + `schemas/vendor.py` + `vendors/[id]/page.tsx` |
| ダッシュボード修正 | `dashboard.py` + `dashboard/page.tsx` のみ |
| カレンダー修正 | `schedule.py` + `calendar/page.tsx` のみ |
| 日報修正 | `daily_reports.py` + `daily-report/page.tsx` のみ |

---

## 7. ドメイン別改善優先度まとめ

| ドメイン | 健全度 | 最大ファイル | 優先課題 |
|---------|:------:|:----------:|---------|
| **Customer** | ⭐⭐⭐⭐⭐ | 895行 | ほぼ問題なし。独立性が最も高い |
| **Vendor** | ⭐⭐⭐⭐⭐ | 300行 | 問題なし。Purchase との結合のみ |
| **Construction/Schedule** | ⭐⭐⭐⭐ | 247行 | 問題なし |
| **Project** | ⭐⭐⭐ | 734行 | カンバン・コメント・履歴を小モジュール化すべき |
| **Construction/Site** | ⭐⭐⭐ | 556行 | 進捗・写真・日報・出面の統合ページが大きい |
| **Report** | ⭐⭐ | 413行 | `exports.py` が全帳票を担当。帳票ごとのサービス分割推奨 |
| **Purchase** | ⭐⭐ | 1,001行 | `scan.py` 1,001行 の分割が最優先 |
| **Construction/Estimate** | ⭐ | 1,293行 | `quotes.py`(1,279行)・3ページ各 1,200行超が最大の技術的負債 |

---

## 8. 段階的リファクタリング候補（優先順）

### Phase 1: 共通ユーティリティ整備（影響小・即効性大）
1. `frontend/src/lib/format.ts` 作成 — `fmtYen`, 日付フォーマット関数を集約
2. `frontend/src/components/ui/DropZone.tsx` 作成 — D&D ゾーンを共通化
3. `frontend/src/components/ui/AuthImage.tsx` 作成 — 認証付き画像表示を共通化

### Phase 2: 大ファイル分割（Backend）
1. `api/v1/scan.py` → `scan_upload.py` + `scan_review.py` + `scan_transfer.py`
2. `api/v1/quotes.py` → `quote_core.py` + `quote_versions.py` + `quote_sections.py`

### Phase 3: 大ページ分割（Frontend）
1. `projects/[id]/qcds/page.tsx` → `QCDSDirectWorkTable` + `QCDSExpensePanel` コンポーネント分離
2. `projects/[id]/estimate/page.tsx` → `ScanZone` + `VersionCard` + `EstimateItemsTable` 分離
3. `projects/[id]/quote/[quote_id]/page.tsx` → `SectionBlock` + `ApprovalStamps` + `QuoteTotals` 分離

### Phase 4: ドメイン境界の明確化
1. `projects.py` の `create_project` から Quote 自動生成を `quotes.py` に移動
2. `scan.py` の転記処理をドメインサービスに委譲（Fat API 解消）
3. `exports.py` を帳票種別ごとのサービスに分割
