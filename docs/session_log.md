# Session Log

## ワークスペース概要

### ルール
- 設計書のStepに従って順番に実装する
- 各Stepの動作確認チェックリストを満たさないと次に進まない
- 不明点はひささんに必ず質問。勝手な解釈で進めない
- ライブラリ追加は事前提案・承諾後のみ
- DBスキーマ変更はAlembicマイグレーション経由
- 案件削除は論理削除のみ（deleted_at）
- Excelテンプレートのスタイル変更禁止
- 環境変数は .env のみ（ハードコード禁止）

### 5W1H
- **Who**: 株式会社クラップの社員6〜20名（高齢者含む）、開発者：平等 久盛（ひささん）
- **What**: 工事台帳Excelファイルを置き換えるWebアプリ（Construction Manager v3）
- **When**: 2026年5月13日開始
- **Where**: WebARENA Indigo VPS (116.80.96.175) + Coolify、ドメイン fact-ally.com
- **Why**: 複数人での同時編集、業者見積のAI読み取り、帳票自動出力による業務効率化
- **How**: FastAPI + Next.js 14 + PostgreSQL 16 + Redis + Gemini API、Docker Compose デプロイ

---

## Session 2026-05-13

### 作業内容
- 設計書一式（docs/base/企画設計MD/）を確認
- サーバー情報ファイル（SERVER_INFO.md, SERVER_MANUAL.md）を確認
- Step 1-2「Docker Compose環境構築」を実装

### 変更ファイル
- `CLAUDE.md` （新規作成 - プロジェクトルート）
- `.gitignore` （新規作成 - Python/Node/Docker/IDE + サーバー情報ファイルを除外）
- `.env.example` （新規作成 - DATABASE_URL/REDIS_URL/GEMINI_API_KEY/JWT_SECRET等）
- `docker-compose.dev.yml` （新規作成 - PostgreSQL 16/Redis 7/Adminer）
- `backend/Dockerfile` （新規作成 - Python 3.11-slim + uv ベース）
- `frontend/Dockerfile` （新規作成 - Node 20-alpine ベース）
- `README.md` （新規作成 - ローカル起動手順）
- `docs/session_log.md` （新規作成 - このファイル）

### 重要な気づき
- SERVER_INFO.md にGitHubトークン・パスワードが平文記載 → .gitignore で除外済み
- サーバーには既に `construction` アプリ（ポート8002）が稼働中 → v3は別ポート(8004)を使用予定
- 本マシンにDockerが未インストール → 動作確認チェックリストはDocker Desktop インストール後に実施が必要

### 次のアクション
- **【必須・今すぐ】** Docker Desktop for Windows をインストール
  - https://www.docker.com/products/docker-desktop/
- **【必須・今すぐ】** SERVER_INFO.md のGitHubトークンをローテーションすること
  - 現在のトークンは設計書ファイルに記載されているため危険（既にローテーション済み）
- **【Step 1-2 動作確認】** Docker インストール後に以下を実行:
  - `docker compose -f docker-compose.dev.yml up`
  - http://localhost:8080 でAdminer が表示されることを確認
- **【次Step】** Step 1-3「FastAPI骨格」の実装
  - backend/pyproject.toml 作成
  - backend/app/main.py 等の実装
  - docker-compose.dev.yml に cmv3-api サービス追加

---

## Session 2026-05-13 (続き)

### 作業内容
- Step 1-3「FastAPI骨格」を完成
  - backend/pyproject.toml に `[tool.hatch.build.targets.wheel] packages = ["app"]` 追加（hatchling ビルドエラー修正）
  - backend/app/main.py の structlog 設定修正（PrintLoggerFactory と非互換な `add_logger_name` を削除）
  - docker compose --build で再ビルド → `GET /api/v1/health` が `{"status":"ok","version":"0.1.0"}` を返すことを確認
- Gemini API キーの取得確認（projects/205242996127）→ `.env` の `GEMINI_API_KEY` に設定するよう案内

### 変更ファイル
- `backend/pyproject.toml` — `[tool.hatch.build.targets.wheel]` セクション追加
- `backend/app/main.py` — structlog processors から `add_logger_name` を削除

### 次のアクション
- **【必須】** `.env` ファイルを作成し `GEMINI_API_KEY` に実際のキーを設定
- **【Step 1-4】** Next.js フロントエンド骨格の実装（設計書を確認してから着手）

---

## Session 2026-05-13 (Step 1-4)

### 作業内容
- Step 1-4「Next.js骨格」を完成
  - frontend/ に Next.js 14 (App Router + TypeScript + Tailwind CSS) を手動構築
  - デザイントークン (docs/base/assets/tokens.css) を globals.css に反映
  - shadcn/ui 基本コンポーネント手動作成: button, input, table, dialog, dropdown-menu
  - APIクライアント (lib/api-client.ts): fetch wrapper + JWT Bearer + refresh token自動リトライ
  - localhost:3000 で「Construction Manager v3」の表示を確認 (HTTP 200)
  - next.config.ts → next.config.mjs に修正（Next.js 14は.ts非対応）
  - docker-compose.dev.yml に cmv3-web サービス追加（port 3000）

### 変更ファイル
- `frontend/package.json` — 新規作成
- `frontend/tsconfig.json` — 新規作成
- `frontend/next.config.mjs` — 新規作成（.tsから変更）
- `frontend/tailwind.config.ts` — 新規作成
- `frontend/postcss.config.mjs` — 新規作成
- `frontend/components.json` — 新規作成
- `frontend/.eslintrc.json` — 新規作成
- `frontend/.dockerignore` — 新規作成
- `frontend/Dockerfile` — 更新（npm install + dev起動）
- `frontend/src/app/globals.css` — 新規作成（デザイントークン含む）
- `frontend/src/app/layout.tsx` — 新規作成
- `frontend/src/app/page.tsx` — 新規作成
- `frontend/src/lib/utils.ts` — 新規作成
- `frontend/src/lib/api-client.ts` — 新規作成
- `frontend/src/components/ui/button.tsx` — 新規作成
- `frontend/src/components/ui/input.tsx` — 新規作成
- `frontend/src/components/ui/table.tsx` — 新規作成
- `frontend/src/components/ui/dialog.tsx` — 新規作成
- `frontend/src/components/ui/dropdown-menu.tsx` — 新規作成
- `docker-compose.dev.yml` — cmv3-web サービス追加

### 次のアクション
- **【Step 1-5】** DBスキーマとAlembic
  - 設計書2章のテーブル定義を SQLAlchemy モデルで実装
  - Alembicマイグレーション初回適用
  - シードデータ（管理者ユーザー1名、印紙税テーブル、サンプル業者数件）

---

## Session 2026-05-14

### 作業内容
- Step 1-5「DBスキーマとAlembic」を完成
  - SQLAlchemy 2.0 モデル全19テーブル作成（enums.py / base.py / user, project, qcds, vendor, quote, order, invoice, progress, scan, history, master）
  - Alembic 非同期対応セットアップ（alembic.ini + alembic/env.py）
  - `alembic revision --autogenerate` で初回マイグレーション生成 → `alembic upgrade head` 適用
  - シードスクリプト実行（管理者ユーザー / 印紙税テーブル8行 / サンプル業者3社）
  - Adminer (localhost:8080) で全20テーブル表示を確認

### 変更ファイル
- `backend/app/models/enums.py` — 全Enum定義
- `backend/app/models/base.py` — TimestampMixin
- `backend/app/models/{user,project,qcds,vendor,quote,order,invoice,progress,scan,history,master}.py` — 各モデル
- `backend/app/models/__init__.py` — 全モデル一括インポート
- `backend/alembic.ini` — Alembicメイン設定
- `backend/alembic/env.py` — 非同期対応env
- `backend/alembic/script.py.mako` — マイグレーションテンプレート
- `backend/alembic/versions/5701fe81df0d_initial_schema.py` — 初回マイグレーション
- `backend/app/scripts/seed.py` — シードスクリプト

### 次のアクション
- **【Step 1-6】** 認証実装
  - FastAPI Users 設定（JWT + refresh token、Argon2id）
  - `/api/v1/auth/login`, `/refresh`, `/me`, `/logout`
  - フロント側ログイン画面（`/login`）、認証Context

---

## Session 2026-05-14 (Step 1-6)

### 作業内容
- Step 1-6「認証実装」を完成
  - `backend/app/core/security.py`: Argon2id ハッシュ + PyJWT (access/refresh token 生成・検証)
  - `backend/app/core/deps.py`: `get_current_user()` FastAPI 依存関係（HTTPBearer + JWT デコード）
  - `backend/app/schemas/auth.py`: LoginRequest / TokenResponse / RefreshRequest
  - `backend/app/schemas/user.py`: UserRead（パスワード除外レスポンス用）
  - `backend/app/api/v1/auth.py`: POST /login, /refresh, /logout, GET /me
  - `backend/app/main.py`: auth router を `/api/v1` に追加
  - `backend/pyproject.toml`: `pyjwt>=2.9.0` 依存追加
  - `frontend/src/types/auth.ts`: TypeScript型定義（User / TokenResponse / LoginRequest）
  - `frontend/src/contexts/auth-context.tsx`: AuthProvider + useAuth フック
  - `frontend/src/app/login/page.tsx`: ログインページ（メール+パスワード、エラー表示）
  - `frontend/src/app/dashboard/page.tsx`: ダッシュボード（ログアウトボタン付き）
  - `frontend/src/app/layout.tsx`: AuthProvider をラップ
  - 動作確認: login → JWT返却、/me → ユーザー情報、誤PW → 401、localhost:3000/login → 200

### 変更ファイル
- `backend/app/core/security.py` — 新規作成
- `backend/app/core/deps.py` — 新規作成
- `backend/app/schemas/__init__.py` — 新規作成
- `backend/app/schemas/auth.py` — 新規作成
- `backend/app/schemas/user.py` — 新規作成
- `backend/app/api/v1/auth.py` — 新規作成
- `backend/app/main.py` — auth router追加
- `backend/pyproject.toml` — pyjwt 依存追加
- `frontend/src/types/auth.ts` — 新規作成
- `frontend/src/contexts/auth-context.tsx` — 新規作成
- `frontend/src/app/login/page.tsx` — 新規作成
- `frontend/src/app/dashboard/page.tsx` — 新規作成
- `frontend/src/app/layout.tsx` — AuthProvider追加

### 次のアクション
- **【注意】** refresh tokenはステートレス実装（Redisブラックリスト未実装）
  - ログアウト後もリフレッシュトークンは期限(7日)まで有効
  - Week 2以降でRedisブラックリスト追加を検討
- **【次Step】** Step 2-2「案件詳細・編集」

---

## Session 2026-05-14 (Step 2-1)

### 作業内容
- Step 2-1「案件一覧と新規作成」を完成
  - `backend/app/services/project_number.py`: 非同期工事番号採番（SELECT FOR UPDATE）
  - `backend/app/schemas/project.py`: ProjectCreate / ProjectListItem / ProjectListResponse
  - `backend/app/api/v1/projects.py`: GET /api/v1/projects（フィルタ・検索・ページネーション）、POST /api/v1/projects（自動採番・重複チェック）
  - `frontend/src/types/project.ts`: TypeScript型・ラベル定数
  - `frontend/src/components/projects/create-project-modal.tsx`: 新規作成モーダル
  - `frontend/src/app/projects/page.tsx`: 案件台帳一覧（検索・ステータスフィルタ・ページネーション）
  - `frontend/src/app/dashboard/page.tsx`: /projects へリダイレクト
  - 動作確認: GET /api/v1/projects → 空リスト200、POST → 26-1-001 自動採番・201、/projects → 200

### 変更ファイル
- `backend/app/services/__init__.py` — 新規作成
- `backend/app/services/project_number.py` — 新規作成
- `backend/app/schemas/project.py` — 新規作成
- `backend/app/api/v1/projects.py` — 新規作成
- `backend/app/main.py` — projects router追加
- `frontend/src/types/project.ts` — 新規作成
- `frontend/src/components/projects/create-project-modal.tsx` — 新規作成
- `frontend/src/app/projects/page.tsx` — 新規作成
- `frontend/src/app/dashboard/page.tsx` — /projectsへリダイレクトに変更

### 次のアクション
---

## Session 2026-05-14 (Step 2-2)

### 作業内容
- Step 2-2「案件詳細・編集」を完成
  - `backend/app/schemas/project.py`: ProjectUpdate / ProjectDetail スキーマ追加
  - `backend/app/api/v1/projects.py`: GET /api/v1/projects/{id}（関連件数含む）、PATCH /api/v1/projects/{id}（admin or created_by権限チェック）
  - `frontend/src/types/project.ts`: ProjectDetail / ProjectUpdate 型・ラベル定数追加
  - `frontend/src/app/projects/[id]/page.tsx`: 案件詳細画面（設計書4.2レイアウト、インライン編集モード、クイックリンクバー）
  - `frontend/src/app/projects/page.tsx`: 工事番号に詳細ページへのリンク追加
  - 動作確認: GET /api/v1/projects/{id} → 詳細+関連件数、PATCH → 更新OK、403権限チェック実装済み、/projects/{id} → 200

### 変更ファイル
- `backend/app/schemas/project.py` — ProjectUpdate / ProjectDetail 追加
- `backend/app/api/v1/projects.py` — GET/{id} / PATCH/{id} 追加
- `frontend/src/types/project.ts` — 型定義追加
- `frontend/src/app/projects/[id]/page.tsx` — 新規作成
- `frontend/src/app/projects/page.tsx` — 詳細ページリンク追加

### 次のアクション
---

## Session 2026-05-14 (Step 2-3)

### 作業内容
- Step 2-3「ステータス管理」を完成
  - `backend/app/services/history.py`: 編集履歴記録共通ヘルパー
  - `backend/app/schemas/project.py`: StatusChangeRequest / EditHistoryItem / EditHistoryResponse 追加
  - `backend/app/api/v1/projects.py`: POST /projects/{id}/status（権限チェック・履歴記録）、GET /projects/{id}/history
  - `frontend/src/app/projects/[id]/page.tsx`: ステータスドロップダウン即時変更（管理者・作成者のみ）
  - 動作確認: ステータス変更 quote→ordered API 200、履歴記録 total=1、edit_histories テーブルに記録

### 変更ファイル
- `backend/app/services/history.py` — 新規作成
- `backend/app/schemas/project.py` — StatusChangeRequest等追加
- `backend/app/api/v1/projects.py` — /status・/history エンドポイント追加・import整理
- `frontend/src/app/projects/[id]/page.tsx` — ステータスドロップダウン追加

### 次のアクション
---

## Session 2026-05-14 (Step 2-4)

### 作業内容
- Step 2-4「QCDS」を完成
  - `backend/app/services/qcds_calculator.py`: QCDS全体の派生計算（A直接工事費/B現場経費/C工事部経費/D共通経費/原価合計/一般管理費/営業利益）
  - `backend/app/schemas/qcds.py`: DirectWorkInput / QCDSInput / QCDSResponse / QCDSCalcFields
  - `backend/app/api/v1/qcds.py`: GET（初回自動作成）/ PUT（ヘッダ+30行一括保存）
  - `frontend/src/types/qcds.ts`: TypeScript型定義
  - `frontend/src/app/projects/[id]/qcds/page.tsx`: 取決見通表30行（工種/業者名/区分/実行予算/取決金額/精算/月別支払）+ 工事割出サマリー + 経費率設定パネル
  - バグ修正: lazy-load MissingGreenlet → PUT後に selectinload で再クエリ
  - 動作確認: 直接工事費2行保存 → A=1,200,000 / 合計1,222,014 の計算OK / フロント200

### 変更ファイル
- `backend/app/services/qcds_calculator.py` — 新規作成
- `backend/app/schemas/qcds.py` — 新規作成
- `backend/app/api/v1/qcds.py` — 新規作成
- `backend/app/main.py` — qcds router追加
- `frontend/src/types/qcds.ts` — 新規作成
- `frontend/src/app/projects/[id]/qcds/page.tsx` — 新規作成

### 次のアクション
- **【Step 2-5】** 見積書
  - GET/POST/PATCH /api/v1/projects/{id}/quotes
  - 見積内訳入力（行追加・削除）
  - 小計/税額/合計の自動計算
  - フロント: /projects/[id]/quote 画面
  - PDF/Excel出力は Week 3 に先送り（設計書通り）
- **【注意】** 保険料計算はQCDSモデル内の料率フィールドを使用（マスタテーブル連携は Phase 2）

---

## Session 2026-05-14 (Step 2-5)

### 作業内容
- Step 2-5「見積書」を完成
  - `backend/app/schemas/quote.py`: QuoteItemInput / QuoteCreate / QuoteUpdate / QuoteItemRead / QuoteListItem / QuoteDetail（TAX_RATE=0.10）
  - `backend/app/api/v1/quotes.py`: GET 一覧 / POST 新規作成（201）/ GET 詳細 / PATCH 更新（内訳行全置換・税額自動計算）
  - `backend/app/main.py`: quotes router を `/api/v1` に追加
  - `frontend/src/types/quote.ts`: TypeScript型定義（QuoteStatus: draft/issued のみ）
  - `frontend/src/app/projects/[id]/quote/page.tsx`: 見積書一覧（左サイドバー）+ 内訳20行テーブル + ヘッダ編集 + 合計パネル
  - QuoteStatus enum 確認: backend は draft/issued の2値のみ → TypeScript型を合わせた

### 変更ファイル
- `backend/app/schemas/quote.py` — 新規作成
- `backend/app/api/v1/quotes.py` — 新規作成
- `backend/app/main.py` — quotes router追加
- `frontend/src/types/quote.ts` — 新規作成
- `frontend/src/app/projects/[id]/quote/page.tsx` — 新規作成

### 次のアクション
- **【Step 2-6】** 編集履歴画面 `/projects/[id]/history`
  - GET /api/v1/projects/{id}/history は実装済み（Step 2-3）
  - フロント側の一覧表示画面のみ作成すればよい
  - 表示項目: 変更日時 / 変更者 / 変更種別 / 変更内容（JSONB）
- **Week 2 完了後の確認事項**
  - Docker再ビルドして全エンドポイントをまとめて動作確認 → 全チェック通過
  - Alembic マイグレーション: Step 2-5時点でDBスキーマ変更なし（quoteモデルは Step 1-5 で作成済み）

---

## Session 2026-05-14 (Week 2 動作確認 + Step 3-1)

### 作業内容
- **Week 2 動作確認完了**（全 API・フロント HTTP 200 を確認）
  - GET/POST /projects, GET/PATCH /projects/{id}, POST /status, GET /history ✅
  - GET /qcds ✅
  - POST/GET/PATCH /quotes（小計・税額・合計自動計算） ✅
  - フロント /login, /projects, /vendors HTTP 200 ✅
  - 不具合発見: StatusChangeRequest のフィールド名は `status`（`new_status`ではない）→ 設計通り
- **Step 3-1「業者マスタ」を完成**
  - `backend/app/schemas/vendor.py`: VendorCreate / VendorUpdate / VendorListItem / VendorDetail / PriceHistoryRead / VendorListResponse / PriceHistoryListResponse
  - `backend/app/api/v1/vendors.py`: GET 一覧（検索・active_only・ページネーション）/ POST 作成（管理者のみ）/ GET 詳細 / PATCH 更新 / GET 単価履歴
  - `backend/app/main.py`: vendors router 追加
  - `frontend/src/types/vendor.ts`: TypeScript型定義
  - `frontend/src/app/vendors/page.tsx`: 業者一覧（検索・有効/無効フィルタ・新規作成モーダル）
  - `frontend/src/app/vendors/[id]/page.tsx`: 業者詳細（インライン編集・単価履歴テーブル）
  - 動作確認: GET /vendors→3社, POST /vendors→201, PATCH→OK, GET /price-history→空200, /vendors画面→200

### 変更ファイル
- `backend/app/schemas/vendor.py` — 新規作成
- `backend/app/api/v1/vendors.py` — 新規作成
- `backend/app/main.py` — vendors router追加
- `frontend/src/types/vendor.ts` — 新規作成
- `frontend/src/app/vendors/page.tsx` — 新規作成
- `frontend/src/app/vendors/[id]/page.tsx` — 新規作成

### 次のアクション
---

## Session 2026-05-14 (Step 3-2)

### 作業内容
- Step 3-2「ファイルアップロードとジョブ管理」を完成
  - `backend/pyproject.toml`: `celery[redis]>=5.4.0`, `aiofiles>=24.1.0`, `psycopg2-binary>=2.9.0` 追加
  - `backend/app/core/config.py`: `upload_dir` 設定追加
  - `backend/app/tasks/celery_app.py`: Celery アプリ定義（broker=Redis, include=scan_tasks）
  - `backend/app/tasks/scan_tasks.py`: `process_scan_job` タスク（psycopg2同期エンジン使用 ← asyncpg+Celery組み合わせはMissingGreenlet回避のため）
  - `backend/app/schemas/scan.py`: ScanJobRead / ScanResultRead / ScanResultItemRead / ScanJobDetailRead / ApplyScanResultRequest
  - `backend/app/api/v1/scan.py`: POST /scan/upload（20MB上限、PDF/Excel/PNG/JPEG）、GET /scan/jobs、GET /scan/jobs/{id}
  - `backend/app/main.py`: scan router 追加
  - `docker-compose.dev.yml`: cmv3-worker サービス追加（concurrency=2）、scan_uploads volume共有（api + worker）
  - バグ修正: asyncpg + asyncio.run() in Celery = MissingGreenlet → psycopg2 同期エンジンに変更
  - 動作確認: PDF アップロード→202、Celery が pending→processing→succeeded に遷移（0.26s）

### 変更ファイル
- `backend/pyproject.toml` — celery, aiofiles, psycopg2-binary 追加
- `backend/app/core/config.py` — upload_dir 追加
- `backend/app/tasks/__init__.py` — 新規作成
- `backend/app/tasks/celery_app.py` — 新規作成
- `backend/app/tasks/scan_tasks.py` — 新規作成（psycopg2同期）
- `backend/app/schemas/scan.py` — 新規作成
- `backend/app/api/v1/scan.py` — 新規作成
- `backend/app/main.py` — scan router 追加
- `docker-compose.dev.yml` — cmv3-worker + scan_uploads volume 追加

### 次のアクション
- **【Step 3-3】** Gemini API 連携
  - `backend/app/services/gemini_scanner.py`: Gemini 2.5 Flash でスキャン解析
  - PDF→画像変換（pdf2image / poppler）、Excel→構造化テキスト変換（openpyxl）
  - responseSchema で構造化出力（業者名・明細行・金額の抽出）
  - scan_tasks.py の stub を実際の Gemini 呼び出しに置換
  - 必要ライブラリ: google-generativeai, pdf2image, Pillow, openpyxl（事前確認・提案）

---

## Session 2026-05-14 (Step 2-6)

### 作業内容
- Step 2-6「編集履歴画面」を完成
  - `frontend/src/app/projects/[id]/history/page.tsx`: 編集履歴一覧（変更日時 / 変更者 / 対象エンティティ / 変更種別 / フィールド変更詳細）
  - ページネーション（30件/ページ、前へ/次へボタン）
  - field_changes の before/after を差分テーブルで表示（変更前: 打ち消し線赤、変更後: 緑）
  - 案件詳細ページの「編集履歴」クイックリンク（/projects/{id}/history）と接続済み

### 変更ファイル
- `frontend/src/app/projects/[id]/history/page.tsx` — 新規作成

### 次のアクション
- **【Week 2 完了】** Steps 2-1〜2-6 実装完了
- **Week 2 動作確認チェックリスト（設計書11章）**
  - Docker 再ビルド: `docker compose -f docker-compose.dev.yml up -d --build backend web`
  - API動作: POST /quotes → 201、PATCH /quotes/{id} → 200、GET /history → ページネーション
  - フロント動作: /projects/{id}/quote → 見積書一覧・編集、/projects/{id}/history → 履歴一覧
- **【Week 3 候補】** Excel/PDF帳票出力（見積書・注文書・請求書）
- **【注意】** 楽観的ロック（PATCH "last writer wins"）・refresh tokenブラックリストは未実装

---

## Session 2026-05-14

### 作業内容
- Step 3-3: Gemini API連携を実装
  - Microsoft Windows [Version 10.0.26200.8457]
(c) Microsoft Corporation. All rights reserved.

G:\}ChCuntigravity\Construction_Manager_v3> に  を追加（pdf2image に必要）
  -  を新規作成
    - PDF: pdf2image で画像変換 → Gemini Vision (最大10ページ)
    - 画像(PNG/JPEG): そのまま Gemini Vision に送信
    - Excel: openpyxl でテキスト抽出 → Gemini テキスト解析
    - ScanResult / ScanResultItem を DB に保存
    - _ScanExtraction Pydanticモデルで型安全な応答パース
  -  のスタブを gemini_scanner.process_file() 呼び出しに置換
  - Docker再ビルド（cmv3-api, cmv3-worker）成功
- エンドツーエンドテスト実施
  - スキャンジョブ作成: HTTP 202 + ジョブID取得 OK
  - Celeryワーカーでジョブ処理開始 OK
  - Gemini APIに到達するも API_KEY_INVALID エラー
- 原因特定：プロジェクトルートの  と  でAPIキーが不一致
  - Docker Composeはルートの  を読む
  - ルート  のキーに （小文字L）が混在している可能性

### 変更ファイル
- Microsoft Windows [Version 10.0.26200.8457]
(c) Microsoft Corporation. All rights reserved.

G:\}ChCuntigravity\Construction_Manager_v3> — poppler-utils 追加
-  — 新規作成（Gemini 連携サービス）
-  — スタブをGemini呼び出しに置換

### 次のアクション
- **【ひささんの作業】** Google AI Studio から正確な Gemini API キーを再コピーし、プロジェクトルートの  の  を更新する
  - 更新後:  で再起動（リビルド不要）
- APIキー修正後: スキャンジョブが succeeded になることを確認
- Step 3-4: スキャン結果レビュー画面  の実装へ

---

## Session 2026-05-14

### 作業内容
- Step 3-5: スキャン結果適用モーダル（ApplyModal）完成 — QCDS/見積書選択・明細チェックボックス
- Step 3-6: 見積流用機能 — ReuseModalコンポーネント追加、全業者横断単価履歴検索API追加
- Step 4-1: 注文書（OrderPage）— 印紙税自動算定、stamp_taxフィールド表示
- Step 4-2: 請求書（InvoicePage）— 入金済み登録ボタン、消費税計算
- Step 4-3: 印紙税テーブル管理（AdminStampTaxPage）
- Step 4-4: 見積条件テンプレート管理（AdminQuoteConditionsPage）
- Alembicマイグレーション実行（quote_condition_templates テーブル追加）
- Docker rebuild完了（cmv3-api, cmv3-web）

### 変更ファイル
- frontend/src/app/scan/[job_id]/page.tsx — ApplyModalコンポーネント追加
- frontend/src/app/projects/[id]/quote/page.tsx — 流用ボタン・ReuseModalコンポーネント追加
- frontend/src/app/projects/[id]/order/page.tsx — 新規（注文書）
- frontend/src/app/projects/[id]/invoice/page.tsx — 新規（請求書）
- frontend/src/app/admin/stamp-tax/page.tsx — 新規（印紙税管理）
- frontend/src/app/admin/quote-conditions/page.tsx — 新規（見積条件管理）
- frontend/src/types/order.ts — 新規
- frontend/src/types/invoice.ts — 新規
- backend/app/api/v1/orders.py — 新規（印紙税自動算定含む）
- backend/app/api/v1/invoices.py — 新規（入金済み登録含む）
- backend/app/api/v1/admin.py — 新規（stamp-tax/quote-conditions管理）
- backend/app/api/v1/vendors.py — GET /vendors/price-history/search 追加
- backend/app/schemas/order.py — 新規
- backend/app/schemas/invoice.py — 新規
- backend/app/schemas/master.py — 新規
- backend/alembic/versions/22fb4895ce2f_add_quote_condition_templates.py — 新規

### 次のアクション
- Step 5: Excel帳票出力（見積書・注文書・請求書）
- 案件詳細ページへ注文書・請求書タブ追加
- 動作確認チェックリスト実施（全Step）
- Gemini APIキー制限をIPアドレス制限に変更（本番環境）

---

## Session 2026-05-14 (続き) — Step 5: Excel帳票出力

### 作業内容
- Step 5-1: Excel帳票出力サービス実装（backend/app/services/excel_export.py）
  - 見積書（見積番号・工事名・明細20行・小計/税/合計・条件テキスト）
  - 注文書（注文番号・宛先・金額・印紙税・工期・約款）
  - 請求書（請求番号・前月残高・入金・当月請求・消費税・振込先）
- Step 5-2: エクスポートAPIエンドポイント（backend/app/api/v1/exports.py）
  - GET /projects/{id}/quotes/{id}/export
  - GET /projects/{id}/orders/{id}/export
  - GET /projects/{id}/invoices/{id}/export
- フロントエンド：各ページにExcel出力ボタン追加（fetch blob + download）
- Docker rebuild & 動作確認完了

### 変更ファイル
- backend/app/services/excel_export.py — 新規
- backend/app/api/v1/exports.py — 新規
- backend/app/main.py — exportsルーター追加
- frontend/src/app/projects/[id]/quote/page.tsx — Excel出力ボタン
- frontend/src/app/projects/[id]/order/page.tsx — Excel出力ボタン
- frontend/src/app/projects/[id]/invoice/page.tsx — Excel出力ボタン

### 次のアクション
- Step 5-3: 案件詳細ページへ注文書・請求書タブのリンク追加
- Step 5-4: ダッシュボードKPI・グラフ実装
- Step 5-5: ユーザー管理（admin）画面

---

## Session 2026-05-14 (続き) — Step 5-3〜5-5完了

### 作業内容
- Step 5-3: 案件詳細ページの「関連データ」セクション確認（既存でOK）
- MergedCell修正（前セッション）をAPIコンテナにreflect: rebuild & 全3帳票生成テスト合格
  - quote OK (36201 bytes), order OK (35754 bytes), invoice OK (35935 bytes)
- Step 5-4: ダッシュボード実装
  - バックエンド: backend/app/api/v1/dashboard.py 新規
    - KPI4枚（総案件数・今期新規・請求累計・完工案件）
    - ステータス分布（円グラフ）
    - 月別請求推移（棒グラフ・直近12ヶ月）
    - 期限アラート（30日以内）
    - 最近の活動（直近20件）
  - フロントエンド: frontend/src/app/dashboard/page.tsx を本実装に差し替え
    - Recharts (PieChart/BarChart) でグラフ描画
- Step 5-5: ユーザー管理画面
  - バックエンド: admin.py にユーザーCRUDエンドポイント追加
    - GET/POST /admin/users、PATCH /admin/users/{id}
  - フロントエンド: frontend/src/app/admin/users/page.tsx 新規
    - 一覧表、追加/編集モーダル、有効/無効トグル（admin専用）
  - スキーマ: UserCreate/UserUpdate を schemas/user.py に追加
- recharts パッケージ追加 (package.json)
- Docker rebuild & TypeScript エラーなし確認

### 変更ファイル
- backend/app/api/v1/dashboard.py — 新規
- backend/app/api/v1/admin.py — ユーザー管理エンドポイント追加
- backend/app/schemas/user.py — UserCreate/UserUpdate 追加
- backend/app/main.py — dashboard ルーター追加
- frontend/src/app/dashboard/page.tsx — 本実装（Recharts グラフ付き）
- frontend/src/app/admin/users/page.tsx — 新規
- frontend/package.json — recharts 追加

### 次のアクション
- 動作確認チェックリスト（全Step）の実施
- Step 6-1: テスト整備（pytest）
- 本番デプロイ（Coolify へ）

---

## Session 2026-05-14〜15

### 作業内容
- `test_quote_items` 33/33 テスト失敗の修正：SQLAlchemy コミット後の identity map 問題を `expunge_all()` + 再 SELECT パターンで解決
- 本番デプロイ完了（WebARENA Indigo VPS / cmv3.fact-ally.com）
  - `docker-compose.prod.yml`, `nginx/default.conf`, `frontend/Dockerfile.prod` 新規作成
  - `variant="outline"` → `variant="ghost"` をフロントエンド7ファイルで修正（TypeScript エラー解消）
  - Ghost CMS のポート衝突（8004）を回避し cmv3-nginx を 8005 に変更
  - Let's Encrypt SSL 取得・システム Nginx SSL 設定
  - 既存 postgres コンテナに cmv3 DB/ユーザー作成、cmv3-prod-network に接続
  - Alembic マイグレーション成功（initial_schema → add_quote_condition_templates）
  - 管理者ユーザー作成（hisa1975@gmail.com / admin1234）
  - ログイン API 動作確認済み（JWT トークン取得成功）

### 変更ファイル
- `backend/app/api/v1/quotes.py` — update_quote の SQLAlchemy 修正
- `docker-compose.prod.yml` — 新規作成（ポート 8005 に修正済み）
- `nginx/default.conf` — 新規作成
- `frontend/Dockerfile.prod` — 新規作成
- `frontend/src/app/projects/[id]/page.tsx` — variant fix
- `frontend/src/app/projects/page.tsx` — variant fix
- `frontend/src/app/projects/[id]/qcds/page.tsx` — variant fix
- `frontend/src/app/projects/[id]/quote/page.tsx` — variant fix
- `frontend/src/app/vendors/[id]/page.tsx` — variant fix
- `frontend/src/app/vendors/page.tsx` — variant fix
- `frontend/src/components/projects/create-project-modal.tsx` — variant fix
- `deploy.sh` / `deploy.ps1` — ポート 8005 に更新
- `.gitignore` — deploy.sh 追加

### 次のアクション
- https://cmv3.fact-ally.com にブラウザからアクセスしてログイン画面を確認
- 初期パスワード（admin1234）を変更する
- 残機能の実装（フェーズ2以降）

---

## Session 2026-05-25 — Phase 1B Week 7-10 実装・デプロイ

### 作業内容
- **バックエンド（モデル・API）**
  - `backend/app/models/enums.py`: 11個の新規ENUMクラス追加（TaskStatus, TaskDependencyType, WeatherType, PhotoType, ScheduleEventType, ScheduleVisibility, AttendeeResponse, PurchaseOrderStatus, DeliveryStatus, PaymentMethod）
  - `backend/app/models/gantt.py`: WorkTypeMaster / ProjectTask（自己参照・依存関係）
  - `backend/app/models/daily_report.py`: DailyReport / DailyReportEntry / DailyReportAttachment
  - `backend/app/models/attendance.py`: VendorAttendance
  - `backend/app/models/schedule.py`: ScheduleEvent / ScheduleEventAttendee
  - `backend/app/models/purchase.py`: PurchaseOrder / PurchaseOrderItem / VendorDelivery
  - `backend/app/models/comment.py`: ProjectComment / ProjectCommentAttachment（JSONB reactions）
  - `backend/app/models/progress.py`: ProgressAttachment に photo_type / work_type / tags / GPS / caption / taken_at 追加
  - `backend/app/models/__init__.py`: 全新規モデルをエクスポート
  - `backend/app/api/v1/gantt.py`: 工種マスタ・タスクCRUD
  - `backend/app/api/v1/daily_reports.py`: 日報CRUD + 提出エンドポイント
  - `backend/app/api/v1/attendance.py`: 出面CRUD + サマリ（月次集計）
  - `backend/app/api/v1/schedule.py`: スケジュールCRUD + 参加返答
  - `backend/app/api/v1/purchase.py`: 発注書CRUD + 発行 + 納品記録
  - `backend/app/api/v1/comments.py`: コメントCRUD + 絵文字リアクション
  - `backend/app/api/v1/kanban.py`: カンバンビュー GET + ステータス移動 PATCH
  - `backend/app/main.py`: 7ルーター追加登録
- **Alembicマイグレーション**
  - `backend/alembic/versions/g1h2i3j4k5l6_phase_1b_week7_10.py`: 9 ENUM型・13テーブル・1ビュー・8カラム追加
  - **バグ修正**: `sa.Enum(..., create_type=False)` は無効（sa.Enum はこのパラメータを無視）。正解は `op.execute("DO $$ BEGIN CREATE TYPE...; EXCEPTION WHEN duplicate_object THEN null; END $$;")` で冪等作成し、カラム定義では `postgresql.ENUM(..., create_type=False)` を使う
- **フロントエンド（7画面）**
  - `frontend/src/app/projects/kanban/page.tsx`: カンバン（HTML5 DnD）
  - `frontend/src/app/projects/[id]/gantt/page.tsx`: ガントチャート（SVGバー・タスク作成）
  - `frontend/src/app/gantt/page.tsx`: 全社工程表
  - `frontend/src/app/daily-report/page.tsx`: 日報（タイムライン + 作成フォーム）
  - `frontend/src/app/calendar/page.tsx`: スケジュールカレンダー（月表示・CRUD）
  - `frontend/src/app/projects/[id]/attendance/page.tsx`: 出面台帳（月次フィルタ・サマリ）
  - `frontend/src/app/projects/[id]/photo-album/page.tsx`: 写真台帳（工種別グリッド・施工前後対比）
  - `frontend/src/app/projects/[id]/purchase/page.tsx`: 発注書（明細入力・発行フロー）
  - `frontend/src/components/layout/AppShell.tsx`: カンバン・全社工程表・日報・カレンダーのナビ追加
  - `frontend/src/components/project/ProjectSubNav.tsx`: 工程表・出面・写真台帳・発注書タブ追加
- **デプロイ**: VPS rebuild 成功・全コンテナ正常稼働（cmv3-api Up, migration g1h2i3j4k5l6 適用済み）

### 変更ファイル
- backend/app/models/enums.py
- backend/app/models/gantt.py（新規）
- backend/app/models/daily_report.py（新規）
- backend/app/models/attendance.py（新規）
- backend/app/models/schedule.py（新規）
- backend/app/models/purchase.py（新規）
- backend/app/models/comment.py（新規）
- backend/app/models/progress.py
- backend/app/models/__init__.py
- backend/app/api/v1/gantt.py（新規）
- backend/app/api/v1/daily_reports.py（新規）
- backend/app/api/v1/attendance.py（新規）
- backend/app/api/v1/schedule.py（新規）
- backend/app/api/v1/purchase.py（新規）
- backend/app/api/v1/comments.py（新規）
- backend/app/api/v1/kanban.py（新規）
- backend/app/main.py
- backend/alembic/versions/g1h2i3j4k5l6_phase_1b_week7_10.py（新規）
- frontend/src/components/layout/AppShell.tsx
- frontend/src/components/project/ProjectSubNav.tsx
- frontend/src/app/projects/kanban/page.tsx（新規）
- frontend/src/app/projects/[id]/gantt/page.tsx（新規）
- frontend/src/app/gantt/page.tsx（新規）
- frontend/src/app/daily-report/page.tsx（新規）
- frontend/src/app/calendar/page.tsx（新規）
- frontend/src/app/projects/[id]/attendance/page.tsx（新規）
- frontend/src/app/projects/[id]/photo-album/page.tsx（新規）
- frontend/src/app/projects/[id]/purchase/page.tsx（新規）

### 次のアクション
- Phase 1B Week 7-10 の動作確認（ブラウザで各画面を開いて確認）
- 残バグ修正があれば対応（QCDSタブボタン・スキャンリダイレクト等の前セッション課題）
- Phase 2以降の実装計画

---

## Session 2026-05-15

### 作業内容
- 全認証済みページを AppShell（サイドバー＋トップバー）レイアウトに更新
  - `scan/page.tsx` — STATUS_STYLE を CSS vars に変換、apiFetch 共通化
  - `admin/import/page.tsx` — CONFLICT_BADGE を CSS vars に変換
  - `admin/stamp-tax/page.tsx` — admin ロールチェック追加、apiFetch 共通化
  - `admin/quote-conditions/page.tsx` — flex→CSS grid、apiFetch 共通化
  - `vendors/[id]/page.tsx` — 動的ブレッドクラム、CSS vars 更新
  - `projects/[id]/progress/page.tsx` — タイムライン UI、AppShell action に追加ボタン
  - `projects/[id]/page.tsx` — 7段階ステータス `.badge.s-*` クラス対応
  - `projects/[id]/history/page.tsx` — 編集履歴ページ
  - `projects/[id]/order/page.tsx` — 注文書管理
  - `projects/[id]/invoice/page.tsx` — 請求書管理
  - `projects/[id]/qcds/page.tsx` — QCDS 管理（大規模ファイル、部分的 Edit）
  - `projects/[id]/quote/page.tsx` — 見積書管理（ReuseModal 含む CSS vars 変換）
  - `scan/[job_id]/page.tsx` — スキャン詳細（スプリットペイン、ApplyModal CSS vars 変換）
- `projects/page.tsx` — `ProjectListItem` に存在しない `project_location` 参照を削除（型エラー修正）
- 本番サーバー（116.80.96.175）へデプロイ完了（HTTP 200 確認）

### 変更ファイル
- `frontend/src/app/scan/page.tsx`
- `frontend/src/app/admin/import/page.tsx`
- `frontend/src/app/admin/stamp-tax/page.tsx`
- `frontend/src/app/admin/quote-conditions/page.tsx`
- `frontend/src/app/vendors/[id]/page.tsx`
- `frontend/src/app/projects/[id]/progress/page.tsx`
- `frontend/src/app/projects/[id]/page.tsx`
- `frontend/src/app/projects/[id]/history/page.tsx`
- `frontend/src/app/projects/[id]/order/page.tsx`
- `frontend/src/app/projects/[id]/invoice/page.tsx`
- `frontend/src/app/projects/[id]/qcds/page.tsx`
- `frontend/src/app/projects/[id]/quote/page.tsx`
- `frontend/src/app/scan/[job_id]/page.tsx`
- `frontend/src/app/projects/page.tsx`（型エラー修正）

### 次のアクション
- https://cmv3.fact-ally.com で各ページの動作・表示を確認
- 残機能の実装（フェーズ2以降）
- `admin/users/page.tsx` は未更新（AppShell 移行していない可能性）

---

## Session 2026-05-15 (続き) — super_admin ロール追加 + プロフィール編集

### 作業内容
- `super_admin` ロール追加（バックエンド・フロントエンド全域）
  - `backend/app/models/enums.py`: `UserRole` enum に `super_admin` 追加（最上位）
  - `backend/alembic/versions/b3e8f91a2c4d_add_super_admin_role.py`: `ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin'` マイグレーション
  - `backend/app/api/v1/admin.py`: `_require_admin()` が admin/super_admin 両方を許可、`_require_super_admin()` を新規追加。create_user / update_user で super_admin ロール割り当ては super_admin のみ可能
  - `frontend/src/types/auth.ts`: `UserRole` 型に `"super_admin"` 追加
  - `frontend/src/components/layout/AppShell.tsx`: サイドバーの admin セクション表示条件を admin/super_admin に拡張、ロールラベル表示を3段階に対応
  - `frontend/src/app/admin/users/page.tsx`: `ROLE_LABEL` / `ROLE_STYLE` に super_admin 追加、`UserFormModal` に `canAssignSuperAdmin` prop（super_admin のみ選択肢が表示）
  - `frontend/src/app/admin/stamp-tax/page.tsx`: ロールチェックを `admin || super_admin` に更新
  - `frontend/src/app/admin/quote-conditions/page.tsx`: 同上
- プロフィール編集画面 `/profile` を新規作成
  - `backend/app/schemas/user.py`: `UserSelfUpdate` スキーマ追加
  - `backend/app/api/v1/auth.py`: `PATCH /api/v1/auth/me` エンドポイント追加（氏名・部署・パスワード変更、現在PW確認付き）
  - `frontend/src/contexts/auth-context.tsx`: `refreshUser()` メソッド追加（プロフィール保存後にサイドバー名称を即時更新）
  - `frontend/src/app/profile/page.tsx`: マイプロフィール編集画面（氏名・部署編集、メール・社員番号は読取専用、パスワード変更セクション）
  - `frontend/src/components/layout/AppShell.tsx`: サイドバーフッターのアバター部分を `/profile` へのリンクに変更
- 本番サーバーへデプロイ完了（cmv3-api / cmv3-web 再ビルド・再起動、`alembic upgrade head` 実行）

### 変更ファイル
- `backend/app/models/enums.py`
- `backend/app/schemas/user.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/admin.py`
- `backend/alembic/versions/b3e8f91a2c4d_add_super_admin_role.py` — 新規
- `frontend/src/types/auth.ts`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/app/admin/users/page.tsx`
- `frontend/src/app/admin/stamp-tax/page.tsx`
- `frontend/src/app/admin/quote-conditions/page.tsx`
- `frontend/src/contexts/auth-context.tsx`
- `frontend/src/app/profile/page.tsx` — 新規

### 次のアクション
- https://cmv3.fact-ally.com/admin/users でログイン中ユーザーのロールを `super_admin` に変更する（現在 `admin` のまま）
- ロール変更後、サイドバーに「システム管理者」と表示されることを確認
- /profile ページでパスワード変更・氏名変更が動作することを確認

---

## Session 2026-05-15 (続き) — 業者見積スキャンページ全面リデザイン

### 作業内容
- 401認証エラー修正: 複数ページの `getToken()` が `"access_token"` を参照していたところを `"cmv3_access_token"` に修正（前セッションで完了・デプロイ済み）
- `frontend/src/app/scan/page.tsx` を全面リライト（設計書 `scan-upload.html` 準拠）
  - KPIストリップ4枚（今月のスキャン/平均信頼度/未レビュー/完了）
  - ドラッグ＆ドロップ対応アップロードゾーン（`onDragOver`/`onDragLeave`/`onDrop`）
  - 紐付け先バー（案件選択モーダル付き、選択した案件IDをアップロードURLに付与）
  - TipsバーとupdateMsgフィードバック
  - フィルタタブ付きジョブ一覧（すべて/処理中/未レビュー/完了）、7カラムCSS grid
  - ステータス別ドット・プログレスバー・信頼度バッジ・アクションボタン
- `frontend/src/app/scan/[job_id]/page.tsx` を全面リライト（設計書 `scan-review.html` 準拠）
  - AppShell不使用・フルスクリーン独自レイアウト（gridTemplateRows: 52px auto auto 1fr）
  - トップバー（戻るリンク・AIチップ・ファイル名・原本DLボタン・再解析ボタン）
  - ジョブサマリーバー（業者名・見積日・合計金額/項目数/全体信頼度/要確認 stats）
  - 転記先バー（案件紐付け選択・棄却ボタン）
  - 分割ペイン左: PDFプレビュー（blob URL iframe）
  - 分割ペイン右: ヘッダカード（業者名オートコンプリート/日付/金額）＋明細テーブル（信頼度ハイライト）＋転記オプション（QCDS/見積/業者マスタ）＋sticky actbar
  - PATCH /scan/results/{id}（保存）/ POST /scan/results/{id}/confirm（確認）/ POST /scan/results/{id}/apply（転記）
- `backend/app/schemas/scan.py`: `ScanJobRead` に `vendor_name_detected` / `confidence_score` / `item_count` 追加
- `backend/app/api/v1/scan.py`: 一覧エンドポイントで `selectinload` による eager load、`_job_to_read()` に `first_result` 引数追加
- `frontend/src/types/scan.ts`: `ScanJob` に上記3フィールド追加
- 本番サーバーへデプロイ完了（cmv3-api / cmv3-web 再ビルド・再起動）

### 変更ファイル
- `frontend/src/app/scan/page.tsx` — 全面リライト
- `frontend/src/app/scan/[job_id]/page.tsx` — 全面リライト
- `frontend/src/types/scan.ts` — 任意フィールド3件追加
- `backend/app/schemas/scan.py` — ScanJobRead 拡張
- `backend/app/api/v1/scan.py` — 一覧eager load対応・_job_to_read更新

### 次のアクション
- https://cmv3.fact-ally.com/scan で新デザインの動作を確認
- https://cmv3.fact-ally.com/admin/users でロールを `super_admin` に変更（前セッションからの残タスク）
- Step 6以降（施工管理・現場日報）の実装に着手

---

## Session 2026-05-15 (続き) — 見積システム全面再設計（V2の反省を踏まえ）

### 背景・設計方針
- V2 の失敗原因: 後付け機能追加で迷路状態・スキャンと案件が連動しない・稟議承認が保存されない・PDF がテンプレートレイアウトを守らない
- V3 方針: 案件の中で全て完結、機能を最初から統合設計

### 作業内容
#### バックエンド
- `backend/alembic/versions/d9f3a2c7e1b8_add_quote_versions_sections.py` 新規作成
  - `quote_versions` テーブル追加（業者見積版: vendor, markup_rate, is_active）
  - `quote_sections` テーブル追加（大項目 A/B/C...）
  - `quote_items` に `version_id`, `section_id`, `cost_price`, `item_markup_rate` カラム追加
  - `quotes` に `discount_amount`, `approved_at`, `reviewed_at`, `person_in_charge_confirmed_at` カラム追加
- `backend/app/models/quote.py` 全面更新
  - `QuoteVersion` モデル追加（業者見積版、markup_rate, is_active）
  - `QuoteSection` モデル追加（大項目 A/B/C、row_no, amount）
  - `Quote` モデル拡張（discount_amount, 稟議タイムスタンプ3列, versions/sections relationship）
  - `QuoteItem` モデル拡張（version_id, section_id, cost_price, item_markup_rate）
- `backend/app/schemas/quote.py` 全面更新
  - `QuoteVersionCreate/Update/Read`, `QuoteSectionCreate/Update/Read`, `QuoteItemInput/Read` 新規
  - `QuoteApproveStamp` スキーマ（稟議押印操作）
  - `QuoteDetail` に versions/sections/items 含む全フィールド
- `backend/app/api/v1/quotes.py` 全面更新
  - QuoteVersion CRUD（GET/POST/PATCH/DELETE /versions）
  - QuoteSection CRUD（GET/POST/PATCH/DELETE /sections）
  - POST /approve（稟議スタンプ押印・DB保存・即時反映）
  - POST /versions/{id}/import-items（スキャン結果から版へ一括インポート）
  - markup_rate による原価→販売単価自動計算
- `backend/app/api/v1/projects.py` 更新
  - `create_project` で Quote + QuoteVersion(版1) を自動生成（案件作成と同時にベースが用意される）

#### フロントエンド
- `frontend/src/app/projects/[id]/estimate/page.tsx` 新規作成
  - 左ペイン: 版リスト（追加/削除/適用切替）
  - 右ペイン: 選択版の明細テーブル（原価単価・掛率・販売単価・金額の列、行追加/削除）
  - 版の全体掛率をインライン編集可能
  - 行ごとに掛率上書き可能（item_markup_rate）
  - 原価→販売単価をリアルタイム自動計算
  - スキャン連携ヒントバナー
- `frontend/src/app/projects/[id]/quote/page.tsx` 全面再設計
  - 稟議承認スタンプ3つ（担当/査閲/承認）— ユーザー選択後にDBへ保存・リロードで復元
  - 大項目一覧（section_letter + section_name + lump sum 金額）
  - 大項目選択で右ペインに明細表示
  - 適用中版の is_active 判定による合計金額計算（値引き対応）
  - 大項目追加フォーム（記号 + 名称）
- `frontend/src/app/projects/[id]/page.tsx` 更新
  - 「関連データ」セクションに「業者見積管理 → /estimate」「顧客向け見積 → /quote」リンク追加

### 変更ファイル
- `backend/alembic/versions/d9f3a2c7e1b8_add_quote_versions_sections.py` — 新規
- `backend/app/models/quote.py` — QuoteVersion/QuoteSection モデル追加
- `backend/app/schemas/quote.py` — 全面更新
- `backend/app/api/v1/quotes.py` — 全面更新
- `backend/app/api/v1/projects.py` — 案件作成時 Quote 自動生成
- `frontend/src/app/projects/[id]/estimate/page.tsx` — 新規
- `frontend/src/app/projects/[id]/quote/page.tsx` — 全面再設計
- `frontend/src/app/projects/[id]/page.tsx` — estimate リンク追加

### 次のアクション
- **【デプロイ待ち】** サーバー(116.80.96.175)が現在 ping 不通のため未デプロイ。復旧後に以下を実行:
  ```bash
  # 変更ファイルを転送後
  ssh root@116.80.96.175 "cd /root/cmv3 && docker compose -f docker-compose.prod.yml up -d --build && sleep 20 && docker exec cmv3-api alembic upgrade head"
  ```
- デプロイ確認後: https://cmv3.fact-ally.com/projects で新規案件作成 → 「業者見積管理」リンク表示確認
- 次フェーズ: Excel PDF 出力（既存テンプレートを順守した出力）、施工管理・現場日報

---

## Session 2026-05-15

### 作業内容
- 見積システム全面再設計（V2廃止理由：後付け機能追加による迷路化）
- `quote_versions`（業者見積版）・`quote_sections`（大項目A/B/C）テーブル追加
- `quote_items` に cost_price・item_markup_rate・version_id・section_id カラム追加
- `quotes` に discount_amount・approved_at・reviewed_at・person_in_charge_confirmed_at カラム追加
- Alembic マイグレーション `d9f3a2c7e1b8` 作成・デプロイ（多重ヘッド問題解消済み）
- `backend/app/models/quote.py` 全面書き直し（QuoteVersion・QuoteSection モデル追加）
- `backend/app/schemas/quote.py` 全面書き直し（版・大項目・押印スキーマ追加）
- `backend/app/api/v1/quotes.py` 全面書き直し（版CRUD・大項目CRUD・押印API追加）
- `backend/app/api/v1/projects.py` 修正：プロジェクト作成時にQuote+Version1を自動生成
- `/projects/{id}/estimate` ページ新規作成（業者見積版管理・原価・マークアップ編集）
- `/projects/{id}/quote` ページ全面書き直し（顧客向け見積・大項目・稟議承認押印）
- `/projects/{id}` タブに「業者見積管理」「顧客向け見積」追加
- 既存案件でのQuote自動生成（ページ初回アクセス時にQuoteがなければPOSTで作成）
- 稟議承認押印ドロップダウンがユーザー0件で空表示のバグ修正
  - 原因：`/api/v1/admin/users` はadmin専用 → 一般ユーザーで403
  - 修正：`GET /api/v1/auth/users` エンドポイント新規追加（全認証済みユーザー参照可）
  - フロントエンド：`/api/v1/admin/users` → `/api/v1/auth/users` に変更
- WebARENA ファイアウォール IP 更新（42.127.200.231）、SSH 疎通確認
- Alembic 多重ヘッドエラー解消・マイグレーション成功確認
- 502エラー解消（コンテナ再作成後のnginx内部IP変更対応 → docker restart cmv3-nginx）
- 本番デプロイ・動作確認（見積ページ表示・稟議承認エンドポイント確認）

### 変更ファイル
- `backend/alembic/versions/d9f3a2c7e1b8_add_quote_versions_sections.py` — 新規作成
- `backend/app/models/quote.py` — 全面書き直し
- `backend/app/schemas/quote.py` — 全面書き直し
- `backend/app/api/v1/quotes.py` — 全面書き直し
- `backend/app/api/v1/projects.py` — プロジェクト作成時Quote自動生成追加
- `backend/app/api/v1/auth.py` — GET /auth/users エンドポイント追加
- `frontend/src/app/projects/[id]/estimate/page.tsx` — 新規作成（業者見積版管理）
- `frontend/src/app/projects/[id]/quote/page.tsx` — 全面書き直し（稟議承認・大項目）
- `frontend/src/app/projects/[id]/page.tsx` — 業者見積管理・顧客向け見積タブ追加

### 次のアクション
- 稟議承認押印のエンドツーエンド確認：押印→名前表示→リロード後も保持
- Excel/PDF 帳票出力（既存テンプレートに値を埋めるのみ、スタイル変更禁止）
- スキャン機能をプロジェクトコンテキスト内に統合（スキャン→案件紐付け→見積版に取込）

---

## Session 2026-05-18

### 作業内容
- 稟議承認押印ドロップダウンの 500 エラー修正
  - 原因：`GET /api/v1/auth/users` で `User.display_name` を参照していたが、モデルの実際のカラム名は `full_name`
  - `backend/app/api/v1/auth.py`: `order_by(User.display_name)` → `order_by(User.full_name)` に修正
  - `frontend/src/app/projects/[id]/quote/page.tsx`: `UserOption.display_name` → `full_name` に統一（型定義・表示・getUserName関数の全3箇所）
- 本番デプロイ（cmv3-api / cmv3-web 再ビルド・再起動、nginx 再起動）

### 変更ファイル
- `backend/app/api/v1/auth.py` — `order_by(User.full_name)` に修正
- `frontend/src/app/projects/[id]/quote/page.tsx` — `UserOption` 型・表示・getUserName を `full_name` に統一

### 次のアクション
- 稟議承認押印のエンドツーエンド確認：ログイン → 押印ボタン → ユーザー一覧表示 → 選択 → 名前・日付表示 → リロード後も保持
- Excel/PDF 帳票出力（既存テンプレートに値を埋めるのみ、スタイル変更禁止）
- スキャン機能をプロジェクトコンテキスト内に統合

---

## Session 2026-05-19 — Phase A: 案件サブナビゲーション

### 作業内容
- `docs/base/企画設計MD/12_VSCode変更指示書.md` Phase A（㉙〜㉜）を実装
- `docs/base/Construction_Manager_v3/handoff/README.md` のプロトタイプ設計を参照・統合
- **バックエンド**
  - `backend/app/schemas/project.py`: `ProjectCounts` クラス追加、`ProjectDetail` に `counts: ProjectCounts` フィールド追加
  - `backend/app/api/v1/projects.py`: `history_count`（edit_histories）と `estimate_count`（quote_versions）を新規カウント、`counts=ProjectCounts(...)` をレスポンスに追加、`ProjectCounts` をインポート
- **フロントエンド**
  - `frontend/src/contexts/project-context.tsx` 新規作成（ProjectSubNavContext / useProjectSubNav / ProjectCounts 型）
  - `frontend/src/components/project/ProjectSubNav.tsx` 新規作成（9タブ: 詳細/QCDS/業者見積/顧客見積/注文書/注文請書/請求書/進捗/編集履歴、バッジ付き件数、アクティブ下線）
  - `frontend/src/app/projects/[id]/layout.tsx` 新規作成（Client Component、`/api/v1/projects/{id}` をフェッチして Context 提供）
  - `frontend/src/components/layout/AppShell.tsx` 修正（`useProjectSubNav` を読み取り、topbar と page の間に `ProjectSubNav` を自動挿入）
  - `frontend/src/app/projects/[id]/page.tsx` 修正（「関連データ」セクション削除、役割をサブナビに移譲）
  - `frontend/src/app/projects/[id]/acknowledgment/page.tsx` 新規作成（注文請書 Phase D 実装予定の仮置きページ）
- 本番デプロイ完了（cmv3-api / cmv3-web 再ビルド・nginx 再起動）

### 変更ファイル
- `backend/app/schemas/project.py` — ProjectCounts 追加
- `backend/app/api/v1/projects.py` — history/estimate カウント追加、counts フィールド追加
- `frontend/src/contexts/project-context.tsx` — 新規作成
- `frontend/src/components/project/ProjectSubNav.tsx` — 新規作成
- `frontend/src/app/projects/[id]/layout.tsx` — 新規作成
- `frontend/src/components/layout/AppShell.tsx` — subnav 挿入
- `frontend/src/app/projects/[id]/page.tsx` — 関連データ削除
- `frontend/src/app/projects/[id]/acknowledgment/page.tsx` — 新規（仮置き）

### 次のアクション
- 動作確認チェックリスト（Phase A の全チェック）を実施
- Phase B: スキャン-QCDS 連動の改修（一括選択・一括転記・一括削除）
- Phase C: 顧客マスタ実装

---

## Session 2026-05-20 (デザインシステム採用 続き)

### 作業内容
- ハンドオフデザイン採用の続き（前セッションからの引き継ぎ）
- `cmdk` を `package.json` の dependencies に追加（前セッションでインストールはしたが package.json に記載漏れ）
- `types/project.ts` の `ProjectHeader.counts` フィールドの型を `Record<ProjectSubPath, number>` → `Record<string, number>` に修正（`ProjectSubPath` 未定義エラー）
- Docker イメージ再ビルド（cmv3-web）→ ビルド成功・コンテナ再起動完了

### 変更ファイル
- `frontend/package.json` — `cmdk: ^1.0.0` 追加
- `frontend/src/types/project.ts` — `ProjectHeader.counts` 型エラー修正

### 次のアクション
- ブラウザで scan ページ・scan/[job_id] ページの表示確認
- Phase B: スキャン-QCDS 連動（一括選択・一括転記・一括削除）
- Phase C: 顧客マスタ実装

---

## Session 2026-05-20 (ハンドオフデザイン全面採用 QCDS・案件一覧)

### 作業内容
- `globals.css` に QCDS ページ用・案件一覧ページ用 CSS クラスを追加（`.qkpi`, `.qcds-tabs`, `.sec`, `.sec-head`, `.badge-letter`, `.qtbl`, `.a-table`, `.ladder`, `.scenario`, `.listkpis`, `.lkpi`, `.fbar`, `.ptbl`, `.pagi`）
- `projects/[id]/qcds/page.tsx` を全面書き直し：KPI ストリップ / 3カラム A セクション / B セクション（経費） / 利益階段 / C セクション + 価格試算表 / 設定パネル（折りたたみ）
- `projects/page.tsx` を全面書き直し：listkpis ミニ KPI バー / fbar フィルタバー / ptbl プロジェクトテーブル / pagi ページネーション
- サーバーへ変更ファイル3点を転送し `cmv3-web` コンテナ再ビルド・デプロイ完了

### 変更ファイル
- `frontend/src/app/globals.css` — QCDS・案件一覧用 CSS クラス群を末尾に追加
- `frontend/src/app/projects/[id]/qcds/page.tsx` — 全面リライト
- `frontend/src/app/projects/page.tsx` — 全面リライト

### 次のアクション
- ブラウザで `/projects`・`/projects/[id]/qcds` の表示確認
- ダッシュボード (`/dashboard`)、業者一覧 (`/vendors`) もハンドオフに合わせてリライト予定
- 見積書・注文書・請求書ページの複雑な帳票ページは後続フェーズで対応

---

## Session 2026-05-21 (Phase B完了確認・ダッシュボード&業者ページ redesign)

### 作業内容
- Phase B（スキャン-QCDS連動）全項目確認：B-1（DB migration `f1e9c8b7a6d5`）、B-2（bulk API: apply/delete/restore/purge）、B-3-1〜B-3-3（フロントエンド）すべて実装済みを確認
- `dashboard/page.tsx` を Recharts 排除・SVG ドーナツチャート + SVG バーチャートで全面書き直し（ハンドオフ準拠）
- `vendors/page.tsx` を `.vtbl` / `.vn-row` / `.trade-chip` スタイルで全面書き直し
- `vendors/[id]/page.tsx` を `.v-hero` / `.v-grid` / `.field-row` / `.hist-tbl` スタイルで全面書き直し（単価推移 SVG ラインチャート追加）
- `globals.css` に `.kpi-grid`, `.chart-row`, `.donut-wrap`, `.bar-chart`, `.vtbl`, `.v-hero`, `.v-grid`, `.field-row`, `.hist-tbl` 等を追加
- Phase B 動作確認チェックリスト全9項目をコードレビューで確認
- 変更済みファイル3点をサーバーへ転送、`cmv3-web` コンテナ再ビルド・デプロイ完了

### 変更ファイル
- `frontend/src/app/globals.css` — ダッシュボード・業者リスト・業者詳細用 CSS クラス群を追加
- `frontend/src/app/dashboard/page.tsx` — 全面リライト（SVG チャート、Recharts 排除）
- `frontend/src/app/vendors/page.tsx` — 全面リライト（ハンドオフ準拠）
- `frontend/src/app/vendors/[id]/page.tsx` — 全面リライト（v-hero / v-grid / 単価推移チャート）

### 次のアクション
- ブラウザで `/dashboard`・`/vendors`・`/vendors/[id]` の表示確認
- Phase C: 顧客マスタ実装（12_VSCode変更指示書.md Phase C）
- 見積書・注文書・請求書ページの帳票連動は Phase D で対応

---

## Session 2026-05-21 (Phase C: 顧客マスタ実装)

### 作業内容
- Phase C 全実装完了（C-1〜C-5）
- C-1: Alembic マイグレーション `a1b2c3d4e5f6` — clients/client_sites/client_contacts テーブル新規、clientrank ENUM、projects テーブルに client_id/client_site_id/client_contact_id FK列追加
- C-2: `backend/scripts/migrate_clients.py` — 既存 projects.client_name から clients マスタを構築するスクリプト（dry_run 対応）
  - dry_run 結果: 3顧客（株式会社 平和堂・協和自工 株式会社・株式会社ABC）、1店舗（アル・プラザ アミ）
  - 本番実行は保留中（ひささんが確認後に実施）
- C-3: `/api/v1/clients` エンドポイント群 — 顧客CRUD、/sites CRUD、/contacts CRUD、/search?q= インクリメンタル検索
  - `/api/v1/projects` に `client_id` クエリパラメータ追加（顧客別案件一覧用）
- C-4-1: `/clients/page.tsx` — 一覧（vtbl スタイル、ランクフィルタ、ページネーション、新規作成モーダル）
- C-4-2: `/clients/[id]/page.tsx` — 詳細（v-hero ヒーロー、基本情報+取引情報 2カラム、地域タブ付き店舗一覧、担当者一覧、関連案件一覧）
- C-4-3: `frontend/src/components/client/SiteSearch.tsx` — 顧客検索+店舗選択の2段階コンポーネント（案件作成・編集画面で共通利用）
- C-4-4: `projects/[id]/page.tsx` 編集モードの「発注者」フィールドを SiteSearch コンポーネントに差し替え（client_id/client_site_id を PATCH で送信）、表示モードで client_id あればリンク表示
- C-5: AppShell.tsx の NAV_WORK に「顧客マスタ」 `/clients` ナビ追加
- backend schemas/project.py + api/v1/projects.py に client_id/client_site_id フィールド追加
- frontend types/project.ts に client_id/client_site_id 追加
- Alembic マイグレーション `a1b2c3d4e5f6` 本番DB適用済み
- cmv3-api コンテナ再起動・cmv3-web コンテナ rebuild & デプロイ完了

### 変更ファイル（新規）
- `backend/app/models/client.py` — Client/ClientSite/ClientContact モデル
- `backend/app/schemas/client.py` — Pydantic スキーマ群
- `backend/app/api/v1/clients.py` — APIエンドポイント
- `backend/alembic/versions/a1b2c3d4e5f6_add_clients.py` — Alembic マイグレーション
- `backend/scripts/migrate_clients.py` — データ移行スクリプト
- `frontend/src/types/client.ts` — TypeScript 型定義
- `frontend/src/app/clients/page.tsx` — 顧客一覧ページ
- `frontend/src/app/clients/[id]/page.tsx` — 顧客詳細ページ
- `frontend/src/components/client/SiteSearch.tsx` — 店舗検索コンポーネント

### 変更ファイル（更新）
- `backend/app/models/enums.py` — ClientRank enum 追加
- `backend/app/models/project.py` — client_id/client_site_id/client_contact_id FK 追加
- `backend/app/models/__init__.py` — Client/ClientSite/ClientContact エクスポート追加
- `backend/app/schemas/project.py` — ProjectDetail/ProjectUpdate に client_id/client_site_id 追加
- `backend/app/api/v1/projects.py` — client_id クエリフィルタ追加、ProjectDetail に client_id/client_site_id 出力
- `backend/app/main.py` — clients ルーター追加
- `frontend/src/types/project.ts` — client_id/client_site_id フィールド追加
- `frontend/src/app/projects/[id]/page.tsx` — 発注者フィールドを SiteSearch に変更、リンク表示対応
- `frontend/src/components/layout/AppShell.tsx` — 顧客マスタ ナビ追加

### 次のアクション
- 本番 DB データ移行: `docker exec -w /app cmv3-api /app/.venv/bin/python scripts/migrate_clients.py` を実行
- Phase C 動作確認チェックリスト7項目の実施
- `/clients` 画面で顧客一覧・新規登録・詳細確認
- `/projects/[id]` 編集モードで顧客検索＋店舗選択が動くか確認
- Phase D（帳票連動＋注文請書テーブル）へ進む前に上記確認を完了

---

## Session 2026-05-21

### 作業内容
- Phase E 全実装（E-1 〜 E-4）完了
  - E-1: Alembic マイグレーション c1d2e3f4a5b6 — section_templates / section_template_items テーブル追加
  - E-2a/b/c: SectionTemplate モデル・スキーマ・API（CRUD）新規作成
  - quotes.py に apply-template、単発 item CRUD（POST/PATCH/DELETE）、見積番号自動採番（{project_number}-{N}）追加
  - E-2d: main.py / models/__init__.py に section_templates を追加
  - E-2e/f: excel_export.py の export_quote_excel を多シート対応に更新（表紙・大項目集計・大項目別明細）、exports.py に sections selectinload 追加
  - E-4a: frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx — 見積書エディタ新規作成
  - E-4b: frontend/src/app/projects/[id]/quote/page.tsx — 見積書一覧ページに改修
  - E-4c: frontend/src/app/admin/section-templates/page.tsx — テンプレート管理画面新規作成

### 変更ファイル
- 新規: backend/alembic/versions/c1d2e3f4a5b6_phase_e_section_templates.py
- 新規: backend/app/models/section_template.py
- 新規: backend/app/schemas/section_template.py
- 新規: backend/app/api/v1/section_templates.py
- 変更: backend/app/api/v1/quotes.py
- 変更: backend/app/services/excel_export.py
- 変更: backend/app/api/v1/exports.py
- 変更: backend/app/main.py
- 変更: backend/app/models/__init__.py
- 新規: frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx
- 変更: frontend/src/app/projects/[id]/quote/page.tsx
- 新規: frontend/src/app/admin/section-templates/page.tsx

### 次のアクション
- 本番サーバーへの Phase D + E デプロイ（SSH キー特定が先決）
  - alembic upgrade head で b8c2d4e6f8a1 / c1d2e3f4a5b6 を順次実行
- Phase F（複数請求書・分割請求）の実装

---

## Session 2026-05-21 (続き) — Phase F 実装・SSH キー特定

### 作業内容
- SSHキーファイルとGitHubトークンの場所を確認
  - 秘密鍵: `C:\Users\user\Documents\private_key_02.pem`
  - GitHubトークン: `C:\Users\user\Documents\GitHub個人アクセストークン（クラシック）.txt`
- Phase F（複数請求書・分割請求・入金記録）全実装完了
  - F-1: Alembic マイグレーション d1e2f3a4b5c6 — payments テーブル・billingmethod enum・invoices に4カラム追加・project_invoice_summary VIEW 作成
  - F-2: models/enums.py に BillingMethod 追加、models/invoice.py に Payment モデル追加・Invoice に請求方法カラム追加
  - F-3: schemas/invoice.py に PaymentCreate/PaymentRead/InvoiceSummary スキーマ追加・InvoiceRead を Phase F フィールド対応に更新
  - F-4: api/v1/invoices.py — 請求番号を `{project_number}-請{N}` 形式に変更、billing_method/payments 対応、POST /invoices/{id}/payments・DELETE /payments/{id}・GET /invoice-summary エンドポイント追加
  - F-5: tasks/invoice_tasks.py 新規作成（check_overdue_invoices タスク）、celery_app.py に beat_schedule 追加（毎朝9時JST）
  - F-6a: frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx 新規作成（支払期日・請求方法・入金記録テーブル・入金追加フォーム）
  - F-6b: frontend/src/app/projects/[id]/invoice/page.tsx を全面改修（請求サマリバー・一覧テーブル・詳細ページリンク）
  - frontend/src/types/invoice.ts に BillingMethod / PaymentRead / InvoiceSummary 追加

### 変更ファイル
- 新規: `backend/alembic/versions/d1e2f3a4b5c6_phase_f_payments.py`
- 変更: `backend/app/models/enums.py` — BillingMethod 追加
- 変更: `backend/app/models/invoice.py` — Invoice 拡張・Payment モデル追加
- 変更: `backend/app/models/__init__.py` — Payment エクスポート追加
- 変更: `backend/app/schemas/invoice.py` — Phase F スキーマ追加
- 変更: `backend/app/api/v1/invoices.py` — 全面更新
- 新規: `backend/app/tasks/invoice_tasks.py`
- 変更: `backend/app/tasks/celery_app.py` — beat_schedule 追加
- 変更: `frontend/src/types/invoice.ts` — Phase F 型追加
- 新規: `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx`
- 変更: `frontend/src/app/projects/[id]/invoice/page.tsx` — 全面改修

### 次のアクション
- Phase D + E + F を本番サーバーにデプロイ
  1. `ssh -i "C:\Users\user\Documents\private_key_02.pem" user@116.80.96.175`
  2. `cd /opt/cmv3 && git pull`
  3. `docker-compose -f docker-compose.prod.yml exec api alembic upgrade head`
  4. `docker-compose -f docker-compose.prod.yml build && docker-compose -f docker-compose.prod.yml up -d`
- 未修正バグ ①②③（スキャン選択/Excelインポート/複数PDF D&D）

---

## Session 2026-05-21

### 作業内容
- 見積書詳細ページ (`projects/[id]/quote/[quote_id]/page.tsx`) を2カラムレイアウトに改修
  - 左カラム: 大項目ブロック（既存）+ 大項目未割り当て明細 + 大項目追加フォーム
  - 右カラム (sticky 264px): 合計カード（青ヘッダ＋小計/税/合計）+ 粗利ゲージバー + 大項目別内訳 + 承認スタンプ欄
- バグ② Excelインポート修正
  - backend: `parse_excel` で「記入例」シートおよびQCDS・帳票シートを自動除外
  - frontend: プレビュー画面に行単位チェックボックス追加（全選択トグル付き）。チェックした行のみインポート実行
  - インポートボタンのラベルを「選択した N 件をインポート」に変更
- バグ①②③はすべて修正完了

### 変更ファイル
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — 2カラムレイアウト実装
- `backend/app/services/excel_import.py` — 記入例シート・帳票シート除外ロジック追加
- `frontend/src/app/admin/import/page.tsx` — 行選択チェックボックス追加

### 次のアクション
- 統合テスト: subnav・invoices.payments lazy-load 最終確認
- Phase D + E + F を本番サーバーにデプロイ
  1. `ssh -i "C:\Users\user\Documents\private_key_02.pem" user@116.80.96.175`
  2. `cd /opt/cmv3 && git pull`
  3. `docker-compose -f docker-compose.prod.yml exec api alembic upgrade head`
  4. `docker-compose -f docker-compose.prod.yml build && docker-compose -f docker-compose.prod.yml up -d`

---

## Session 2026-05-21 (続き)

### 作業内容
- Excelインポートを全シート対応に全面強化
  - QCDSシート → QCDS + QCDSDirectWork[] (rows 15-43, B=NO, C=業者名, K=予算)
  - 表紙シート → Quote ヘッダ（R1=見積番号, O2/R2/U2=発行日, C14=合計, C18=工事名, C20=場所, C24=支払条件, C22=有効期限）
  - 内訳書シート → QuoteSection[] + QuoteItem[] (サマリーブロックで大項目定義、詳細ブロックで明細、詳細が無い場合はサマリー行でフォールバック)
  - 注文書・請書シート → Order + Acknowledgment (D24=税抜, D27=税, D30=合計, C38=支払条件)
  - 請求書シート → Invoice + InvoiceItem[] (L19=税抜, P19=税, T19=合計, rows24-38=明細)
- 新規案件インポート時に関連レコードを一括作成（既存上書き時は案件基本情報のみ更新）
- プレビュー画面に「取込内容」列を追加（QCDS×N行、見積N項×N行、注文書、請求書 バッジ表示）
- ステップ1説明文に取込シート一覧を追記

### 変更ファイル
- `backend/app/services/excel_import.py` — 全面書き直し（全シートパーサー追加）
- `backend/app/api/v1/excel_import.py` — 全面書き直し（関連レコード一括作成、プレビュー件数追加）
- `frontend/src/app/admin/import/page.tsx` — PreviewRow型拡張・取込内容列追加

### 次のアクション
- 実際のExcelファイルでテスト（工事台帳2026.xlsx と実データ）
- 本番サーバーへのデプロイ
  1. ssh -i "C:\Users\user\Documents\private_key_02.pem" user@116.80.96.175
  2. cd /opt/cmv3 && git pull
  3. docker-compose -f docker-compose.prod.yml exec api alembic upgrade head
  4. docker-compose -f docker-compose.prod.yml build && up -d

---

## Session 2026-05-22 (後半)

### 作業内容
- 業者見積スキャンページに工事台帳ExcelをD&Dしてしまう誤操作問題を調査・修正
  - 原因：スキャンページのD&Dゾーンが .xlsx を受け付けるため、工事台帳Excelを誤ってアップロード可能だった
  - 対策①：バックエンド scan.py の upload_scan_file エンドポイントに工事台帳検出ロジックを追加
    - openpyxl でシート名を確認し「工事台帳」シートが存在する場合は HTTP 422 + 案内メッセージを返す
  - 対策②：フロントエンド scan/page.tsx の D&D ゾーンに注意書きを追加
    - 「工事台帳ExcelのインポートはExcelインポートページをご利用ください」
- 本番環境へデプロイ（cmv3-api + cmv3-web リビルド・再起動）

### 変更ファイル
- backend/app/api/v1/scan.py — 工事台帳Excel誤アップロード検出・拒否ロジック追加
- frontend/src/app/scan/page.tsx — D&Dゾーンに工事台帳インポートページ案内注記追加

### 次のアクション
- スキャンページに残っている誤アップロードされた「工事台帳 (1).xlsx」をユーザーが手動削除する必要あり
  - スキャン一覧の行末「削除」ボタンで削除可能
- Excelインポートは /admin/import ページから実施すること
- 前回セッションのデプロイ済み未確認修正の動作確認が必要：
  - スキャン詳細：案件選択時のQCDS/見積自動チェック
  - 案件一覧：一括削除
  - Excelインポート：UniqueViolation修正

---

## Session 2026-05-22 (デザインシステム統合 + QCDS経費行機能)

### 作業内容
- デザインシステム統合（handoff SSOT確認）
  - `frontend/tailwind.config.ts` に `fontFamily.serif` を追記（Hiragino Mincho ProN / Yu Mincho / Noto Serif JP）
  - `frontend/src/app/globals.css` は既に handoff/tokens.css の全CSS変数を含有 → 追加インポート不要と確認
- QCDS経費欄ゼロ表示バグ修正
  - 原因：`qcds_calculator.py` の保険料計算基準が `direct_cost_agreed` 固定だったが、Excelインポートは `budget_amount` のみ投入するため agreed = 0 になっていた
  - 修正：`a = direct_cost_agreed if direct_cost_agreed > 0 else direct_cost_budget` のフォールバック追加
- QCDS経費行の編集・追加機能実装
  - Alembicマイグレーション `e2f3a4b5c6d7_add_qcds_expense_items.py` 作成 → `qcds_expense_items` テーブル追加
  - `backend/app/models/qcds.py` に `QCDSExpenseItem` モデル追加・`QCDS.expense_items` リレーション追加
  - `backend/app/schemas/qcds.py` に `ExpenseItemInput` / `ExpenseItemRead` 追加
  - `backend/app/services/qcds_calculator.py` に `apply_expense_item_overrides()` 関数追加（上書き値・カスタム行を反映し依存合計を再計算）
  - `backend/app/api/v1/qcds.py` 全面書き直し：初回GETで標準8行を自動作成、PUTで全置換保存
  - `frontend/src/types/qcds.ts` に経費行型定義追加
  - `frontend/src/app/projects/[id]/qcds/page.tsx` 全面書き直し：`ExpenseRow` コンポーネント・B_site/B_dept/Cセクション別表示・クリックで金額上書き・↺元に戻す・カスタム行追加/削除
- 本番サーバーへデプロイ
  - migration実行：`Running upgrade d1e2f3a4b5c6 -> e2f3a4b5c6d7` 成功
  - cmv3-api / cmv3-web イメージリビルド・コンテナ再起動完了

### 変更ファイル
- `frontend/tailwind.config.ts` — fontFamily.serif 追加
- `backend/alembic/versions/e2f3a4b5c6d7_add_qcds_expense_items.py` — 新規マイグレーション
- `backend/app/models/qcds.py` — QCDSExpenseItem モデル追加
- `backend/app/schemas/qcds.py` — ExpenseItemInput / ExpenseItemRead 追加
- `backend/app/services/qcds_calculator.py` — agreed→budget フォールバック修正 + apply_expense_item_overrides 追加
- `backend/app/api/v1/qcds.py` — 経費行CRUD対応・デフォルト自動作成
- `frontend/src/types/qcds.ts` — ExpenseSection / ExpenseItemInput / ExpenseItemRead 追加
- `frontend/src/app/projects/[id]/qcds/page.tsx` — 経費行UI全面書き直し

### 次のアクション
- QCDS経費欄の動作確認（ブラウザで https://cmv3.fact-ally.com にアクセスし経費欄が正しく計算されているか確認）
- カスタム経費行の追加・削除・金額入力が正常に動作するか確認

---

## Session 2026-05-22 (バグ修正3件: QCDS URL・保険料計算基準・見積合計再計算)

### 作業内容
1. **詳細タブ QCDS ウィジェット404修正**
   - `frontend/src/app/projects/[id]/page.tsx` の `fetchQcds` 関数で URL が `/api/v1/qcds/${id}` → `/api/v1/projects/${id}/qcds` に誤っていた
   - 正しい URL に修正（1行）

2. **QCDS 保険料の計算基準をExcelに合わせて修正**
   - 従来: 労災・工事保険・特殊保険すべてを「直接工事費合計（agreed or budget フォールバック）」で計算
   - Excelの正しい定義:
     - 労災保険 → 工事価格（project_price）× 料率
     - 工事保険・賠償責任保険 → 請負金（税込 = project_price × 1.1）× 料率
     - 特殊保険 → 工事価格（project_price）× 料率
   - `backend/app/services/qcds_calculator.py` を修正（`a` 変数廃止、各保険料に正しい基準適用）
   - `construction_cost_total` の A 項（直接工事費）計算は引き続き agreed→budget フォールバックを維持
   - フロントエンド `computedFormulaStr` の表示文字列も "直工費 ¥X × Y%" → "工事価格 ¥X × Y%" / "請負金(税込) ¥X × Y%" に更新
   - `backend/app/api/v1/qcds.py` の `_DEFAULT_EXPENSE_ITEMS` 計算式説明文を修正

3. **見積書 明細PATCH/追加/削除時に合計が再計算されないバグ修正**
   - `backend/app/api/v1/quotes.py` の `add_item` / `update_item` / `delete_item` の3エンドポイントがすべて `quote.subtotal/tax_amount/total_amount` を更新していなかった
   - 各エンドポイントにDB flush→全明細集計→`_calc_totals`→`quote_row`更新のパターンを追加
   - 本番デプロイ完了（cmv3-api / cmv3-web 再ビルド・再起動）

### 変更ファイル
- `frontend/src/app/projects/[id]/page.tsx` — QCDS フェッチ URL バグ修正
- `frontend/src/app/projects/[id]/qcds/page.tsx` — computedFormulaStr の保険料基準表示を修正
- `backend/app/services/qcds_calculator.py` — 保険料計算基準修正（工事価格・請負金税込）
- `backend/app/api/v1/qcds.py` — _DEFAULT_EXPENSE_ITEMS 計算式説明文修正
- `backend/app/api/v1/quotes.py` — add_item / update_item / delete_item に合計再計算を追加

### 次のアクション
- ブラウザで https://cmv3.fact-ally.com を開き:
  1. 詳細タブで QCDS ウィジェットが「QCDSデータが未登録です」ではなく値を表示するか確認
  2. QCDS ページで 労災保険が「工事価格 ¥X × Y%」で正しい金額になっているか確認
  3. 見積書ページで明細を追加/編集/削除したとき右側の合計金額が即時更新されるか確認
- 顧客見積の「②」バッジ（2件の見積が存在する）の原因調査: 不要な見積を削除する必要があるか確認
- 見積の大項目別内訳（右パネル）が全て「—」の理由を調査（section_id に明細が正しく紐付いているか）

---

## Session 2026-05-22/23 (バグ修正2件: QCDS印紙/領収書行 + 顧客見積セクション編集)

### 作業内容
1. **QCDS 経費行に印紙代・領収書行を追加（`stamp_cost` / `receipt_cost`）**
   - `backend/app/api/v1/qcds.py` の `_DEFAULT_EXPENSE_ITEMS` に `stamp_cost`（請負に関する契約印紙代）/ `receipt_cost`（売り上げの領収書）を追加
   - `_NEW_STANDARD_KEYS = {"stamp_cost", "receipt_cost"}` を設定し、既存QCDSへの差分追加に対応
   - `_ensure_expense_items` の差分ロジック: expense_items が存在する場合は `_NEW_STANDARD_KEYS` のみ追加、空の場合は全10行を新規作成
   - フロントエンド側は `SYSTEM_CALC_MAP` に stamp_cost/receipt_cost を含めない設計維持 → `amount_override=0` で `hasOverride=true` → 手動入力モード表示（正しい動作）

2. **顧客見積 セクション編集UI追加 + handleAddItem バグ修正**
   - `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` に `Pencil` アイコン import 追加
   - `SectionBlockProps` に `onUpdateSection: (letter: string, name: string) => void` 追加
   - `SectionBlock` コンポーネントに inline editing 状態管理追加（`editing`, `editLetter`, `editName`）
     - Pencil ボタンクリックで編集モード → inputs表示 + 保存/取消ボタン
     - `useEffect` で section prop 変化時に editLetter/editName を同期
   - `handleUpdateSection` 関数追加: `PATCH /api/v1/projects/{id}/quotes/{quote_id}/sections/{section_id}` を呼ぶ
   - `handleAddItem` バグ修正: `section_id: sectionId` → `section_id: sectionId || null`（空文字列→nullに変換し UUID バリデーションエラーを回避）

3. **デプロイ完了**
   - SSH キー: `C:\tmp\new_key.pem`（`private_key.pem` を OpenSSH 形式に変換済み）、ユーザー: `root@116.80.96.175`
   - `docker compose -f docker-compose.prod.yml build cmv3-api cmv3-web` → イメージビルド成功
   - cmv3-api: sha256:f951a52, cmv3-web: sha256:ba24a66 で 05:49 JST 起動確認

### 変更ファイル
- `backend/app/api/v1/qcds.py` — `_DEFAULT_EXPENSE_ITEMS` に stamp_cost/receipt_cost 追加、`_NEW_STANDARD_KEYS` 定義、差分追加ロジック
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — セクション inline 編集 UI 追加、handleAddItem バグ修正

### 次のアクション（来週月曜日にエラーチェック予定）
- QCDS 画面で印紙代・領収書行が表示されているか確認
- 顧客見積で大項目名の編集（鉛筆ボタン）が動作するか確認
- 顧客見積で大項目なし明細への「行を追加」が 422 エラーなく動作するか確認
- スキャン画面の「選択先に転記する」→ QCDS A セクション（取決見通表）に1業者=1行でグロス転記されることをユーザーが確認
- 見積の大項目別内訳（右パネル）が「—」のまま → section_id 紐付き確認（Excelインポート済みデータの移行は別途）

---

## Session 2026-05-25

### 作業内容
1. **[P0] QCDS経費金額ゼロバグ修正**
   - `backend/app/api/v1/qcds.py` の `_ensure_expense_items` 関数で全10行に `amount_override=0` が設定されていたバグを修正
   - 修正: `amount_override=0 if system_key in {"stamp_cost", "receipt_cost"} else None`（自動計算行は None）
   - GET エンドポイントに既存DBの誤設定リセット処理を追加：自動計算行で `amount_override=0` かつ `is_custom=False` のレコードを `None` に更新
   - `from sqlalchemy import ... update` を追加

2. **[P1] 顧客見積大項目金額「—」→合計ゼロ修正**
   - `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` の `subtotal` 計算を API 返却値依存から items ベース計算に変更
   - `const subtotal = (quote?.items ?? []).reduce((s, i) => s + (i.amount ?? 0), 0)` に修正

3. **[P1] 業者見積スキャン転記後UX改善**
   - `frontend/src/app/scan/[job_id]/page.tsx` の `handleApply()` 転記後処理を改修
   - QCDS転記時は「3秒後にQCDSへ移動します」メッセージ表示 + `router.push(\`/projects/${linkedProject.id}/qcds\`)` にリダイレクト
   - QCDS以外の転記（顧客見積など）は従来通り `/scan` に遷移

4. **[P2] QCDSリビジョンタブ実装**
   - `backend/app/api/v1/qcds.py`: GET エンドポイントに `?revision=N` クエリパラメータ追加
   - `backend/app/api/v1/qcds.py`: `POST /projects/{id}/qcds/new-revision` 新規リビジョン作成エンドポイント追加（最新revをコピーして next_rev で新規作成）
   - `frontend/src/app/projects/[id]/qcds/page.tsx`: `viewRevision`, `hasRevision1` state 追加、`applyQcdsData()` ヘルパー抽出、`loadQcds(revision?)` に revision パラメータ追加、`handleSwitchRevision()` 関数実装（revision 1 が存在しない場合はnew-revisionを呼ぶ）
   - タブボタンに `onClick` と `className={viewRevision === 0 ? "tab on" : "tab"}` active 状態を追加

5. **[P2] 注文書重複問題（Excelインポートの誤検出）修正**
   - `backend/app/services/excel_import.py` の `_NON_PROJECT_SHEETS` に `"注文書"`, `"請書"` を追加
   - `_NON_PROJECT_KEYWORDS` タプル追加：「注文書」「請書」「請求書」等を含むシート名を部分一致で除外
   - `_find_sheet()` ヘルパー追加：シート名の表記揺れ（スペース・記号の差異）に対応
   - 案件シートループに部分一致除外ロジック追加

6. **デプロイ完了**
   - 全5ファイル SCP 転送後、`nohup docker compose -f docker-compose.prod.yml up -d --build cmv3-api cmv3-web` 実行
   - `cmv3-api`, `cmv3-web` ともに 2026-05-25 01:06:55 UTC（10:06:55 JST）で再起動確認

### 変更ファイル
- `backend/app/api/v1/qcds.py` — P0バグ修正・GETに既存DB修正処理・revision APIパラメータ・new-revisionエンドポイント
- `backend/app/services/excel_import.py` — 注文書シート誤検出修正（除外リスト強化）
- `frontend/src/app/projects/[id]/qcds/page.tsx` — QCDSリビジョンタブ実装
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — 顧客見積小計の items ベース計算修正
- `frontend/src/app/scan/[job_id]/page.tsx` — 転記後QCDSページへのリダイレクト改善

### 次のアクション
- QCDS画面で経費金額が正しく（自動計算値で）表示されているか確認
- 顧客見積の右パネル「合計」が items の合計値で表示されているか確認
- スキャン転記後に QCDS ページへ正しくリダイレクトされるか確認
- QCDSの「改訂実行予算書下書き」タブをクリックして新リビジョンが作成・切り替わるか確認
- 注文書が1件のみ表示されているか確認（Excelインポートで重複しなくなったか）
- 注文書重複が既存DBに残っている場合は手動削除が必要（管理者で確認）

---

## Session 2026-05-25（続き）

### 作業内容
- QCDS 500エラー修正：`_ensure_expense_items`でasync lazy load が発生していた問題を修正
  - `qcds.expense_items` 関係属性へのアクセスを `db.execute(select(QCDSExpenseItem)...)` に変更
- 日報一覧 500エラー修正：`ReportRead()` で `entries` キーワード引数が重複していた問題を修正
  - `_skip = {"entries", "user_name"}` で dict spread から除外するよう変更
- カンバン 422エラー修正：ルーター登録順序を変更
  - `main.py` で `kanban.router` を `projects.router` より前に登録
- 全3ファイルを VPS にデプロイ・`cmv3-api` を再起動
- 動作確認：`/api/v1/projects/kanban` が 401（認証要求）を返すことを確認（422→401）

### 変更ファイル
- `backend/app/api/v1/qcds.py` — `_ensure_expense_items` lazy load修正
- `backend/app/api/v1/daily_reports.py` — `entries` 重複kwarg修正
- `backend/app/main.py` — kanban router を projects router より前に移動

### 次のアクション
- QCDS「改訂実行予算書下書き」タブ・「実行予算書（簡易版）確定」タブが正常に動作するか確認
- 日報一覧ページ（/daily-report）が正常に表示されるか確認
- カンバンページ（/kanban）が正常に表示されるか確認

---

## Session 2026-05-26

### 作業内容
- **スキャン一括転記バグ修正**（前セッションからの継続）
  - `frontend/src/app/scan/page.tsx`: `handleBulkTransfer` の status フィルタを `"reviewed"` のみ → `"reviewed" || "succeeded"` に変更
  - `succeeded`（レビュー待ち）ジョブは転記前に自動 `POST /scan/results/{id}/confirm` を呼び出して `reviewed` に昇格
  - `BulkTransferModal` に「レビュー待ちジョブは転記時に自動確認済みになる」旨の注記追加
  - cmv3-web rebuild 完了・デプロイ済み

- **QCDS 経費率修正**（デフォルト値の正規化）
  - `backend/app/models/qcds.py`: `site_staff_salary_rate` 0.03→0.035, `shared_overhead_rate` 0.03→0.05, `general_admin_rate` 0.02→0.035
  - `backend/app/schemas/qcds.py`: 同上
  - `frontend/src/app/projects/[id]/qcds/page.tsx`: 初期 header state を新率に更新
  - ※既存 DB レコードは変更なし（新規作成 QCDS にのみ新デフォルト適用）

- **印紙代・領収書 自動計算実装**
  - `backend/app/models/master.py`: `StampTaxTable` に `table_type` カラム追加（contract/receipt）
  - `backend/alembic/versions/h2i3j4k5l6m7_stamp_tax_table_type.py`: 新規マイグレーション
    - `table_type` カラム追加 + インデックス
    - 第2号文書（契約印紙 11行）・第17号文書（領収書 19行）シードデータ挿入
  - `backend/app/services/qcds_calculator.py`:
    - `QCDSCalcResult` に `stamp_cost` / `receipt_cost` フィールド追加
    - `calculate_qcds()` 引数に `stamp_cost`, `receipt_cost` 追加
    - `site_overhead_total` の計算式にこれらを含める
    - `_SYSTEM_FIELDS` に `stamp_cost` / `receipt_cost` 追加（上書き可）
  - `backend/app/api/v1/qcds.py`:
    - `_lookup_stamp_tax()` 非同期ヘルパー追加（税込金額→DBルックアップ）
    - `_build_response()` に stamp/receipt 引数追加
    - 3エンドポイント（GET/PUT/POST）すべてで stamp tax lookup を実行してレスポンスに反映
    - `_ensure_expense_items()` から `_MANUAL_KEYS` 削除 → stamp_cost/receipt_cost も `amount_override=None`（自動計算）に変更
    - 既存レコードのクリーンアップで stamp_cost/receipt_cost も auto_keys に含める
  - `backend/app/schemas/qcds.py`: `QCDSCalcFields` に `stamp_cost` / `receipt_cost` 追加
  - `frontend/src/types/qcds.ts`: `QCDSCalcFields` 型に追加
  - `frontend/src/app/projects/[id]/qcds/page.tsx`:
    - `SYSTEM_CALC_MAP` に `stamp_cost` / `receipt_cost` エントリ追加
    - `computedFormulaStr()` に stamp/receipt ケース追加（税込金額→文書種別の表示）
  - migration `h2i3j4k5l6m7` 適用済み (head)

### 変更ファイル
- `backend/app/models/master.py`
- `backend/app/models/qcds.py`
- `backend/app/schemas/qcds.py`
- `backend/app/services/qcds_calculator.py`
- `backend/app/api/v1/qcds.py`
- `backend/alembic/versions/h2i3j4k5l6m7_stamp_tax_table_type.py`（新規）
- `frontend/src/app/scan/page.tsx`
- `frontend/src/app/projects/[id]/qcds/page.tsx`
- `frontend/src/types/qcds.ts`

### 次のアクション
- ビルド完了後に QCDS ページを開いて印紙代・領収書の自動計算が表示されることを確認
- 既存案件の stamp_cost / receipt_cost が 0 → 自動計算（None）にリセットされることを確認（GET で自動修正）
- 既存 QCDS レコードの経費率（給与率・共通経費・一般管理費）を新しい値に一括更新したい場合は個別に SQL UPDATE 実行

---

## Session 2026-05-26 — Excelインポート 削除済み案件 UX

### 作業内容
- **削除済み案件の検出とユーザー選択UIを実装**
  - 前回セッションの残タスク（backend実行ロジック未実装 + frontend未対応）を完了
  - **backend `excel_import.py`** confirm_import 実行ロジックを全面整理:
    - 削除済み案件（`deleted_at is not None`）を検出した場合、`conf.deleted_action` に応じて分岐
    - `"restore"`: `deleted_at = None`にリセットして復元 + 関連レコード作成
    - `"new"`: 削除済みを無視して完全新規案件を作成（番号は `generate_project_number()` で自動採番→重複回避）
    - アクティブ案件の 上書き / スキップ も分離した条件節で整理（可読性向上）
  - **frontend `admin/import/page.tsx`**:
    - `Conflict` 型に `"deleted_exists"` 追加、`DeletedAction = "new" | "restore"` 型追加
    - `PreviewRow` に `deleted_existing_id: string | null` 追加
    - `CONFLICT_BADGE` に `deleted_exists` バッジ追加（赤色「削除済み案件あり」）
    - `deletedActionMap` state 追加（row_index → `DeletedAction`）
    - `handlePreview`: `deleted_exists` 行は `deletedActionMap` を `"new"` で初期化、`overwriteMap` は `false` で初期化
    - `handleImport`: リクエストに `deleted_action` フィールドを追加（`deleted_exists` 行は map 参照、それ以外は `"new"` 固定）
    - テーブル「処理」列: `deleted_exists` 行は「新規作成 / 復元」ラジオを表示（従来の「上書き / スキップ」と分岐）
    - `reset()` で `deletedActionMap` もクリア

### 変更ファイル
- `backend/app/api/v1/excel_import.py` — confirm_import 実行ロジック + deleted_action 分岐
- `frontend/src/app/admin/import/page.tsx` — deleted_exists UX 追加

### デプロイ
- `excel_import.py` → `docker cp` で cmv3-api コンテナに反映 + cmv3-api 再起動
- `page.tsx` → SCP → `cmv3-web` 再ビルド（no-cache）→ `docker compose up -d` 完了

### 次のアクション
- Excelインポート画面で削除済み案件を含むExcelをアップロードし「削除済み案件あり」バッジと新規作成/復元ラジオが表示されることを確認
- 「新規作成」選択時: 自動採番された新しい案件番号で作成されること、元の削除済みレコードは変更されないことを確認
- 「復元」選択時: 削除済み案件が復活して Excel 内容で更新されることを確認

---

## Session 2026-05-26

### 作業内容
- 業者見積スキャン→業者見積転記バグ修正：`apply_scan_result`で`QuoteItem`に`version_id`が未設定のため業者見積ページに転記結果が表示されなかった。転記時に`QuoteVersion`を自動作成して`version_id`を設定するよう修正
- 顧客見積リスト：行全体クリックで詳細ページに遷移するよう修正（「開く」ボタン不要）
- 顧客見積詳細：小計と大項目別内訳の合計が一致しないバグ修正。`version_id`が設定されたアイテム（業者見積スキャン転記分）を顧客見積の集計から除外
- アクセストークン有効期限を15分→480分（8時間）に変更して401エラーを解消

### 変更ファイル
- `backend/app/api/v1/scan.py` — apply_scan_result: quote転記時に QuoteVersion 自動作成 + version_id 設定
- `frontend/src/app/projects/[id]/quote/page.tsx` — 行クリックで遷移、「開く」ボタン廃止
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — version_id ありアイテムを顧客見積集計から除外
- `backend/app/core/config.py` — jwt_access_token_expire_minutes: 15 → 480

### 次のアクション
- 業者マスタ選択削除機能の追加（要望あり・未着手）
- 顧客見積の401エラーは既存の業者見積転記済みアイテム（version_id=NULL）が残っている可能性あり。必要に応じてDBの既存データをクリーンアップ

---

## Session 2026-05-27

### 作業内容

**バグ修正 ①：TypeScript ビルドエラー**
- `frontend/src/types/scan.ts` の `TransferTarget` 型に `"vendor-estimate"` が未定義でビルド失敗していた
- `"vendor-estimate"` をユニオン型に追加して解消

**バグ修正 ②：顧客見積チェックボックス常時表示 + 一括選択改善**
- 旧：selectMode トグルボタンがあり、ONにしないとチェックボックスが表示されない
- 新：チェックボックスを常時表示。大項目ヘッダーのチェックでそのセクション全行選択
- 「大項目未割り当て」ブロックにも全選択チェックボックスを追加
- アクション欄：選択数 > 0 のときだけ「N件選択中 | 解除 | 削除(N)」バーを表示

**バグ修正 ③：業者見積取り込み後に粗利率100%になる問題**
- 原因：`scan.py` の個別転記・一括転記どちらも `QuoteItem.cost_price` を未設定（NULL）のまま作成していた
  - NULL → 原価0扱い → 粗利率100% になっていた
- 修正：個別転記・一括転記の両方で `cost_price=item.unit_price` を設定
- フロント側も `handleImportFromEstimate` で `costPrice = vi.cost_price ?? vi.unit_price` に変更

**バグ修正 ④：一括転記（bulk-apply）500エラー**
- 原因：同一業者名が DB に重複登録されており、`scalar_one_or_none()` が `MultipleResultsFound` 例外を発生させていた
- 修正①：`scalar_one_or_none()` → `scalars().first()` に変更（既存重複に対して耐性を持たせる）
- 修正②：同一リクエスト内での重複作成を防ぐリクエストレベルキャッシュ `_vendor_name_cache: dict[str, uuid.UUID]` を追加
- 修正③：DB 上の重複業者 6 件を直接削除してクリーンアップ

**新機能 ①：vendors.vendor_name に UNIQUE 制約追加**
- Alembicマイグレーション `i3j4k5l6m7n8_vendor_name_unique.py` 作成
- `uq_vendors_vendor_name` 制約を追加してDB レベルで重複を防止
- VPS 上でコンテナ再ビルド → `alembic upgrade head` 実施

**バグ修正 ⑤：QCDS タブの 404 コンソールエラー**
- 原因：フロントが QCDS データ取得後に「revision=1 が存在するか」を別途 HTTP リクエストで確認していた（不要な追加リクエスト）
- 修正：`setHasRevision1(data.revision >= 1)` に変更し、余分なリクエストを削除

**バグ修正 ⑥：出面タブの 500 エラー**
- 原因：`attendance.py` の Raw SQL が `v.name` カラムを参照していたが、実際のカラム名は `v.vendor_name`
- 修正：`attendance.py` の3箇所（SELECT列・GROUP BY・Python側）で `v.name` → `v.vendor_name` に修正

**新機能 ②：顧客見積の値引き金額を編集可能に**
- 旧：値引き行は表示のみ（編集不可）
- 新：値引き行をクリックするとインライン編集モードに切り替わり、PATCH API で保存
- 値引き = 0 のときは「＋ 値引を追加」と表示してクリックで編集開始

**設計レビュー：FINAL_DESIGN_V3.md**
- ひささんが Opus と共同で作成した設計書（Phase 1-A/1-B/1-C）を通読・問題点を 6 つ抽出
- ひささんが全 6 点に決断回答：
  1. 粗利率計算 → QCDS の `total_cost` を原価とする
  2. `display_order` カラムは追加しない、既存 `row_no` を表示順に統一
  3. PDF フォント → Noto CJK JP（Noto Serif / Noto Sans）で確定
  4. ダッシュボード通知 → Phase 1 はオンデマンド計算（Celery 不要）
  5. orders テーブル → VS Code Claude に確認させる（存在すれば ALTER、なければ CREATE）
  6. 業者見積→顧客見積の連動ロジック → **全面置き換え**（修正ループを断ち切る）

**重要制約の確定**
- 「業者見積→顧客見積の連動について、これ以上の修正をしないでください」と明示指示
  - 根本設計が変わるため、中途半端な修正は禁止

### 変更ファイル
- `frontend/src/types/scan.ts` — TransferTarget に `"vendor-estimate"` 追加
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — チェックボックス常時表示・値引き編集
- `backend/app/api/v1/scan.py` — cost_price=item.unit_price 設定、scalars().first()、vendor キャッシュ
- `backend/app/api/v1/attendance.py` — v.name → v.vendor_name（3箇所）
- `frontend/src/app/projects/[id]/qcds/page.tsx` — revision=1 確認の余分リクエスト削除
- `backend/alembic/versions/i3j4k5l6m7n8_vendor_name_unique.py` — vendors.vendor_name UNIQUE 制約

### 次のアクション
- FINAL_DESIGN_V3.md に基づく Phase 1-A 実装開始
  - DB マイグレーション（source_type, acknowledgement_status, payment_schedules）
  - 掛率バグ修正（版ごとに独立、品目レベル優先）
  - スキャン転記 UI 全面置き換え（QCDS 1行 / 業者見積として保存 の 2 択）
  - 粗利率計算を QCDS ベースに変更

---

## Session 2026-05-28

### 作業内容
- `orders`テーブル存在確認→`acknowledgement_status`カラムは未存在と確認
- Alembicマイグレーション `j4k5l6m7n8o9_phase1a_schema.py` 作成・適用：
  - `quote_items.source_type VARCHAR(20) DEFAULT 'manual'` 追加
  - `orders.acknowledgement_status VARCHAR(20) DEFAULT 'none'` 追加
  - `payment_schedules` テーブル新規作成
- 掛率バグ修正（estimate/page.tsx）：`defaultValue` → controlled `value` + `markupInput` state
  - 版切り替え時に前の版の掛率が残り誤って保存される問題を解消
- スキャン転記UI全面置き換え（scan/[job_id]/page.tsx）：
  - 旧：多重チェックボックス式（QCDS/業者見積/業者マスタを同時選択して一括転記）
  - 新：「QCDSに転記」ボタン（業者名＋合計1行） / 「業者見積として保存」ボタン の2択
  - 顧客見積への自動転記を完全削除（設計書の指示通り）
- 新APIエンドポイント追加（backend/app/api/v1/scan.py）：
  - `POST /api/v1/scan/results/{result_id}/transfer-to-qcds`：合計1行でQCDSに追加
  - `POST /api/v1/scan/results/{result_id}/save-as-version`：業者見積版として保存
- 粗利率計算ロジック修正（quote/[quote_id]/page.tsx）：
  - 旧：`quote_items.cost_price` ベース（常に100%になるバグ）
  - 新：`QCDS.calc.total_cost` ベース。QCDS未作成時は「QCDSを作成してください」表示
- VPSデプロイ完了（cmv3-api, cmv3-web 再ビルド・再起動）

### 変更ファイル
- `backend/alembic/versions/j4k5l6m7n8o9_phase1a_schema.py` — 新規マイグレーション
- `backend/app/api/v1/scan.py` — 新エンドポイント2本追加 (transfer-to-qcds, save-as-version)
- `frontend/src/app/projects/[id]/estimate/page.tsx` — 掛率入力をcontrolled化（markupInput state追加）
- `frontend/src/app/scan/[job_id]/page.tsx` — 転記UI全面置き換え（2ボタン式）
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — 粗利率をQCDSベースに変更

### 次のアクション
- Phase 1-B: PDF出力実装（WeasyPrint + Noto CJK JP）
  - Docker に fonts-noto-cjk パッケージインストール
  - 見積書・請求書・注文書・注文請書の HTML テンプレート作成
- Phase 1-C: ロール実装（admin/staff/legacy/accounting）、請求書管理、入金アラーム
- 顧客見積の大項目順序変更機能（PATCH /api/v1/quotes/{quote_id}/sections/reorder）
- 動作確認チェックリスト（FINAL_DESIGN_V3.md §8 Phase 1-A）を実機確認

---

## Session 2026-05-28（続き）— Phase 1-A' 実装

### 作業内容

**設計書読み込み**
- `ADDITIONAL_CHANGES_V1.md` と `FINAL_DESIGN_V3.md` を照合・把握
- サンプルPDF 3種（見積・注文書・請求書）をPhase 1-B用に確認登録
- admin1234 はローカルパスワードのため問題なしと確認

**Phase 1-A' Day 1-2: スキャン機能を業者見積タブに統合**
- AppShell サイドバーから「業者見積スキャン」メニューを削除
- `estimate/page.tsx` に「スキャン」「転記」ボタンをヘッダーに追加
  - スキャンボタン: PDF/画像/ExcelをアップロードしてGemini解析→版を自動作成
  - ポーリングuseEffect: 2.5秒おきにジョブステータスを確認→成功時 save-as-version を呼ぶ
- 各版カードに「QCDSに反映」「顧客見積に反映」ボタンを追加

**Phase 1-A' Day 3: QCDSに反映**
- カテゴリー選択ダイアログ（外注業者/資材業者/その他）
- 新API `POST /api/v1/projects/{project_id}/qcds/reflect-from-version`
  - 版の合計金額を QCDSDirectWork に 1 行追加（category 列あり）

**Phase 1-A' Day 4: 顧客見積に反映**
- 掛率 + 大項目選択ダイアログ（新規作成 or 既存選択）
- 新API `POST /api/v1/projects/{project_id}/quotes/{quote_id}/reflect-from-version`
  - 掛率適用済みの販売単価で品目をコピー（業者見積との連動なし、独立コピー）

**Phase 1-A' Day 5: 業者マスタから転記**
- 業者検索+過去案件選択ダイアログ
- 新API `POST /api/v1/projects/{project_id}/quote-versions/create-from-vendor`
  - 指定業者×指定案件の版をコピーして新版を作成

**Phase 1-A' Day 6: ユーザーロール拡張**
- `backend/app/models/enums.py`: staff / legacy / accounting を UserRole に追加（member は後方互換として残す）
- Alembic: PostgreSQL ENUM への値追加は DDL のためトランザクションを分離して実行
- `users.role` デフォルト値: member → staff
- フロントエンド `types/auth.ts`: UserRole 型に 4 種追加
- `admin/users/page.tsx`: ロール選択肢を 4 つに変更（管理者/現場・営業/Excel専用/経理担当）

**VPS デプロイ**
- cmv3-api, cmv3-web 再ビルド + 再起動 → 正常起動確認

### 変更ファイル
- `frontend/src/components/layout/AppShell.tsx` — スキャンメニュー削除
- `frontend/src/app/projects/[id]/estimate/page.tsx` — スキャン統合・反映ボタン・ダイアログ全追加
- `frontend/src/app/admin/users/page.tsx` — ロール選択肢更新
- `frontend/src/types/auth.ts` — UserRole 型拡張
- `backend/app/api/v1/quotes.py` — 3本のAPIエンドポイント追加（QCDS反映・顧客見積反映・業者マスタ転記）
- `backend/app/models/enums.py` — UserRole に staff/legacy/accounting/member を追加
- `backend/app/models/user.py` — デフォルトロール: member → staff
- `backend/app/schemas/user.py` — デフォルトロール: member → staff
- `backend/alembic/versions/k5l6m7n8o9p0_extend_user_roles.py` — 新規マイグレーション

### 次のアクション
- Phase 1-B: PDF出力（WeasyPrint + Noto CJK JP）
  - Docker に fonts-noto-cjk インストール
  - sample見積.pdf / sample注文書・注文請書.pdf / sample請求書.pdf のレイアウトを確認・再現
  - 見積書・注文書・注文請書・請求書の HTML テンプレート作成
- 業者見積タブの動作確認（スキャン→版作成→QCDS反映→顧客見積反映）

---

## Session 2026-05-28（続き2）— バグ修正ループ

### 問題点と解決

**問題①: save-as-version 500エラー（スキャン後に版が作成されない）**
- 原因: `QuoteItem` SQLAlchemy モデルに `source_type` カラムが `mapped_column` として未定義
  - DB マイグレーションでカラムは追加済みだったが、モデル定義が抜けていた
- 解決: `backend/app/models/quote.py` に `source_type: Mapped[str | None]` を追加
- 結果: スキャン後の版作成が正常動作

**問題②: スキャン中のポーリングが500エラー後に止まらない**
- 原因: 500エラー時に `clearInterval` は呼ばれていたが、`setScanning(false)` が呼ばれず「解析中…」表示が永続
- 解決: `save-as-version` の呼び出しを try-catch で囲み、失敗時も `setScanning(false)` を実行

**問題③: 業者マスタに反映されない**
- 原因: `save-as-version` エンドポイントに業者マスタ自動登録処理がなかった
- 解決: `scan.py` の `save-as-version` に Vendor/VendorPriceHistory 自動登録処理を追加

**問題④: QCDS「工事価格（顧客）」が未設定**
- 原因: `project.project_price` が NULL のため、QCDS バックエンド計算と UI 表示の両方が 0/未設定
- 解決1（バックエンド）: QCDS GET/PUT エンドポイントで `project_price = 0` の場合、顧客見積 `subtotal` をフォールバックとして使用
- 解決2（フロントエンド）: QCDS ページ・案件詳細ページで `project_price = null` の場合、顧客見積 subtotal を表示
- 結果: 顧客見積が入力されていれば工事価格と経費が正しく計算される

**問題⑤: 経費（労災保険料など）が 0 になる**
- 原因: 問題④と同じ。`project_price = 0` で全レートベース計算が 0
- 解決: 問題④と同じ修正で解消

**問題⑥: QCDSに反映ボタンの 500 エラー（MultipleResultsFound）**
- 原因: `select(QCDS).where(project_id).scalar_one_or_none()` が複数リビジョンで失敗
- 解決: `.order_by(QCDS.revision.desc()).limit(1)` を追加（GET・版削除の両方）

**問題⑦: QCDS 直接工事に行が表示されない（row_no > 30）**
- 原因: `applyQcdsData` が `Array.from({ length: 30 })` で固定されており、row_no 31以上が表示外
- 解決: `Math.max(30, ...data.direct_works.map(dw => dw.row_no))` で動的配列長に変更

**問題⑧: QCDS 直接工事の category が NULL で行が表示されない**
- 原因: `transfer_to_qcds` エンドポイントが `category` を未設定で行追加していた
- 解決1: `scan.py` の `transfer_to_qcds` に `category=QCDSCategory.subcontract` を追加
- 解決2: DB の NULL category 行 112件を `subcontract` に一括 UPDATE
- 解決3: フロント `getColIndices` で category=null の行も subcontract 列に表示

**問題⑨: 削除後も旧行が表示される（calc が古いまま）**
- 原因: `handleBulkDelete` / `handleDeleteWork` でローカル state は更新していたが、`calc` フィールドが API レスポンス固定値のまま
- 解決: 削除後に `loadQcds()` を呼んで `calc` も含め全体を再取得

**問題⑩: Rev.2 に旧スキャン行が残って「復帰」**
- 原因: `改訂実行予算書` 作成時に Rev.1 の全行をコピーする仕様。ユーザーが削除した行は Rev.1 または表示上のものだったため、Rev.2 にはコピー済みの旧行が存在していた
- 解決: DB で Rev.2 の row_no 25-31（旧スキャン行）を直接 DELETE、正しい「QCDSに反映」行（row_no 32）のみ残存

**問題⑪: D&D スキャンが版がある状態では使えない**
- 原因: D&D ゾーンが `!selectedVersion` のときだけ右パネルに表示されていた
- 解決: ドキュメントレベルの dragenter/drop イベントリスナーを useEffect で登録し、ページ全体にフルスクリーンオーバーレイを表示

### 変更ファイル（session_log 2026-05-28 続き）
- `backend/app/models/quote.py` — source_type Mapped 追加
- `backend/app/api/v1/scan.py` — save-as-version 業者マスタ登録追加, transfer-to-qcds に category 追加
- `backend/app/api/v1/qcds.py` — project_price フォールバック追加（GET/PUT）, delete_direct_work エンドポイント追加
- `backend/app/api/v1/quotes.py` — QCDS select に order_by+limit 追加
- `frontend/src/app/projects/[id]/qcds/page.tsx` — maxRow 動的化, category=null 行表示, チェックボックス一括削除, 削除後 loadQcds
- `frontend/src/app/projects/[id]/estimate/page.tsx` — ページ全体 D&D オーバーレイ, 複数ファイル対応
- `frontend/src/app/projects/[id]/page.tsx` — 工事価格に顧客見積 subtotal フォールバック

### 現在の状態
- Rev.2 は row_no 32「せいいばん舎（有）¥1,870,550」1行のみ
- 経費計算は `project_price = NULL` の場合、顧客見積 subtotal（¥2,349,188）を使用して計算される
- QCDS直接工事行 category=NULL だった112件は全て `subcontract` に更新済み

### 次のアクション
- 顧客見積の `subtotal` が変わった際に QCDS の計算も自動更新されるか確認
- Phase 1-B（PDF出力）の実装
- session_log にこのセッションの続きを追記済み

---

## Session 2026-05-29 — QCDS create_new_revision バグ修正・タブ切り替えバグ修正

### 作業内容
1. **[P0] create_new_revision に project_price フォールバック追加**
   - 前セッションの未完修正を継続
   - `backend/app/api/v1/qcds.py` の `create_new_revision` エンドポイント2箇所（既存リビジョン返却時 / 新規作成後）に Quote subtotal フォールバックを追加（GET/PUT と同一パターン）
   - これにより `project.project_price = NULL` の案件でも改訂版の経費計算が正しく行われる

2. **[P1] テストデータ Rev.3-9 を DB から削除**
   - 前セッションのデバッグ中に誤作成された 26-1-001 の Rev.3-9（7件）を全削除
   - 残存: Rev.0（31行・元データ）/ Rev.1（31行・Rev.0コピー）/ Rev.2（1行・スキャン結果）

3. **[P1] QCDSタブ切り替えバグ修正（latestRevision 追跡）**
   - 旧: `handleSwitchRevision(1)` が常に Rev.1 を読み込む設計 → Rev.2 が最新でも Rev.1 が表示
   - 新: `latestRevision` state を追加し、初回ロード時に最新改訂番号を記録
   - 改訂タブ押下時に `loadQcds(latestRevision)` を呼ぶことで最新改訂版が正しく表示される
   - `hasRevision1` → `hasRevision` にリネーム
   - 確定タブ押下時も `loadQcds(0)` を直接呼ぶよう変更（`handleSwitchRevision(0)` 不要になったため）

### 変更ファイル
- `backend/app/api/v1/qcds.py` — create_new_revision に project_price フォールバック2箇所追加
- `frontend/src/app/projects/[id]/qcds/page.tsx` — latestRevision state 追加・タブ切り替えロジック修正

### デプロイ
- `qcds.py`: docker cp → cmv3-api 再起動
- `qcds/page.tsx`: SCP → cmv3-web 再ビルド・再起動

### 次のアクション
- QCDS ページで「改訂実行予算書」タブを押したとき Rev.2 が正しく表示されることを確認
- 「確定」→「改訂」→「確定」のタブ切り替えで経費金額が正しく計算されていることを確認
- Phase 1-B: PDF出力（WeasyPrint + Noto CJK JP）の実装

---

## Session 2026-05-29（続き）— QCDS タブ廃止・業者見積 D&D 修正

### 問題の整理
1. **Rev.n 無限増加バグ**: `loadQcds(0)` が `hasRevision=false` にリセットしてしまい、タブ切り替えのたびに `create_new_revision` が呼ばれていた
2. **QCDS タブが不要**: 「改訂実行予算書」vs「確定」の 2 タブ設計はユーザーに理解しにくく不要
3. **業者見積 D&D が機能しない**: 版が存在するとき右パネルに D&D ゾーンがなく、グローバルオーバーレイも `pointerEvents:none` で実質無効だった

### 作業内容
1. **DB クリーンアップ**: 26-1-001 の Rev.1-8 をすべて削除（外部キー含む）。Rev.0（31 行・元データ）のみ残存
2. **QCDS タブ完全廃止**
   - `hasRevision`, `latestRevision` state 削除
   - `handleSwitchRevision` 関数削除
   - タブボタン div を「QCDS 原価算定表」シンプルタイトルに置き換え
   - `loadQcds` の `setHasRevision`/`setLatestRevision` 更新ロジック削除
3. **業者見積 D&D 修正（V2 デザイン準拠）**
   - `document.addEventListener` グローバル D&D リスナーを削除
   - ページ全体オーバーレイを削除
   - **左パネル下部に常設 D&D ゾーン追加**（版の有無に関わらず常時表示）
   - スキャン進捗を右パネル上部に常時表示（`selectedVersion` の有無によらず）
   - 右パネルの空状態をシンプルな「版を選択してください」メッセージに変更
   - `dropZoneRef` 未使用変数を削除

### 変更ファイル
- `frontend/src/app/projects/[id]/qcds/page.tsx` — タブ廃止・state 整理
- `frontend/src/app/projects/[id]/estimate/page.tsx` — D&D 再設計（左パネル常設ゾーン）

### デプロイ
- SCP 転送 → cmv3-web 再ビルド・再起動

### 次のアクション
- QCDS ページが正常にシングル表示されることをブラウザで確認
- 業者見積で版がある状態でも PDF D&D が動作することを確認
- Phase 1-B: PDF 出力（WeasyPrint + Noto CJK JP）の実装

---

## Session 2026-05-29 — 設計方針変更（QCDS・業者見積）の記録

### 変更の経緯

FINAL_DESIGN_V3.md（2026-05-27）と ADDITIONAL_CHANGES_V1.md（2026-05-28）に基づいて
Phase 1-A' の実装を進めていたが、ユーザー（ひささん）からの直接フィードバックにより
以下の設計変更を行った。

### 変更内容

#### 業者見積ページの設計変更（2026-05-29）

**旧設計（廃止）:**
- 「転記」ボタン → 業者マスタの過去案件から版をコピー（案件選択式）
- グローバル D&D オーバーレイ（版がある状態では D&D 不可）
- 「+」ボタン → 業者名検索のみのフォーム

**新設計（実装済み）:**
- 「転記」ボタン → 廃止
- D&D ゾーン → ヘッダー直下に常設（版の有無に関わらず常時表示）
- 「+」ボタン → 2択:
  1. **「業者マスタから追加」**: 業者検索 → 過去単価履歴（VendorPriceHistory）を自動読込 → 版に明細として反映
  2. **「手動で作成」**: 業者名自由入力 → 空の版を作成
- ヘッダーを大型化（転記▾ 廃止、+スキャンボタンを全幅に変更）

**理由:**
- 旧「転記」は「どの案件から？」の質問がユーザーに不明瞭
- 業者マスタに過去単価履歴があるのだから、それを直接取込む方が合理的
- D&D が版選択中に使えない問題を解消

#### QCDS タブ設計変更（2026-05-29）

**旧設計（廃止）:**
- 「実行予算書（簡易版）確定」と「改訂実行予算書」の2タブ切り替え
- タブ切り替えのたびに `create_new_revision` が呼ばれ Rev.n が増え続けるバグ

**新設計（実装済み）:**
- タブ廃止 → 単一QCDS表示（常に最新リビジョンを表示）
- QCDS リビジョン機能はバックエンド側に残すが UI から非表示

**理由:**
- 「改訂」vs「確定」のタブ概念がユーザーに理解しにくい
- スキャン→QCDSに反映は常に最新リビジョンに行われるため、タブ切り替えは不要
- バグ（Rev.n増加）の根本解決として設計簡略化を選択

### 現在の実装状態（2026-05-29 時点）

- Phase 1-A: 完了（掛率修正・スキャン転記2択・粗利率QCDSベース）
- Phase 1-A': 完了（業者見積タブ新設計・QCDS タブ廃止）
- Phase 1-B: **未着手**（PDF出力 WeasyPrint）← 次の作業
- Phase 1-C: 未着手（権限ロール・請求管理・入金アラーム）

### 次のアクション

- ① 承認機能の修正（権限ロール紐付け含む） ← 提案承認後に着手
- ③ PDF 出力実装（WeasyPrint + Noto CJK JP）← 並行着手予定

---

## Session 2026-05-29（引き継ぎ）— コンテキスト切れ後の継続実装

### 経緯
前セッションが 1M コンテキスト制限に到達。session_log とメモリを参照して引き継ぎ。
前セッションで中断されていた4点の実装を完了させた。

### 作業内容

1. **`manager`（上長）ロール追加の完了**
   - `enums.py` への追加と Alembic マイグレーション `l6m7n8o9p0q1` は前セッションで作成済みだった
   - `frontend/src/app/admin/users/page.tsx`: `ROLE_LABEL` / `ROLE_STYLE` / 選択肢に `manager`（上長）追加

2. **自社情報設定機能の完了（④）**
   - `backend/app/schemas/company_settings.py`: `CompanySettingsRead` / `CompanySettingsUpdate` スキーマ
   - `backend/app/api/v1/company_settings.py`: GET（全認証済みユーザー）/ PATCH（admin/super_admin のみ）
   - `backend/app/main.py`: `company_settings` ルーター追加
   - `frontend/src/app/admin/company/page.tsx`: 自社情報設定ページ（基本情報・住所・税務・振込先・帳票設定）
   - `frontend/src/components/layout/AppShell.tsx`: サイドバー「設定」セクションに「自社情報設定」ナビ追加

3. **デプロイ**
   - Alembic マイグレーション `l6m7n8o9p0q1` は既に VPS 適用済みを確認（前セッションで完了）
   - バックエンド・フロントエンド全ファイルを SCP 転送
   - cmv3-web `✓ Compiled successfully` でビルド成功・再起動完了

### 変更ファイル
- `backend/app/schemas/company_settings.py` — 新規作成
- `backend/app/api/v1/company_settings.py` — 新規作成
- `backend/app/main.py` — company_settings ルーター追加
- `frontend/src/app/admin/company/page.tsx` — 新規作成
- `frontend/src/app/admin/users/page.tsx` — manager ロール追加
- `frontend/src/components/layout/AppShell.tsx` — 自社情報設定ナビ追加

### 次のアクション
- https://cmv3.fact-ally.com/admin/company で自社情報設定ページが表示されることを確認
- 保存ボタンで情報が更新されることを確認
- ③ 承認印のサンプルと同じ位置固定 + 承認済みが適用されるロジック修正（Phase 1-B PDF 前に対応予定）
- Phase 1-B: PDF 出力（WeasyPrint + Noto CJK JP）の実装

---

## Session 2026-05-29（バグ修正）

### 作業内容
1. **権限選択肢の()書き削除** — `admin/users/page.tsx` の `<option>` から説明文（社長・管理者など）を削除。シンプルに「管理者」「上長」「現場・営業」「Excel専用」「経理担当」に統一
2. **自社情報 404 修正** — `company_settings.py` モデルの import エラー（`Base` を `app.models.base` から探していた → 正しくは `app.core.database`）を修正してコンテナ再ビルド。現在は `GET /api/v1/company-settings` が 401（認証要求）を返すことで動作確認済み
3. **サイドバー会社名の動的更新** — `AppShell.tsx` に `useEffect` で `/api/v1/company-settings` をフェッチし `companyName` state 管理追加。ロゴマーク `CL` も会社名先頭2文字から自動生成（「株式会社」等の記号を除いて抽出）
4. **承認スタンプ UX 改善**:
   - `canStamp=false` のとき `if (!canStamp) return` (無反応) → showMsg で「〇〇押印には管理者の権限が必要です」メッセージ表示に変更
   - 権限なしスタンプの内側テキストを `"—"` → `"管理者"` 等のロール名表示に変更（`requiredRole` フィールド追加）
   - 丸枠を `borderStyle: dashed` で視覚的に区別
   - ドロップダウンが `stampUsers` 空のとき「ユーザー読込中...」を表示（空ドロップダウンで「何も起きない」に見えていた問題を解消）
   - ドロップダウンの位置を `left:0` → `left:50%; transform:translateX(-50%)` に変更（センタリング）

### 変更ファイル
- `frontend/src/app/admin/users/page.tsx` — 選択肢ラベルの説明文削除
- `frontend/src/components/layout/AppShell.tsx` — 会社名動的取得・ロゴマーク自動生成
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — 承認スタンプ UX 全面改善

### 次のアクション
- サイドバーの会社名が実際の DB 設定値に変わることを確認
- 承認スタンプで管理者権限のユーザーにてドロップダウンが表示されることを確認
  - `/admin/users` で自アカウントのロールが `admin` または `super_admin` であることを確認
- Phase 1-B: PDF 出力（WeasyPrint + Noto CJK JP）の実装

---

## Session 2026-05-29（自社情報・ロゴ改善）

### 動作確認結果（ひささんより）
- 自社情報設定ページ: 表示・保存ともに動作確認済み ✅（会社名変更は別ページに遷移後に反映 → 即時反映に修正）
- 承認スタンプ: 管理者権限でスタンプ成功 ✅
- ユーザー管理ロール名: 変更確認済み ✅

### 確認Q&A
- Q: ユーザー管理は管理者と社長だけが使える機能か？ → A: はい、`admin` / `super_admin` のみ
- Q: 作成したユーザーはそのメール・パスワードでログインできるか？ → A: はい、Argon2idハッシュで保存され即ログイン可能

### 修正内容
1. **ロゴマークを英語会社名の頭2文字に変更** — `companyNameEn.trim().slice(0, 2).toUpperCase()` を優先表示（英語名未設定時は日本語名から抽出）
2. **保存後の即時反映** — `localStorage`（`cmv3_company_name`, `cmv3_company_name_en`）に会社名をキャッシュ + `window.dispatchEvent("companySettingsUpdated")` でAppShellを即時更新
3. **AppShell の初期表示改善** — ページ読み込み時に localStorage から会社名を読んで初期表示（APIレスポンス前にも正しい会社名を表示）

### 変更ファイル
- `frontend/src/components/layout/AppShell.tsx` — companyNameEn state 追加・localStorage キャッシュ・カスタムイベントリスナー・ロゴ英語化
- `frontend/src/app/admin/company/page.tsx` — 保存後に localStorage 更新 + companySettingsUpdated イベント発火

### 未対応（後続フェーズ）
- **ファビコン動的生成**: 英語会社名からSVGファビコンを自動生成して適用する機能は Phase 2 以降で対応予定

### 次のアクション
- Phase 1-B: PDF 出力（WeasyPrint + Noto CJK JP）の実装 → 完了（次エントリ参照）

---

## Session 2026-05-29 — Phase 1-B: PDF 出力実装

### 作業内容

**インフラ**
- `backend/Dockerfile`: WeasyPrint システム依存（libpango/libcairo/libgdk-pixbuf/libffi/shared-mime-info）+ `fonts-noto-cjk` 追加
- `backend/pyproject.toml`: `weasyprint>=62.0`、`jinja2>=3.1.0` 追加
- VPS で `--no-cache` ビルド → `fonts-noto-cjk` (56.7MB) + `weasyprint==68.1` インストール確認

**バックエンド**
- `backend/app/services/pdf_export.py` 新規作成：
  - `CompanyInfo` dataclass（company_settings DB から構築）
  - `generate_quote_pdf()` — 見積書（表紙: 承認スタンプ・宛先・会社情報・合計 ＋ 内訳: 大項目別明細・値引・消費税・合計）
  - `generate_invoice_pdf()` — 請求書（前月残高・入金・差引・当月・消費税・今回請求・明細・振込先）
  - `generate_order_pdf()` — 注文書（工事名称・金額・工期・支払条件・基本契約約款 第1〜9条）
  - `generate_acknowledgment_pdf()` — 注文請書（注文書と同じ + 請負者署名欄）
  - CSS: A4 縦・Noto Serif JP / Noto Sans JP・ページフッタ「株式会社クラップ P-n」
- `backend/app/api/v1/exports.py` に PDF エンドポイント4本追加：
  - `GET /projects/{id}/quotes/{id}/export-pdf`
  - `GET /projects/{id}/invoices/{id}/export-pdf`
  - `GET /projects/{id}/orders/{id}/export-pdf`
  - `GET /acknowledgments/{id}/export-pdf`
  - 全エンドポイントで company_settings を DB から動的取得

**フロントエンド**（各ページの Excel ボタン隣に赤色 PDF ボタン追加）
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx`
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx`
- `frontend/src/app/projects/[id]/order/page.tsx`

**デプロイ**
- cmv3-api: `✅ health 200 / PDF endpoint 401（認証要求）`
- cmv3-web: `✅ Compiled successfully`

### 変更ファイル
- `backend/Dockerfile` — WeasyPrint 依存 + fonts-noto-cjk
- `backend/pyproject.toml` — weasyprint / jinja2 追加
- `backend/app/services/pdf_export.py` — 新規作成（全帳票 HTML + WeasyPrint）
- `backend/app/api/v1/exports.py` — PDF エンドポイント4本追加
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — PDF ボタン追加
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx` — PDF ボタン追加
- `frontend/src/app/projects/[id]/order/page.tsx` — PDF ボタン追加

### 次のアクション
- 見積書 PDF を実際に出力してレイアウト確認・サンプルとの差分を報告
- Phase 1-C: 権限制御・請求管理・入金アラームの実装

---

## Session 2026-05-29 — 見積書PDF改善

### 作業内容
1. **PDFダウンロードボタン無反応→修正**: API は正常 200 OK 返していたが、フロントの `a.click()` が DOM 未追加で一部ブラウザに無視されていた + ローディング表示がなかった
   - `pdfLoading` state 追加。ボタン押下で「生成中...」表示・グレーアウト
   - `document.body.appendChild(a); a.click(); document.body.removeChild(a)` パターンに修正
   - エラー時にアラート表示
   - 見積書・請求書・注文書の3ページに適用

2. **承認スタンプ文字**: 名前末尾→**苗字（スペース区切り先頭）** に変更

3. **見積書PDF 2〜3ページ目追加**（Gemini生成テンプレート準拠）:
   - P2: 総括表（横向きA4）— 全大項目を一覧、出精値引き・計・消費税・合計
   - P3〜: 大項目別明細（横向きA4）— 大項目ごとに1ページ以上、小計付き
   - 摘要列は現時点で空欄（コメント入力機能は今後実装予定）
   - CSS: Gemini テンプレート（grid-table・col-* 幅定義）準拠
   - フッタ: 「株式会社クラップ」中央 + 「P ー N」右下

4. **ロゴ**: `docs/base/clap_logo.png` を base64 埋め込みで全帳票に適用

### 変更ファイル
- `backend/app/services/pdf_export.py` — `_render_breakdown_html()`・`_BREAKDOWN_CSS` 追加、`generate_quote_pdf()` を3部構成に変更
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — pdfLoading state・ボタン修正
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx` — 同上
- `frontend/src/app/projects/[id]/order/page.tsx` — 同上

### 次のアクション
- 見積書PDF（P2総括表・P3明細）のレイアウトをサンプルと比較して確認（明日確認予定）
- Phase 1-C: 権限制御・請求管理・入金アラーム

---

## Session 2026-06-01 — 各種バグ修正・機能追加デプロイ

### 作業内容（前セッション実装・今セッション冒頭でデプロイ）

1. **進捗・施工記録（3点修正）**
   - 「記録を追加」ボタン位置変更：AppShell action（右上）→ ページ内インライン（テキスト/写真/図面 の3ボタン）
   - 写真・図面ボタン押下 → 即ファイル選択ダイアログ表示（`setTimeout` 50ms 後に `input.click()`）
   - 写真が表示されないバグ修正：`<img>` は Authorization ヘッダー不可 → `AuthImage` コンポーネントで fetch + blob URL に変更
   - 添付ファイル一覧に削除（×）ボタン追加

2. **日報修正機能追加**
   - 各日報カードに鉛筆アイコン（自分の日報 or 管理者のみ表示）
   - クリックで編集モーダル表示（天気・作業内容・開始/終了時刻・メモ）
   - `PATCH /api/v1/daily-reports/{id}` を利用（バックエンドは実装済みだった）

3. **注文書：案件適用ボタン新設**
   - 発行権限チェック：`admin / super_admin / accounting / manager` のみ保存ボタン有効
   - 「案件から適用」ボタン（緑）：案件詳細 + 最新見積書から自動入力（発行日・顧客名・住所・金額・工期・支払条件）
   - 納期・支払条件は手動確認を促すメッセージ付き

4. **顧客マスタ: コード自動生成・引用機能**
   - 顧客新規作成モーダル：「自動生成」ボタン（顧客名先頭4文字 + タイムスタンプ末3桁）
   - 店舗追加モーダル：「自動」ボタン（店舗名先頭3文字 + タイムスタンプ末3桁）
   - 担当者追加モーダル：「代表者と同じ」ボタン（代表者名・役職 "代表取締役" を自動入力）

### 変更ファイル
- `frontend/src/app/projects/[id]/progress/page.tsx` — 3点修正
- `frontend/src/app/daily-report/page.tsx` — 日報修正モーダル追加
- `frontend/src/app/projects/[id]/order/page.tsx` — 案件適用ボタン・発行権限チェック
- `frontend/src/app/clients/page.tsx` — 顧客コード自動生成ボタン
- `frontend/src/app/clients/[id]/page.tsx` — 店舗コード自動生成・担当者引用ボタン

### 残タスク（12_VSCode変更指示書・ユーザー要望より）
- 日報↔カレンダー紐づけ（DB変更が必要）
- カレンダー：担当者の現場スケジュール入力
- 案件新規作成→顧客マスタ連携（Phase C相当）
- 顧客CSV一括登録
- 案件詳細：「案件情報」「担当者」の編集機能追加
- 見積書PDF レイアウト確認・調整

### 次のアクション
- 上記残タスクの優先順位確認
- Phase 1-C（権限制御・請求管理・入金アラーム）

---

## Session 2026-06-01 — 案件詳細ページ編集ボタン視認性改善

### 作業内容
- 「案件情報」「担当者」カードヘッダーに「編集」ボタンを追加（`.card-head .actions` クラスを利用）
- 編集モード中はボタン非表示 → サブテキストを「編集中 — 右上「保存」で確定」に切り替え
- 「案件情報」カードのサブテキストを「セルクリックでインライン編集…」から「工事・発注者・工期・概要」に修正（旧UXの残骸を除去）

### 変更ファイル
- `frontend/src/app/projects/[id]/page.tsx` — 2カードのcard-headに編集ボタン追加

### デプロイ
- SSH経由でファイル転送 → `docker compose up -d --build --no-deps cmv3-web` で cmv3-web のみリビルド
- cmv3-web: `✅ Ready in 597ms`

### 次のアクション（優先順）
1. カレンダー：担当者の現場スケジュール入力（誰がいつどこの現場にいるか）
2. 日報↔カレンダー紐づけ（DB変更要）
3. Phase 1-C: 権限制御・請求管理・入金アラーム
4. 案件新規作成→顧客マスタ連携 / 顧客CSV一括登録
5. 見積書PDF レイアウト確認・調整

---

## Session 2026-06-01 — 編集ボタン改善・エンコード修正

### 問題
- 前回の SSH stdin 転送（PowerShell パイプ）が UTF-16 LE になっており日本語が `???` に化けた
- 編集ボタンが編集後も「保存」に切り替わらない

### 修正内容
1. **エンコード修正**: `[System.IO.File]::ReadAllBytes` → base64 → temp .b64ファイル → SCP → `base64 -d` でサーバーに展開する方式に変更（今後の転送もこの方式を使う）
2. **編集→保存ボタン切り替え**: 「案件情報」「担当者」カードヘッダーで `isEditing` が `true` の時に「キャンセル」+「保存」ボタンを表示、`false` の時に「編集」ボタンを表示
3. **AppShell action 整理**: 編集モード中は上部に重複ボタンが出ないよう、AppShell action は「Excel出力」のみ（編集モード中は非表示）

### 変更ファイル
- `frontend/src/app/projects/[id]/page.tsx` — カードヘッダーボタン切り替え・AppShell action整理

### 次のアクション（優先順）
1. カレンダー：担当者の現場スケジュール入力（誰がいつどこの現場にいるか）
2. 日報↔カレンダー紐づけ（DB変更要）
3. Phase 1-C: 権限制御・請求管理・入金アラーム

---

## Session 2026-06-01 — カレンダー全面強化・要件MD作成

### 追加要件MDファイル
- `docs/08_追加機能要件_スケジュール管理と施工管理.md` 新規作成
  - 競合（プロワン・サクミル・CrowdLog）スクリーンショット参照
  - スケジュール管理・ガントチャート・写真管理・発注/請求管理・ダッシュボードの詳細要件
  - 実装優先順位表（★3〜1）

### 実装内容

**バックエンド**
- `backend/app/api/v1/daily_reports.py`:
  - `EntryRead` に `project_name: str | None` / `project_number: str | None` を追加
  - `list_reports` / `get_report` 両エンドポイントで `selectinload(DailyReportEntry.project)` を追加
  - レスポンス構築で `e.project.project_name` を渡す処理に変更

**フロントエンド（カレンダー全面書き換え）**
- 4カテゴリ表示（色分け凡例付き）：
  - 担当者スケジュール（site_visit, シアン）
  - 日報（緑、プロジェクト名表示）
  - 打合せ・業者訪問・マイルストーン（種別色）
  - その他（個人予定、グレー）
- カレンダーセルに最大3件のチップ表示（溢れは +N件）
- 月変更時に日報も並行取得（`from_date` / `to_date` クエリ使用）
- **日付クリック → 右側に「日詳細パネル」を表示**
  - イベント一覧（削除ボタン付き）
  - 日報一覧（天気・担当者・現場名・実働時間・提出済バッジ）
  - 「＋ イベント追加」ボタン → インラインイベント作成フォーム
    - 種別「現場」選択時は案件・担当者チェックボックスが追加表示
  - 「＋ 日報を書く」ボタン → インライン日報入力フォーム
    - 日付自動セット、案件ドロップダウン、開始/終了時刻、実働時間自動計算
    - 複数案件エントリ追加可（「＋ 案件を追加」ボタン）
    - 提出ボタン（submit APIも自動呼び出し）
- 「今日」ボタン：今月に戻り今日を選択

### 変更ファイル
- `docs/08_追加機能要件_スケジュール管理と施工管理.md` — 新規作成
- `backend/app/api/v1/daily_reports.py` — EntryReadにproject_name追加
- `frontend/src/app/calendar/page.tsx` — 全面書き換え

### デプロイ
- base64転送 → cmv3-api + cmv3-web 同時リビルド
- `✅ cmv3-api: Application startup complete`
- `✅ cmv3-web: Ready in 627ms`

### 次のアクション（優先順）
1. カレンダー動作確認（日報・担当者スケジュールの表示・入力）
2. Phase 1-C: 入金管理・入金アラーム
3. ダッシュボード追加ウィジェット（担当者別稼働時間・未入金アラーム）
4. ガントチャート完成

---

## Session 2026-06-01 — カレンダーバグ修正・使用マニュアル・Phase 1-C（入金アラーム）

### バグ修正
- `backend/app/api/v1/schedule.py` `_to_read()` で `attendees` が `**` 展開と明示指定で二重になっていた `TypeError` を修正
  - `_skip = {"attendees", "project_name", "organizer_name"}` を追加してから `**` 展開

### 使用マニュアル作成
- `docs/MANUAL.md` 新規作成（17章構成）
  - ログイン〜案件管理〜QCDS〜見積〜AI見積スキャン〜カレンダー〜日報〜権限一覧〜FAQ

### Phase 1-C: 入金アラーム・売掛金サマリー

**バックエンド（`backend/app/api/v1/dashboard.py`）**
- `UnpaidAlert` スキーマ追加：期限超過請求書の情報（案件・請求番号・金額・超過日数）
- `InvoiceStats` スキーマ追加：今月請求額・入金待ち合計・期限超過合計・超過件数
- `DashboardResponse` に `invoice_stats` + `unpaid_alerts` を追加
- 集計ロジック：
  - `total_pending`: status in (draft, sent, partially_paid) の未入金合計
  - `total_overdue`: payment_due_date < today かつ未入金の請求書合計
  - `this_month_billed`: 今月発行分の請求合計
  - `unpaid_alerts`: 期限超過の請求書を期日順にソートして最大20件

**フロントエンド（`frontend/src/app/dashboard/page.tsx`）**
- `UnpaidAlert` / `InvoiceStats` 型定義追加
- **売掛金サマリー（3カード）**を KPI grid の直下に追加：
  - 今月請求額（青ボーダー）
  - 入金待ち合計（黄ボーダー）
  - 期限超過（赤ボーダー・赤背景・件数バッジ付き）
- **未入金アラームウィジェット**（期限超過がある場合のみ表示）：
  - 案件番号リンク・請求番号・請求額・支払期日・超過日数バッジ（赤）
  - テーブル形式で一覧表示

### 変更ファイル
- `docs/MANUAL.md` — 新規作成
- `backend/app/api/v1/dashboard.py` — InvoiceStats+UnpaidAlert追加
- `frontend/src/app/dashboard/page.tsx` — 売掛金サマリー+未入金アラームウィジェット追加

### デプロイ
- cmv3-api + cmv3-web 同時リビルド
- `✅ Application startup complete / Ready in 647ms`

### 次のアクション
- ダッシュボード確認（売掛金サマリー・未入金アラームの表示）
- ガントチャート完成
- 担当者別稼働時間ウィジェット（日報集計）

---

## Session 2026-06-01 — ガントチャート全面強化

### 案件工程表（`/projects/{id}/gantt`）大幅改善
- **今日ライン**：現在日付の縦線（青）＋「今日」ラベル。ロード時に今日位置へ自動スクロール
- **月ヘッダー追加**：日付ヘッダーを2段構成（月名 + 日付）に変更
- **遅延ハイライト**：`today > planned_end && progress < 100` のタスクを自動で赤色バー＋「遅延」ラベル
- **完了/遅延カウントバッジ**：ページ上部に「完了 N/M」「遅延 N件」バッジ表示
- **タスクインライン編集**：左パネルのタスク行をクリックするとアコーディオンで編集フォームを展開
  - タスク名・予定開始/終了日・ステータスドロップダウン
  - **進捗スライダー**（0〜100%、5%刻み）
  - **担当者ドロップダウン**（ユーザー一覧から選択）
  - メモ欄
  - 保存/キャンセルボタン
- **担当者表示**：左パネルのタスク行に担当者名を小さく表示
- 進捗率オーバーレイ：バー内に半透明白オーバーレイで進捗を表現（既存機能を維持）

### 全社工程表（`/gantt`）大幅改善
- **今日ライン**：全行に青縦線（各グループ行にも透過版）
- **遅延ハイライト**：赤バー＋左パネルのタスク名も赤色に
- **月ヘッダー**：2段ヘッダー（月 + 日付）
- **メンバー軸切替ボタン**：
  - **案件軸**（デフォルト）：案件でグループ、タスク行に担当者名表示
  - **メンバー軸**：担当者でグループ、タスク行に案件名表示（担当者未設定はまとめて「担当者未設定」に）
- **完了/遅延バッジ**：ページ上部に全タスク中の完了数・遅延数を表示

### バックエンド変更
- `backend/app/api/v1/gantt.py` の `list_all_tasks`:
  - `selectinload(ProjectTask.assigned_user)` を追加
  - レスポンスに `assigned_user_name` フィールドを追加

### 変更ファイル
- `frontend/src/app/projects/[id]/gantt/page.tsx` — 全面書き換え
- `frontend/src/app/gantt/page.tsx` — 全面書き換え
- `backend/app/api/v1/gantt.py` — assigned_user_name追加

### デプロイ
- `✅ Application startup complete / Ready in 662ms`

### 次のアクション
- ガントチャート動作確認（タスク編集・担当者・遅延ハイライト）
- 写真台帳PDF出力
- 担当者別稼働時間ウィジェット（日報集計をダッシュボードに追加）

---

## Session 2026-06-01 — 担当者別稼働時間・写真台帳PDF

### 担当者別稼働時間ウィジェット（ダッシュボード）

**バックエンド (`backend/app/api/v1/dashboard.py`)**:
- `UserWorkHours` スキーマ追加（user_id / user_name / this_month_minutes）
- `DashboardResponse` に `user_work_hours` フィールド追加
- 今月分の `daily_report_entries.working_minutes` を user_id でグループ集計するクエリを追加

**フロントエンド (`frontend/src/app/dashboard/page.tsx`)**:
- `UserWorkHours` 型定義追加
- ボトムグリッドの「最近の活動」カードの前に「担当者別稼働時間」カードを追加
  - 水平バーチャート（CSSのみ、外部ライブラリ不使用）
  - バー幅はその月の最大時間に対する比率
  - 右端に「Xh Ym」形式で実績時間を表示
  - 日報データがない月は非表示

### 写真台帳PDF出力

**バックエンド `backend/app/services/pdf_export.py`**:
- `generate_photo_album_pdf()` 関数を追加
  - タイトルページ（工事名・工事番号・発注者・工期・会社名）
  - 撮影種別（施工前/施工中/施工後/問題箇所/図面）ごとにセクション分け
  - 2列グリッド：各写真に撮影日・工種・キャプションを表示
  - WeasyPrint で A4 縦 PDF 出力、ページフッタ「株式会社クラップ / P-N」

**バックエンド `backend/app/api/v1/exports.py`**:
- `GET /api/v1/projects/{project_id}/photo-album/export-pdf` エンドポイント追加
  - 案件の全進捗ログから画像添付を取得
  - ファイルを disk から読み込み base64 エンコード
  - photo_type 別にグループ化して PDF 生成
  - ファイルが存在しない場合はスキップ

**フロントエンド `frontend/src/app/projects/[id]/photo-album/page.tsx`**:
- 「PDF出力」ボタン（赤・写真が1枚以上ある場合のみ表示）を追加
- 認証付きfetch → Blob → ダウンロード処理

### 変更ファイル
- `backend/app/api/v1/dashboard.py`
- `frontend/src/app/dashboard/page.tsx`
- `backend/app/services/pdf_export.py`
- `backend/app/api/v1/exports.py`
- `frontend/src/app/projects/[id]/photo-album/page.tsx`

### デプロイ
- `✅ cmv3-api: startup complete / cmv3-web: Ready in 631ms`

### 次のアクション
- 写真台帳PDFの動作確認（写真が少なくてもタイトルページが出るか）
- 担当者別稼働時間の確認（日報を入力後にダッシュボードに反映）
- 次フェーズ候補：
  - 発注書一覧（全案件横断）
  - 承認通知（Slack/メール）

---

## Session 2026-06-01 — 写真台帳バグ修正・ライトボックス・撮影場所入力

### バグ修正（写真台帳）
- **写真非表示バグ修正**: `<img src={att.file_path}>` → `AuthImage` コンポーネント（`/api/v1/progress/attachments/{id}` に Bearer トークン付き fetch → blob URL）に変更
- **削除バグ修正**: バックエンドに `DELETE /api/v1/progress/attachments/{id}` エンドポイントを新設（単体削除）。フロントに × ボタン追加
- **undefined URL 解消**: `imgSrc` 関数を廃止し、`AuthImage` コンポーネントに統一

### 写真クリックポップアップ（ライトボックス）実装
- 写真クリック → フルスクリーンオーバーレイ（黒背景92%）で拡大表示
- ← → ボタン＋キーボード矢印キーで前後の写真に移動
- Esc キーで閉じる、背景クリックでも閉じる
- 写真情報バー：撮影区分バッジ・工種・撮影日・キャプション・場所・「N/M」枚数
- 隣接写真をプリフェッチ（`useAuthBlob` カスタムフック化）
- 施工前後対比ビューの写真もクリックで同ライトボックスが開く
- キーボードヒント「← → で移動 / Esc で閉じる」をフッターに表示

### 撮影場所・撮影区分の入力機能
**バックエンド (`backend/app/api/v1/progress.py`)**:
- `create_progress` エンドポイントに `photo_type`, `work_type`, `caption`, `location_in_site` の Form パラメータを追加
- 各 `ProgressAttachment` にこれらのメタデータを保存

**フロントエンド (`frontend/src/app/projects/[id]/progress/page.tsx`)**:
- 写真・図面追加フォームに 2×2 グリッドでメタデータ入力欄を追加：
  - 撮影区分（施工前/施工中/施工後/問題箇所/図面）
  - 撮影場所（自由記述）
  - 工種（自由記述）
  - キャプション（自由記述）
- reset 時にこれらの state もクリア
- FormData に含めて POST

### 変更ファイル
- `frontend/src/app/projects/[id]/photo-album/page.tsx` — ライトボックス実装・AuthImage・削除ボタン
- `backend/app/api/v1/progress.py` — DELETE attachment endpoint追加・upload時メタデータ保存
- `frontend/src/app/projects/[id]/progress/page.tsx` — 撮影メタデータ入力フォーム追加

### 次のアクション
- 写真台帳の動作確認（撮影場所入力→施工前後対比が機能するか）
- 発注書一覧（全案件横断）
- 承認通知（Slack/メール）

---

## Session 2026-06-01 — 発注管理一覧・Slack Webhook通知

### 発注管理（全案件横断）`/purchases`

**バックエンド (`backend/app/api/v1/purchase.py`)**:
- `PurchaseOrderRead` に `project_name` / `project_number` フィールド追加
- `_to_read()` で `order.project` を参照して名前を取得（既存エンドポイントにも `selectinload(project)` 追加）
- `GET /api/v1/purchase-orders/all` 新規エンドポイント追加（`?status_filter=`・`?vendor_id=` フィルタ対応）

**フロントエンド `frontend/src/app/purchases/page.tsx` 新規作成**:
- ステータス別サマリーカード（下書き/発行済/一部納品/納品完了/完了、件数+金額）
  - クリックでステータスフィルタ ON/OFF トグル
- 全案件発注書テーブル：案件番号リンク・業者名・発注番号・発注日・納品期日（超過=赤バッジ）・金額・ステータスバッジ・詳細リンク
- 案件名/業者名/発注番号のテキスト検索
- フッター行：合計件数・合計金額

**ナビゲーション `AppShell.tsx`**:
- サイドバーに「発注管理」リンク追加（業者マスタの上）

### Slack Webhook通知

**Alembic マイグレーション `o9p0q1r2s3t4_add_slack_webhook.py`**:
- `company_settings` テーブルに 3カラム追加：
  - `slack_webhook_url` VARCHAR(500)
  - `slack_notify_status_change` BOOLEAN (default=true)
  - `slack_notify_payment_due` BOOLEAN (default=true)

**モデル `backend/app/models/company_settings.py`**:
- 上記3フィールドを追加

**通知サービス `backend/app/services/notification.py` 新規作成**:
- `notify_status_changed()` — 案件ステータス変更をSlackに送信
- `notify_payment_overdue()` — 入金期限超過をSlackに送信（将来用）
- 失敗しても例外を吸収（業務処理は止めない）
- `httpx.AsyncClient` で非同期POST

**フック `backend/app/api/v1/projects.py`**:
- `change_status` エンドポイントに Slack 通知フックを追加（try/except で安全に）

**管理画面 `frontend/src/app/admin/company/page.tsx`**:
- 「Slack通知設定」セクション追加：
  - Webhook URL 入力欄（設定方法リンク付き）
  - 「案件ステータス変更時に通知」チェックボックス
  - 「入金期限超過時に通知」チェックボックス

### 変更ファイル
- `backend/app/api/v1/purchase.py`
- `backend/app/api/v1/projects.py`
- `backend/app/models/company_settings.py`
- `backend/app/services/notification.py` — 新規
- `backend/alembic/versions/o9p0q1r2s3t4_add_slack_webhook.py` — 新規
- `frontend/src/app/purchases/page.tsx` — 新規
- `frontend/src/app/admin/company/page.tsx`
- `frontend/src/components/layout/AppShell.tsx`

### デプロイ
- Alembicマイグレーション自動実行（コンテナ起動時）
- `✅ Application startup complete / Ready in 645ms`

### 次のアクション
- Slack Webhook URLを自社情報設定に入力してテスト（案件ステータス変更で通知が来るか）
- 発注管理ページの動作確認
- 次フェーズ候補：案件コメント機能・モバイル最適化・見積→請求の自動連動

---

## Session 2026-06-01 — 発注書ページ改善（業者選択バグ修正・見積自動追加・D&Dスキャン）

### 作業内容

1. **バグ修正: 業者ドロップダウンが空表示になる問題**
   - 原因: `backend/app/api/v1/purchase.py` の `_to_read()` が `order.vendor.name` を参照していたが、`Vendor` モデルのカラム名は `vendor_name`
   - バックエンド修正: `order.vendor.name` → `order.vendor.vendor_name`
   - フロントエンド修正: `Vendor` インターフェースの `name: string` → `vendor_name: string`、`v.name` 参照を `v.vendor_name` に統一

2. **新機能: 業者選択時に見積履歴から明細を自動追加**
   - 業者ドロップダウン変更時に `GET /api/v1/vendors/{id}/price-history` を呼び出し
   - 履歴が存在すれば confirm() で確認後、明細テーブルに自動追加
   - 既存明細がある場合は末尾に追記、空の場合は置き換え

3. **新機能: PDF/Excel D&Dスキャン**
   - 発注書作成フォームの先頭に D&D ゾーン追加（クリックでファイル選択も可）
   - 対応フォーマット: PDF / Excel (.xlsx/.xls) / 画像 (.png/.jpg/.jpeg)
   - 既存の `/api/v1/scan/upload?project_id=` エンドポイントを使用
   - ポーリング（2.5秒間隔）でジョブ完了を確認 → スキャン結果の明細を自動取込
   - スキャン中はインジケーター表示・完了/エラーメッセージを表示

### 変更ファイル
- `backend/app/api/v1/purchase.py` — `vendor.name` → `vendor.vendor_name` バグ修正
- `frontend/src/app/projects/[id]/purchase/page.tsx` — 全面改修（上記3機能実装）

### デプロイ
- base64方式でファイル転送 → cmv3-api 再起動 + cmv3-web リビルド
- `✅ cmv3-api restarted / cmv3-web: Ready in 641ms`

### 次のアクション
- 案件詳細「発注書」タブで業者ドロップダウンに業者名が表示されることを確認
- 業者選択後に見積履歴の自動追加ダイアログが表示されることを確認
- PDF/Excel を D&D して明細が取込まれることを確認

---

## Session 2026-06-01 — Phase 1-A: Shared 基盤構築（ステップ1完了）

### 作業内容

**Frontend 新規作成（既存ページ変更なし）**
- `frontend/src/lib/format.ts` — fmtYen / fmtDateISO / fmtDateJP / fmtDateTime / fmtRelTime / fmtMinutes / fmtFileSize / fmtNum を集約
- `frontend/src/components/ui/StatusBadge.tsx` — label+color props のバッジ共通コンポーネント + makeStatusBadge ファクトリ
- `frontend/src/components/ui/Pagination.tsx` — page/perPage/total/onPrev/onNext の汎用ページネーション
- `frontend/src/components/ui/DropZone.tsx` — D&D + クリックファイル選択の共通コンポーネント（scanning状態管理込み）
- `frontend/src/components/ui/AuthImage.tsx` — 認証ヘッダー付き fetch → blob URL 表示コンポーネント（メモリリーク対策済み）

**Backend 新規作成（`shared/` ディレクトリ）**
- `backend/app/shared/models/base.py` — TimestampMixin
- `backend/app/shared/models/enums.py` — 全 Enum（app.models.enums の実体）
- `backend/app/shared/models/history.py` — EditHistory モデル
- `backend/app/shared/schemas/common.py` — PaginatedResponse[T] 汎用スキーマ
- `backend/app/shared/services/history.py` — 編集履歴記録ヘルパー
- `backend/app/shared/services/project_number.py` — 工事番号採番
- `backend/app/shared/services/notification.py` — Slack 通知

**Backend 旧パス後方互換 re-export（既存コードは変更なし）**
- `backend/app/models/base.py` → shared から re-export
- `backend/app/models/enums.py` → shared から re-export（全 Enum）
- `backend/app/models/history.py` → shared から re-export
- `backend/app/services/history.py` → shared から re-export
- `backend/app/services/project_number.py` → shared から re-export
- `backend/app/services/notification.py` → shared から re-export

### 確認結果
- `ALL IMPORTS OK`（コンテナ内で新旧両パスの import を確認）
- `GET /api/v1/health` → 200（API 起動正常）
- 既存ページへの影響なし（app/ 配下は変更していない）

### 次のアクション（ステップ2）
- ひささんの承認後に既存ページへの適用を開始
- 適用順序: projects/page.tsx → vendors/page.tsx → purchases/page.tsx の順に1画面ずつ

---

## Session 2026-06-01 — Phase 1 ステップ2: 既存ページへの共通部品適用

### 適用したページと内容

| ページ | 変更 |
|-------|------|
| `projects/page.tsx` | `fmtYen` import、受注額インライン式を置換 |
| `purchases/page.tsx` | `fmtYen` ローカル定義を削除して format.ts から import |
| `projects/[id]/page.tsx` | `fmtYen` ローカル定義を削除 |
| `projects/[id]/attendance/page.tsx` | `fmtYen` ローカル定義を削除 |
| `projects/[id]/purchase/page.tsx` | `fmtYen` ローカル定義を削除 |
| `projects/[id]/quote/page.tsx` | `const fmt = fmtYen` エイリアス化 |
| `projects/[id]/invoice/page.tsx` | `const fmt = fmtYen` エイリアス化 |
| `projects/[id]/estimate/page.tsx` | `const fmt = fmtYen` エイリアス化 |
| `projects/[id]/invoice/[invoice_id]/page.tsx` | `const fmt = fmtYen` エイリアス化 |
| `projects/[id]/quote/[quote_id]/page.tsx` | `const fmt = fmtYen` エイリアス化 |

**スキップ（書式が異なる）:** `daily-report`, `dashboard`, `kanban`

---

## Session 2026-06-01 — Phase 3: Project モジュール移行

### ステップ1-A: Backend modules/project/ 構築
- `backend/app/modules/project/router.py` — projects.py の実体を移動
- `backend/app/modules/project/kanban_router.py` — kanban.py の実体を移動
- `backend/app/modules/project/comments_router.py` — comments.py の実体を移動
- `backend/app/modules/project/models.py` — Project, ProjectComment re-export
- `backend/app/modules/project/schemas.py` — ProjectCreate 等 re-export
- `backend/app/api/v1/{projects,kanban,comments}.py` → re-export shim に変更

### ステップ1-B: Frontend modules/project/ 構築
- `frontend/src/modules/project/types.ts` — types/project.ts の re-export
- `frontend/src/modules/project/ProjectStatusBadge.tsx` — 実体を移動（旧パスは re-export）
- `frontend/src/modules/project/ProjectSubNav.tsx` — 実体を移動（旧パスは re-export）
- `frontend/src/modules/project/CreateProjectModal.tsx` — 実体を移動（旧パスは re-export）

### ステップ2: UI コンポーネント抽出
- `frontend/src/modules/project/EditField.tsx` — page.tsx (734行) から抽出
- `frontend/src/modules/project/EditSelect.tsx` — page.tsx から抽出
- 各抽出後に Props 型整合性確認済み

### 確認結果
- `ALL MODULE IMPORTS OK`（コンテナ内で import チェーン確認）
- `✓ Compiled successfully / Ready in 650ms`（TypeScript エラーなし）
- `GET /api/v1/health → 200`（API 正常）

### GitHub push
- commit: dd60982
- https://github.com/Hisamori-T/cm3 へ push 完了

### 次のアクション
- Phase 2（Customer, Vendor, Admin の葉モジュール）またはさらなる Phase 3 UI 抽出

---

## Session 2026-06-01 — Phase 4 & 5: Schedule / Site / Purchase モジュール移行

### Phase 4: Schedule & Site モジュール構造確立
- `backend/app/modules/schedule/` 新設（gantt_router, schedule_router — re-export 構造）
- `backend/app/modules/site/` 新設（progress_router, daily_reports_router, attendance_router — re-export 構造）

### Phase 5 ステップ1: scan.py (1,001行) を3ファイルに分割（最重要）

**分割構成:**
| ファイル | 内容 | 行数 |
|---------|------|:----:|
| `_shared.py` | `_job_to_read`, `_result_to_read`, 定数 | 共通ヘルパー |
| `scan_upload.py` | POST /scan/upload, GET /scan/jobs, GET /scan/jobs/{id}, GET /scan/file/{id} | 4エンドポイント |
| `scan_review.py` | GET/PATCH /scan/results/{id}, POST /confirm | 3エンドポイント |
| `scan_transfer.py` | POST /apply, /transfer-to-qcds, /save-as-version, bulk-* | 7エンドポイント |

**Celery 依存関係確認:**
- `scan_tasks.py` は `ScanJob` モデルと `gemini_scanner` のみ参照
- scan ルーターへの依存は一切なし → 分割後も完全に独立 ✅

**旧 `api/v1/scan.py`:** 3ルーターを集約する re-export shim（14エンドポイント同数確認）

### Phase 5 ステップ2: フロントエンド純粋関数抽出
- `frontend/src/modules/purchase/scanHelpers.ts` 新設
  - `confClass / confStyle / cellBg` を `scan/[job_id]/page.tsx` から抽出（state 非依存の純粋関数のみ）
- `scan/[job_id]/page.tsx` の `fmtNum` を `lib/format.ts` から import に変更
- 複雑な state コンポーネント（items table、split pane）は安全に抽出できないためスキップ

### 確認結果
- `ALL PHASE 4 & 5 IMPORTS OK` + `scan_router routes: 14`（コンテナ内検証）
- `✓ Compiled successfully / Ready in 623ms`（TypeScript エラーなし）
- `GET /api/v1/health → 200`
- GitHub push: commit 5531a53

### 次のアクション
- Phase 2（Customer, Vendor, Admin 葉モジュール）の実装
- `scan/[job_id]/page.tsx` の残り UI 抽出は、items table の state 整理後に実施予定

---

## Session 2026-06-01 — 発注書ページ追加修正

### 作業内容
1. **500エラー修正（バックエンド）**: `purchase.py` の修正が前回コンテナに反映されていなかった → `docker cp` で直接コンテナに注入して再起動
2. **D&Dエリア拡大**: `padding: sp-6`, `minHeight: 120px`, flexbox 縦並びでアイコン+テキスト表示に変更（約5倍の高さ）
3. **保存ボタン改善**: 「下書き保存」と「発行して保存」の2ボタン構成に変更。「発行して保存」は POST 後に自動で issue API を呼び出す。説明テキスト（下書きは後から発行できる旨）を追記

### 変更ファイル
- `backend/app/api/v1/purchase.py` — `docker cp` でコンテナに直接適用・cmv3-api 再起動
- `frontend/src/app/projects/[id]/purchase/page.tsx` — D&Dゾーン拡大・保存ボタン2択化

### デプロイ
- `✅ cmv3-api: Application startup complete`
- `✅ cmv3-web: Ready in 653ms`

### 次のアクション
- 発注書「下書き保存」と「発行して保存」の動作確認
- 業者ドロップダウンに業者名が正しく表示されることを確認

---

## Session 2026-06-01 — Phase 2: 発注書ステータス管理・支払期日・支払いカレンダー

### 作業内容（Phase 2 全実装）

1. **ステータスラベル更新**: draft→未発注 / issued→発注済 / delivered→納品済 / completed→支払済

2. **ステータス遷移ボタン追加（案件内発注書タブ）**:
   - 未発注: 「発注する」（→発注済）
   - 発注済: 「納品済にする」（→納品済）
   - 納品済: 「支払済にする」（→支払済）
   - 支払済のみ修正ボタン非表示

3. **支払期日フィールド追加**:
   - Alembicマイグレーション `p0q1r2s3t4u5`: `purchase_orders` に `payment_due_date`, `paid_at` カラム追加
   - 発注書作成・編集フォームに「支払期日」日付入力欄追加
   - 一覧カードに支払期日表示（期限超過は赤色 + ⚠️）

4. **新APIエンドポイント3本追加**:
   - `POST /purchase-orders/{id}/mark-delivered`
   - `POST /purchase-orders/{id}/mark-paid`
   - `GET /purchase-orders/upcoming-payments?days=N`（カレンダー用）

5. **支払いカレンダー**: 支払期日をカレンダービューに表示
   - `/calendar` に `PaymentDue` 型・`payments` state・`dayPayments()` ヘルパー追加
   - カレンダーセルに紫チップで支払期日業者名を表示
   - 日詳細パネルに「💴 支払期日」セクション追加（業者名・案件・金額）
   - 凡例に「支払期日（紫）」追加

### 変更ファイル
- `backend/alembic/versions/p0q1r2s3t4u5_add_payment_due_date.py` — 新規マイグレーション
- `backend/app/models/purchase.py` — payment_due_date / paid_at フィールド追加
- `backend/app/api/v1/purchase.py` — スキーマ拡張・遷移API3本・upcoming-payments追加
- `frontend/src/app/projects/[id]/purchase/page.tsx` — ステータスUI・支払期日フォーム
- `frontend/src/app/calendar/page.tsx` — 支払いカレンダー統合

### デプロイ
- migration `p0q1r2s3t4u5` 適用済み
- `✅ cmv3-api: Application startup complete / cmv3-web: Ready in 657ms`

### 次のアクション
- 発注書に支払期日を設定して「発注する」→「納品済にする」→「支払済にする」の遷移を確認
- カレンダーで支払期日の紫チップが表示されることを確認

---

## Session 2026-06-01 — Phase 6: Estimate モジュール完全完了

### 作業内容

**Phase 6 チェックリスト全完了**

#### バックエンド
| 作業 | ファイル |
|-----|---------|
| qcds.py の実体を移動 | `modules/estimate/routers/qcds.py`（新規） |
| api/v1/qcds.py → re-export shim | `api/v1/qcds.py` |

#### フロントエンド quote/[quote_id]/page.tsx（1293行 → 801行、492行削減）
| コンポーネント | 内容 |
|--------------|------|
| `ApprovalStamps.tsx` | 稟議承認スタンプ3つ + ドロップダウン |
| `QuoteTotals.tsx` | 合計カード / 粗利ゲージ / 大項目別内訳 |

#### フロントエンド estimate/page.tsx（1267行 → 1164行、103行削減）
| コンポーネント | 内容 |
|--------------|------|
| `ScanZone.tsx` | D&Dゾーン + スキャン進捗（左パネル） |
| `VersionCard.tsx` | 業者見積版カード（1版あたりのUI） |

**modules/estimate/ 最終構成:**
- Backend routers: `_helpers / quote_core / quote_versions / quote_sections / qcds`
- Backend services: `quote_service`
- Frontend: `QCDSDirectWorkTable / QCDSExpensePanel / SectionBlock / ApprovalStamps / QuoteTotals / ScanZone / VersionCard`

**総削減量（qcds/page.tsx + quote/[quote_id]/page.tsx + estimate/page.tsx）:**
- qcds: 1293 → 734行（559行削減）
- quote/[quote_id]: 1293 → 801行（492行削減）
- estimate: 1267 → 1164行（103行削減）
- **合計: 1,154行削減**

### 変更ファイル
- 新規: `backend/app/modules/estimate/routers/qcds.py`
- 変更: `backend/app/api/v1/qcds.py` — re-export shim
- 新規: `frontend/src/modules/estimate/ApprovalStamps.tsx`
- 新規: `frontend/src/modules/estimate/QuoteTotals.tsx`
- 新規: `frontend/src/modules/estimate/ScanZone.tsx`
- 新規: `frontend/src/modules/estimate/VersionCard.tsx`
- 変更: `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx`
- 変更: `frontend/src/app/projects/[id]/estimate/page.tsx`

### コミット
- fdde62c: Phase 6 バックエンド + QCDSDirectWorkTable / QCDSExpensePanel
- fd626ff: SectionBlock + ItemRow
- 1892396: 残り全コンポーネント + qcds.py 移行（Phase 6 完了）

### 次のアクション
- VPS デプロイして全見積フロー（QCDS / 業者見積 / 顧客見積 / 稟議承認）を動作確認
- **Phase 6 チェックポイント確認：**
  - [ ] 見積書作成・大項目追加・明細追加 正常
  - [ ] 業者見積版管理・掛率設定 正常
  - [ ] 稟議承認スタンプ 正常（押印→リロード後も保持）
  - [ ] QCDS 原価算定表・経費行 正常
  - [ ] スキャン→版作成→QCDS 反映→顧客見積反映 フロー正常
  - [ ] 見積書 Excel / PDF 出力 正常
- Phase 7（Report モジュール）または他の優先タスクへ

---

## Session 2026-06-02 — 注文書 PDF レイアウト全面改修

### 作業内容

**概念修正（顧客→弊社宛）**
- 旧: 弊社が業者に発注する書類 → 新: 顧客が弊社に発注する書類
- 宛先を `{業者名} 御中` → `株式会社クラップ 御中`（固定）に変更
- 右側を弊社情報→顧客記入欄（住所・会社名・氏名・印）に変更

**PDF レイアウト（A4横・2カラム）**
- A4縦 → A4横（landscape）に変更
- 右上: 弊社工事番号（project_number）+ 発行年月日を自動表示
- 左カラム: 案件情報テーブル（工事名称〜適要の7項目）
- 右カラム: 顧客記入欄（住所・会社名・氏名・印）+ 基本契約約款（第1〜9条）
- 不要な罫線削除（T字ライン、カラム縦線）、住所欄を破線に変更

**新フィールド追加（DB + API + フロント）**
- `work_content`: 工事内容（デフォルト: 添付工事内訳書の通り、編集可）
- `notes`: 適要（デフォルト: 空欄、編集可）

**バグ修正**
- `exports.py` が旧 `app.services.pdf_export` を参照していた → `modules/report/services` に修正
- `orders.py` の `_to_read()`・create・update に新フィールドを追加していなかった → 追加

### 変更ファイル
- `backend/app/models/order.py` — work_content / notes 追加
- `backend/app/schemas/order.py` — work_content / notes 追加
- `backend/app/modules/report/routers/orders.py` — _to_read / create / update に反映
- `backend/app/modules/report/routers/exports.py` — import 先を modules に修正
- `backend/app/modules/report/services/pdf_export.py` — 全面書き換え（A4横・2カラム）
- `backend/alembic/versions/q1r2s3t4u5v6_add_order_work_content_notes.py` — migration
- `frontend/src/types/order.ts` — work_content / notes 追加
- `frontend/src/app/projects/[id]/order/page.tsx` — 工事内容・適要の入力欄追加

### コミット
- 3d7d5a5: 注文書 PDF 全面改修
- 55bf0a2: orders.py バグ修正
- 06222f4: exports.py import 修正
- 1ea341d: T字ライン削除・破線変更
- 8b17271: カラム縦線削除

### フロントエンド追加変更（コミット未）
- `loadOrders(keepSelectedId?)` リファクタリング：保存・ステータス変更後も選択中の注文書を維持
- `handleIssueAcknowledgment(orderId?)` リファクタリング：引数で注文書IDを直接受け取れるよう変更
- `handleStatusChange` 改善：「発行済み」ステータスに変更した瞬間に注文請書を自動発行
- TypeScript 型エラー修正：`onClick={handleIssueAcknowledgment}` → `onClick={() => handleIssueAcknowledgment()}`（`Promise<void>` は `MouseEventHandler` に非互換）

### 次のアクション
- 注文請書（Acknowledgment）の PDF も同レイアウトに合わせるか確認
- 他帳票（見積書・請求書）のレイアウト確認

---

## Session 2026-06-02 — TypeScript ビルドエラー修正（原状復帰）

### 経緯
前セッション（2026-06-02 注文書 PDF 改修）が API 使用制限に到達してセッション切れ。
フロントエンド変更（order/page.tsx・order.ts）がディスクに書き込まれたが未コミット。
TypeScript の `onClick` 型エラーが未修正のままだった。

### 作業内容
- session_log.md とメモリを参照して前セッション状況を把握
- `onClick={handleIssueAcknowledgment}` → `onClick={() => handleIssueAcknowledgment()}` に修正（型エラー解消）
- 前セッションの未コミット変更を含め全変更をコミット

### 変更ファイル
- `docs/session_log.md` — セッションログ追記
- `frontend/src/app/projects/[id]/order/page.tsx` — onClick 型修正 + 前セッション分（loadOrders/handleIssueAcknowledgment リファクタ・自動注文請書発行・工事内容/適要フォーム追加）
- `frontend/src/types/order.ts` — work_content / notes フィールド追加（前セッション分）

### 次のアクション
- VPS にデプロイ（cmv3-web のみリビルドで可）
- 注文書「発行済み」に変更時に注文請書が自動発行されることを確認
- 注文請書（Acknowledgment）PDF のレイアウト確認

---

## Session 2026-06-01 — Phase 6: Estimate モジュール分割（バックエンド完了 + フロント1件）

### 作業内容

**Phase 6-A（前セッション済み）**: `backend/app/modules/estimate/` ディレクトリ構造と `_helpers.py` 作成済み

**Phase 6-B〜D: バックエンド quotes.py 分割**
- `modules/estimate/routers/quote_core.py` — Quote CRUD（list/create/get/update）+ 承認スタンプ + 関連帳票生成（6エンドポイント）
- `modules/estimate/routers/quote_versions.py` — 版CRUD + import-items + QCDS/見積反映 + 業者マスタ版作成（8エンドポイント）
- `modules/estimate/routers/quote_sections.py` — 大項目CRUD + 単発明細CRUD + テンプレート適用（8エンドポイント）
- 共通ヘルパー `_helpers.py`（前セッション作成済み）に全ルーターから import

**Phase 6-E: re-export shim**
- `backend/app/api/v1/quotes.py` を re-export shim に変換（3ルーターを include_router でマージ）
- 既存コードの import パスは無変更で動作継続

**Phase 6-F: quote_service.py 作成**
- `modules/estimate/services/quote_service.py` に `create_initial_quote()` 関数を作成
- `modules/project/router.py` の `create_project` 内インライン Quote 生成を `create_initial_quote()` 呼び出しに置き換え

**Phase 6-G: import 検証**
- コンテナ内で `estimate` モジュール全体の import テスト実施
- `quote_core 6routes / quote_versions 8routes / quote_sections 8routes = 合計22エンドポイント`（元の quotes.py と同数）を確認

**Phase 6-H: フロントエンド QCDSDirectWorkTable 抽出（1件）**
- `frontend/src/modules/estimate/QCDSDirectWorkTable.tsx` 新規作成
  - Props: `works / qcds / checkedWorkIds / setCheckedWorkIds / expandedRows / scanItems / bulkDeleting / updateWork / handleBulkDelete / handleDeleteWork / toggleRow`
  - 一括削除バー + 3カラム直接工事費テーブル（外注/資材/その他）をカプセル化
  - `COLS / EMPTY_MIN / getColIndices / TInput` ヘルパーもコンポーネントファイルに内包
- `qcds/page.tsx` の修正:
  - `Fragment / useRef / QCDSCategory` の未使用 import を削除
  - 行692〜831（一括削除バー + `COLS.map` ブロック）を `<QCDSDirectWorkTable ...props />` に置き換え
  - ページ行数: 1293行 → 1045行（248行削減）

### 変更ファイル
- 新規: `backend/app/modules/estimate/routers/quote_core.py`
- 新規: `backend/app/modules/estimate/routers/quote_versions.py`
- 新規: `backend/app/modules/estimate/routers/quote_sections.py`
- 新規: `backend/app/modules/estimate/services/quote_service.py`
- 変更: `backend/app/api/v1/quotes.py` — re-export shim に変換
- 変更: `backend/app/modules/project/router.py` — `create_initial_quote()` 呼び出しに変更
- 新規: `frontend/src/modules/estimate/QCDSDirectWorkTable.tsx`
- 変更: `frontend/src/app/projects/[id]/qcds/page.tsx` — QCDSDirectWorkTable を使用

### 次のアクション（Phase 6 続き）
- **【Phase 6 残り】** フロントエンドの残り抽出（1コンポーネントずつ）:
  - `QCDSExpensePanel` → `qcds/page.tsx` から経費行セクション（B-1/B-2）を抽出
  - `SectionBlock` → `quote/[quote_id]/page.tsx` から大項目ブロックを抽出
  - `ApprovalStamps` → 承認スタンプ3つを抽出
  - `QuoteTotals` → 右パネル合計カードを抽出
  - `ScanZone` → `estimate/page.tsx` から D&D ゾーン＋スキャン進捗を抽出
  - `VersionCard` → 版カードを抽出
- **【注意】** 各抽出後に `qcds` ページ・`quote/[quote_id]` ページ・`estimate` ページの動作確認を行ってから次に進む
- **VPS デプロイ**: Phase 3〜6 の全バックエンド変更を本番に適用する前に、ローカルコンテナでリビルドテストを推奨

---

## Session 2026-06-02 — Phase 7: Report モジュール + 最終クリーンアップ完了

### 作業内容

**新規モジュール作成**
| モジュール | 内容 |
|-----------|------|
| `modules/report/` | orders / invoices / exports / dashboard / excel_export / pdf_export |
| `modules/customer/` | clients（顧客マスタ） |
| `modules/vendor/` | vendors（業者マスタ） |
| `modules/auth/` | auth（認証） |
| `modules/admin/` | admin / company_settings / section_templates / excel_import |

**既存モジュール実体移動（逆shim修正）**
| モジュール | 内容 |
|-----------|------|
| `modules/schedule/` | gantt_router / schedule_router（api/v1から実体移動） |
| `modules/site/` | attendance / progress / daily_reports（api/v1から実体移動） |
| `modules/purchase/routers/orders.py` | 発注書CRUD（api/v1/purchase.py から移動） |
| `modules/estimate/routers/acknowledgments.py` | 注文請書 |
| `modules/estimate/services/quote_reflect.py` | 見積反映ヘルパー |

**main.py 全面書き換え**
- `app.api.v1.*` からの全 import を廃止
- `modules/*` から直接 `include_router` する構造に変更
- health チェックをインライン化

**フロント修正（ビルドエラー解消）**
- `QCDSExpensePanel.tsx`: `ExpenseRow` を export（Section C で使用）
- `SectionBlock.tsx`: `ItemRow` を export（大項目未割当明細で使用）

**VPS デプロイ（SCP 手動転送）**
- `cmv3-api` / `cmv3-web` とも `Image Built` + `Application startup complete` を確認

**git tag**: `v1-modular-complete`

### 変更ファイル
- `backend/app/main.py` — 全面書き換え（modules/* から include_router）
- `backend/app/modules/` — report / customer / vendor / auth / admin 追加 + schedule / site / purchase 実体化
- `frontend/src/modules/estimate/QCDSExpensePanel.tsx` — ExpenseRow を export
- `frontend/src/modules/estimate/SectionBlock.tsx` — ItemRow を export
- `frontend/src/app/projects/[id]/qcds/page.tsx` — ExpenseRow import 追加
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — ItemRow import 追加

### コミット
- 672e482: Phase 7 モジュール集約（main.py + 全モジュール）
- f4bf64b: ビルドエラー修正（ExpenseRow / ItemRow export）
- git tag: v1-modular-complete

### 残留事項（意図的に対応しない）
- `backend/app/api/v1/` ディレクトリ: main.py から参照されなくなったため実質デッドコード。動作に影響なし。削除はリスク評価後に任意で行う。
- `backend/app/models/*.py` の re-export shim（base / enums / history）: 77ファイルが旧パスで import しているため削除せず維持。削除より現状維持が安全。

### 次のアクション
- https://cmv3.fact-ally.com で全画面の動作確認（QCDS / 顧客見積 / 業者見積 / 帳票 / ダッシュボード）
- Phase 7 チェックポイント確認:
  - [ ] 注文書 CRUD + PDF 出力 正常
  - [ ] 請求書 CRUD + 入金記録 + PDF 出力 正常
  - [ ] ダッシュボード KPI / チャート / 未払いアラート 正常
  - [ ] Excel インポート 正常

---

## Session 2026-06-03 — 注文書・注文請書 各種バグ修正・機能追加

### 作業内容

**注文書（Order）**
- acknowledged ステータス削除（Alembic migration r2s3t4u5v6w7: 既存レコードを sent に変換・enum 再作成）
- ステータスを draft/sent/signed/cancelled の4択に整理
- 「発行済み」ステータスタップで注文請書を自動発行（422 エラー修正: バックエンドで sent|signed を許可）
- 注文書と注文請書は同時発行する業務フローに対応
- 一覧にチェックボックス追加・選択削除（DELETE エンドポイント新設）

**注文請書（Acknowledgment）**
- 選択維持: `loadAcks(keepSelectedId?)` 対応（保存後も選択 ACK を維持）
- PDF ボタン追加（赤・/acknowledgments/{id}/export-pdf）
- PDFレイアウト刷新: 注文請書専用テンプレート（左:顧客宛+案件情報, 右:収入印紙+弊社情報+約款, 縦線なし）
- PDF 2ページ目余分ライン削除（main-content の border-top を除去）
- タブカウント修正: 0固定 → DB実数カウント
- 一覧にチェックボックス追加・選択削除（DELETE エンドポイント新設）
- 案内文修正:「サイン受領済」→「発行済み」で自動発行する旨に変更

### 変更ファイル
- `backend/alembic/versions/r2s3t4u5v6w7_remove_acknowledged_status.py` — migration
- `backend/app/shared/models/enums.py` — acknowledged 削除
- `backend/app/modules/report/routers/orders.py` — sent|signed 許可・DELETE endpoint
- `backend/app/modules/report/services/pdf_export.py` — 注文請書専用 _render_acknowledgment_html・_ACK_CSS
- `backend/app/modules/project/router.py` — acknowledgment_count 実数化
- `backend/app/modules/estimate/routers/acknowledgments.py` — DELETE endpoint
- `frontend/src/types/order.ts` — acknowledged 削除
- `frontend/src/app/projects/[id]/order/page.tsx` — 選択削除・ステータス整理
- `frontend/src/app/projects/[id]/acknowledgment/page.tsx` — PDF ボタン・選択削除・選択維持

### 次のアクション
- 注文書・注文請書の全フロー動作確認
- 請求書ページの修正（必要であれば）

---

## Session 2026-06-03 — 顧客見積書レイアウト全面改修・承認ワークフロー修正

### 作業内容

#### レイアウト（quote.html 完全準拠）
- 左カラムを `display: flex; flex-direction: column; gap: 12` に変更（quote.html `.q-grid` 左列準拠）
- 右カラムを `position: sticky` から `display: flex; flex-direction: column; gap: 0` に変更
- 見積条件書カードを**左カラム内**（sections 直後）へ移動（従来は2カラムグリッド外・右カラム内に誤配置）
- テンプレート選択モーダルをグリッド外（AppShell 直下）へ移動し、正しくポータル表示
- 見積書ヘッダーカードの `marginBottom: 12` を削除（flex gap で管理）
- JSX の div 入れ子を修正（旧コードは見積条件書・showTmplModal が右カラム内に誤ネストされていた）

#### 承認ワークフロー修正
- **Backend**: `create_approval_request` で step1 の approver が依頼者本人の場合、自動承認（`status="approved"`, `decided_at=now`）し、通知は step2 以降に送信 → 自己通知・自己依頼バグを解消
- **Frontend**: `onSent` コールバックで `load()` を呼び出し → 承認依頼送信後に承認ステータスバーが即時表示されるよう修正
- **AppShell**: 通知パネルの通知アイテムに `onClick` 追加 → `related_type === "approval_request"` の場合に `/approvals` ページへ遷移

### 変更ファイル
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — レイアウト全面改修・onSent修正
- `backend/app/api/v1/approvals.py` — 自己承認ロジック追加
- `frontend/src/components/layout/AppShell.tsx` — 通知クリックで/approvals遷移

### 次のアクション
- VPS デプロイ後に顧客見積書ページの動作確認（左カラム・右カラムのトップ横並び・見積条件書の位置）
- 承認依頼フローのエンドツーエンド確認（step1自動承認・バー表示・通知クリック）

---

## Session 2026-06-03 — 承認ワークフロー全面改修

### 作業内容

#### バグ修正: 承認してもQuote/PDFに反映されない
- **根本原因**: `decide_approval_step` がワークフロー（ApprovalStep）のみ更新し、Quote のスタンプフィールド（`person_in_charge_id` / `reviewer_id` / `approver_id`）を同期していなかった
- **修正**: `_ROLE_TO_STAMP` マッピングを追加し、ステップ承認時に対応する Quote フィールドも更新するよう修正

#### Backend 拡張 (approvals.py)
- `ApprovalRequestRead` に `project_id`・`quote_number`・`project_name` を追加（顧客見積ページへのリンクに必要）
- `_req_read(r, quote)` が Quote オブジェクトを受け取り、上記フィールドを返すよう変更
- 全エンドポイント（list / create / decide / withdraw）で Quote を一緒にロードして `_req_read` に渡す
- `my_approvals` エンドポイント:
  - withdrawn 案件を「あなたの承認待ち」から除外
  - `requested_by_me` で pending のみでなく approved（完了済み）も取得
  - `completed` キーを追加（承認済み依頼一覧）
  - 全 quote_id を一括 IN クエリでロードしてパフォーマンス改善

#### 承認待ちページ全面再設計 (approvals/page.tsx)
- タブ廃止 → 1ページにセクション4つ（折りたたみ可能）：
  - あなたの承認待ち（黄色、デフォルト展開）
  - 差戻された案件（赤、デフォルト展開）
  - あなたが依頼中（青、デフォルト展開）
  - 完了済み（緑、デフォルト折りたたみ）
- 各カード行をクリック → `/projects/{project_id}/quote/{quote_id}` に遷移
- 「あなたの役割」バッジ表示（担当・確認・承認 のうち現在ユーザーが担当するもの）
- ステップチップに「あなた」ラベルと pending 時の黄色ハイライトを追加

#### ApprovalStamps コンポーネント改善
- メタテキストを「次の未押印者名 の承認待ち · 承認後にこの位置に印影が押されます」に変更
- 全承認済みは緑色で「全員承認済み」表示
- N/M 承認済み + 次の待ちユーザー名を同時表示

### 変更ファイル
- `backend/app/api/v1/approvals.py` — スタンプ同期・schema拡張・my_approvals完了済み追加
- `frontend/src/app/approvals/page.tsx` — 全面再設計
- `frontend/src/modules/estimate/ApprovalStamps.tsx` — メタテキスト改善

### 次のアクション
## Session 2026-06-03 — アーキテクチャ違反修正（監査対応）

### 作業内容

#### Fix 1: cross-module import 解消（Rule 1）
- `modules/project/router.py` が `modules/estimate/services/quote_service` を直接 import していた違反を解消
- `create_initial_quote` 関数を `shared/services/quote_init.py` に移動
- `modules/project/router.py` → `app.shared.services.quote_init` から import に変更
- `modules/estimate/services/quote_service.py` → `shared` からの re-export shim に変更（後方互換）

#### Fix 2: fmtYen/fmtNum 未使用（Rule 3）
- `qcds/page.tsx` に独自定義されていた `yen(v)`・`numStr(v)` 関数を削除
- `fmtYen`, `fmtNum` を `@/lib/format` から import
- `yen(v)` → QCDS 固有の 0="—" 処理のみの薄いアダプタとして残し、内部は `fmtYen` を使用
- `numStr(v)` → `fmtNum(v)` に全て置換（replace_all）
- inline `toLocaleString()` を全て `fmtYen` / `fmtNum` に置換（KPI strip・原価階段・シナリオテーブル）

### 変更ファイル
- `backend/app/shared/services/quote_init.py` — 新規作成（create_initial_quote を shared 層へ）
- `backend/app/modules/project/router.py` — import 先を shared に変更
- `backend/app/modules/estimate/services/quote_service.py` — re-export shim に変更
- `frontend/src/app/projects/[id]/qcds/page.tsx` — fmtYen/fmtNum 統一

---

- 承認フローの動作確認（承認 → 顧客見積のスタンプ反映・PDF反映）
- 承認待ちページで顧客見積へのリンクが機能するか確認
- テストデータの承認依頼が複数溜まっている場合、withdrawまたは完了させてクリーンアップ

---

## Session 2026-06-03 — Phase B-3-3 / Phase C-4-4 実装開始前記録

### 12_VSCode変更指示書 実施状況（2026-06-03 現在）

| Phase | スコープ | 状態 |
|---|---|---|
| Phase A | 案件サブナビゲーション | ✅ 完了（layout.tsx + ProjectSubNav.tsx）|
| Phase B | スキャン-QCDS連動 | ⚠ 一部完了 |
| ↳ B-1 | DB スキーマ（soft_delete, source_scan_result_id）| ✅ マイグレーション済み |
| ↳ B-2 | bulk-apply / bulk-delete API | ✅ 実装済み |
| ↳ B-3-1 | スキャン一覧チェックボックス・一括操作 | ✅ 実装済み |
| ↳ B-3-2 | スキャン詳細→一覧自動遷移 | ✅ 実装済み |
| ↳ **B-3-3** | **QCDS 1業者=1行グロス + アコーディオン明細** | ❌ **未実装** |
| Phase C | 顧客マスタ | ⚠ 一部完了 |
| ↳ C-1〜C-3 | DBスキーマ・API | ✅ 実装済み |
| ↳ C-4-1/2/3 | 顧客一覧・詳細・検索コンポーネント | ✅ 実装済み |
| ↳ **C-4-4** | **案件新規作成→顧客マスタ連携（client_id 連携）** | ❌ **未実装** |
| Phase D | 帳票連動・注文請書 | ✅ 完了 |
| Phase E | 見積書階層構造・テンプレ | ✅ 完了 |
| Phase F | 複数請求書・ステータス | ⚠ 基本機能のみ |

### 今セッションの実装スコープ
1. **B-3-3**: QCDS 直接工事費テーブルに [▼] ボタン追加 → source_scan_result_id がある行をアコーディオン展開して scan_result_items の明細を表示
2. **C-4-4**: `CreateProjectModal` に顧客検索選択を追加 → 案件作成時に `client_id` を設定

### 実装結果

#### B-3-3 (QCDS アコーディオン)
- **調査の結果、既に実装済みであることを確認** — `QCDSDirectWorkTable.tsx` に `▼/▶` トグルボタン + `toggleRow()` 関数 + `scanItems` state が実装済みだった
- `qcds/page.tsx` に `expandedRows`, `scanItems`, `toggleRow` が実装済みであることを確認
- 対応不要（完了済み）

#### C-4-4 (案件作成→顧客マスタ連携)
- `CreateProjectModal.tsx` の「発注者」フィールドをフリーテキスト → **顧客マスタ検索コンポーネント**に改修
- インクリメンタルサーチ（300ms デバウンス） → `/api/v1/clients/search?q=&limit=8` を呼び出し
- 候補サジェストリスト（顧客名 + コード）
- 顧客選択時: `client_id` を POST body に含める + 「✓ マスタ連携済」バッジ表示
- 未選択時: 旧来の `client_name` フリーテキストとして送信（後方互換）
- 「解除」ボタンで連携クリア

### 変更ファイル
- `frontend/src/modules/project/CreateProjectModal.tsx` — 顧客マスタ連携検索に改修

---

## Session 2026-06-03 — 工事台帳設計提案（Phase G）

→ ユーザーより工事台帳タブ（Phase C 以降）の設計依頼を受領。次セッションにて設計提案を実施予定。

---

---

## Session 2026-06-03 — 承認ワークフロー追加修正・印影プレビュー全面改修

### 作業内容

#### 承認依頼モーダル改善
- 既存スタンプ（`personInChargeId` / `reviewerId` / `approverId`）を自動入力
- 前回承認済みのステップはグリーンボーダー＋「✓ 承認済」バッジで視覚化
- バリデーションメッセージを分割（「担当者を選択してください」「承認者を選択してください」）

#### Backend: 既存スタンプ済みユーザーの自動承認
- `create_approval_request` で既にスタンプ済みの同一ユーザーを選択した場合、自動承認
- 通知は最初の pending ステップへ送信

#### 承認待ちページ全面改修
- セクション見出しを常時表示（空でも「該当する依頼はありません」メッセージ表示）
- count=0 のセクションはデフォルト折りたたみ
- セクション順: 承認待ち → 依頼中 → 差し戻し → 完了済み
- ローディング完了後は常にセクション表示（空ページにならない）

#### 印影プレビュー全面改修
- **押印機能を完全廃止** → 純粋な表示コンポーネント化
- `stampTarget` / `stampLoading` / `handleStamp` 削除（state・関数とも削除）
- 担当スタンプ: `project.sales_person_id` から自動表示（押印操作不要）
- 「の承認待ち」テキスト: `approvalRequests` の pending step から正しい承認者名を取得
  - 旧: Quote のスタンプフィールドから推測（未承認なら null のため間違いが発生）
  - 新: `approvalRequests.find(pending).steps.find(pending).approver_name` で正確に表示
- 承認依頼なし → 「承認依頼を送信すると印影が配置されます」

### 変更ファイル
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx` — ApprovalModal既存スタンプ自動入力・stampハンドラ削除
- `backend/app/api/v1/approvals.py` — 既存スタンプ済みユーザーの自動承認
- `frontend/src/app/approvals/page.tsx` — セクション常時表示・順序修正
- `frontend/src/modules/estimate/ApprovalStamps.tsx` — 全面改修（純粋表示化）

### 次のアクション
- 承認依頼 → 奴間 正人の承認待ち が正しく表示されるか確認
- 見積ヘッダーの担当者変更 → 印影プレビューへの反映確認
- 承認待ちページの4セクション常時表示確認

---

## Session 2026-06-04 — 出面台帳バグ修正・実装ロードマップ設計書作成

### バグ修正（出面台帳）

1. **業者欄が空白になる問題**
   - 原因: `Vendor.name` で参照していたが、API は `vendor_name` を返している型ミス
   - 修正: `interface Vendor { name: string }` → `vendor_name: string` + option タグの表示名を修正

2. **月カレンダーが小さくて見にくい問題**
   - 原因: `input type="month"` がブラウザ標準UIで小さい
   - 修正: `‹ 2026年6月 › 今月` カスタムナビゲーターに変更

### 設計書作成

- `docs/13_実装ロードマップ_2026.md` を新規作成
  - Phase F-R（請求書入金管理）
  - Phase G（工事台帳 — DB・API・フロントエンド・PDF/Excel出力）
  - Phase H（出面台帳強化 — QCDS/カレンダー/日報連携）
  - Phase I（CSV出力・会計ソフト連携 — 最終Phase）
  - Phase J（権限制御強化）
  - 工事台帳の手動入力/自動取得の視覚区別ルール
  - 未決定事項（表4レイアウト・会計ソフト名など）確認リスト

### 変更ファイル
- `frontend/src/app/projects/[id]/attendance/page.tsx` — バグ修正2件
- `docs/13_実装ロードマップ_2026.md` — 新規作成

### 次のアクション
- 出面台帳の動作確認（業者名表示・月ナビゲーター）
- ひささんより表4のスクショ・会計ソフト情報を受領後、設計書を更新
- Phase F-R（請求書入金管理）から実装開始を検討

---

## Session 2026-06-04（続き）— Phase F-R 確認・Phase G 工事台帳 G-1〜G-3 実装

### 作業内容

#### Phase F-R 完了確認
- バックエンド（migration d1e2f3a4b5c6・invoices.py）・フロントエンド（invoice/page.tsx・invoice/[invoice_id]/page.tsx）とも実装済みを確認
- 動作確認チェックリスト5項目すべてコード上で確認（入金記録追加・自動ステータス遷移・invoice-summary ビュー）
- 設計書の F-R セクションを「✅ 実装確認済み」に更新

#### Phase G-1: DBスキーマ
- migration `u5v6w7x8y9z0`: `project_ledger_meta` / `ledger_approvals` 新規作成
- 既存カラムとの重複整理（original_client_name / prev_construction_year 等は `projects` 既存）
- `models/ledger.py` 新規作成（ProjectLedgerMeta / LedgerApproval）
- `models/project.py` + `__init__.py` にリレーション追加

#### Phase G-2: API
- `modules/project/ledger_router.py` 新規作成（4エンドポイント）
  - `GET /projects/{id}/ledger` — 工事台帳全データ集約
  - `PATCH /projects/{id}/ledger/meta` — 手動入力フィールド更新
  - `POST /projects/{id}/ledger/approve` — 承認スタンプ押印
  - `DELETE /projects/{id}/ledger/approve/{role_label}` — 押印取消

#### Phase G-3: フロントエンド
- `frontend/src/types/ledger.ts` — 型定義
- `frontend/src/app/projects/[id]/ledger/page.tsx` — 工事台帳ページ
  - 左カラム: 基本情報（工事番号〜当社担当）、手動入力フィールド（黄背景＝未入力）
  - 右カラム: 承認スタンプ4枠（押印・取消）、案件/受注情報、目標営業利益
  - 工事割出3列テーブル（実行予算・取決見通・精算見通）
  - 表4統合テーブル（実行予算+取決見通+月別精算）
- `ProjectSubNav.tsx` に「工事台帳」タブ追加

### 設計差異（設計書に追記）
- `project_ledger_meta` は重複フィールドを除外（5フィールドのみ追加）
- `agreement_checked`・`payment_completed` は `qcds_direct_works` に既存 → 追加不要
- `award_date` は `projects` に未存在 → 将来対応

### コミット
- `0fac380`: feat: Phase G 工事台帳 G-1〜G-3 実装

### 次のアクション
- VPS デプロイ（migration u5v6w7x8y9z0 適用 + cmv3-api/web rebuild）
- 工事台帳ページ動作確認（案件一覧 → 案件詳細 → 工事台帳タブ）
- Phase G-4: PDF/Excel 出力（WeasyPrint / openpyxl）
- 残確認事項 Q2〜Q5（PDFレイアウト・天候KY・会計ソフト名・出来高請求）をひささんに確認

---

## Session 2026-06-04（続き）— Phase G VPS デプロイ・動作確認

### 作業内容

**デプロイ手順**
1. ソースを tar.gz 圧縮（467KB）→ SCP 転送 → サーバーで展開
2. `cmv3-api` リビルド → 起動時の `uv run alembic upgrade head` で migration `u5v6w7x8y9z0` 自動適用
3. TypeScript ビルドエラー修正（`TD` コンポーネントの `colSpan` prop 未定義）→ 修正後 `cmv3-web` リビルド
4. `docker restart cmv3-nginx`

**動作確認（全項目 OK）**
- `GET /api/v1/health` → HTTP 200
- migration `u5v6w7x8y9z0 (head)` 適用確認
- `project_ledger_meta` / `ledger_approvals` テーブル存在確認（2案件×4枠=8行 初期データ）
- `GET /projects/{id}/ledger` → 承認枠4件・直接工事費4行を正常返却
- `POST /projects/{id}/ledger/approve` → 押印 OK（approved_at 記録確認）
- `DELETE /projects/{id}/ledger/approve/{role}` → 取消 OK（204）
- 工事台帳ページ HTTP 200 + サブナビ「工事台帳」タブ HTML 内に存在確認

**修正したバグ（TypeScript ビルドエラー）**
- `TD` コンポーネントが `colSpan` を受け付けない → `colSpan?: number` を追加

### 変更ファイル
- `frontend/src/app/projects/[id]/ledger/page.tsx` — colSpan 修正

### 次のアクション
- ブラウザで工事台帳ページの目視確認
- Phase G-4: PDF/Excel 出力
- 残確認事項 Q2〜Q5 をひささんに確認

---

## Session 2026-06-04（続き）— 前セッション再開・コミット

### 作業内容
- セッション再開: 前セッション（API制限でストップ）の状態を確認
  - Phase G 設計書はスクショ確認後の更新まで完了していた（Edit 完了後に API エラー）
  - 2セッション分（2026-06-03・2026-06-04）の変更が未コミットだった
- `docs/13_実装ロードマップ_2026.md` の未決定事項 Q1 を確認済みに更新
  - 表4スクショ確認済み（実行予算表13行・取決見通表・月別精算見通表の統合テーブル）
- 2セッション分を2コミットに整理

### コミット
- `165153b`: feat: 承認ワークフロー全面改修・アーキテクチャ修正（2026-06-03）
- `8afb85d`: feat: 出面台帳バグ修正・実装ロードマップ設計書作成（2026-06-04）

### 次のアクション
- Phase F-R（請求書入金管理）または Phase G（工事台帳）の実装開始
  - Q2（PDFレイアウト）/ Q3（天候KY） / Q4（会計ソフト名） / Q5（出来高請求パターン）はひささんに確認要
- VPS デプロイ（session 2026-06-03 の承認ワークフロー改修を本番に反映）

---

## Session 2026-06-04（続き）— 工事台帳 全面改修・デプロイ

### 作業内容

ひささんからのフィードバック①〜⑧ + 取決チェックボタン修正を一括実装・デプロイ。

| # | 変更内容 | 実装場所 |
|---|---|---|
| ① | タブ位置を詳細とQCDSの間に移動 | ProjectSubNav.tsx |
| ② | 承認: 4枠独立の押印依頼フロー（通知送信・押印権限チェック） | migration + ledger_router + page |
| ③ | 各フィールドをクリックで個別編集（グローバル編集ボタン廃止） | ledger/page.tsx |
| ④ | 現場経費: QCDSから6項目自動計算 + クリックで個別上書き | ledger_router + page |
| ⑤-1 | 取決金額: セルクリックでインライン編集 | page + PATCH /direct-works/{id} |
| ⑤-2 | 支払開始月: ドロップダウンで選択 → 右6ヶ月分表示 | page |
| ⑤-3 | 支払計: 今月以前の月のみ合計（isPastOrCurrent） | page |
| ⑥ | 案件=顧客見積自動取得、受注=注文請書自動取得 | ledger_router（Acknowledgment クエリ追加） |
| ⑦ | 工事価格=注文請書金額優先表示 | ledger_router |
| ⑧ | 右上の全体編集ボタン削除 → 各フィールド個別編集ボタン | page |
| + | 取決済チェックボックスをクリック動作に変更 | page + PATCH API |

### migration
- `v6w7x8y9z0a1`: ledger_approvals に approver_user_id/requested_by_id/requested_at 追加
- `v6w7x8y9z0a1`: project_ledger_meta に expense_overrides JSONB 追加

### デプロイ確認
- migration v6w7x8y9z0a1 (head) 適用確認
- 新カラム (approver_user_id / requested_by_id / requested_at) DB確認済み
- API HTTP 200 / Web HTTP 200 確認済み

### コミット
- `cf0e5db`: feat: 工事台帳 全面改修

### 次のアクション
- ブラウザで工事台帳ページの目視確認（承認依頼・経費内訳・表4インライン編集）
- Phase G-4: PDF/Excel 出力
- 残確認事項 Q2〜Q5

---

## Session 2026-06-04（続き）— 注文書ページ 2カラムレイアウト全面改修・デプロイ

### 作業内容
- 注文書ページをスクショ準拠の2カラムレイアウトに全面改修
  - **ヘッダー**: 注文番号 + タイトル（宛先会社名 様向け 注文書） + ステータスドロップダウン + PDF/Excel/保存ボタン
  - **進捗ステップバー**: 下書き → 送付済 → 先方押印 → 受領済 の4ステップ
  - **2カラムボディ**:
    - 左: 発注先・件名フォーム（会社名・担当者・登録番号・件名・工事場所・工期・支払条件・備考）
    - 右: 注文金額カード（primary色・税込大表示・税抜入力）+ 印紙税 + 注文請書発行バナー
  - 約款カードは削除（スクショに不要）
  - 明細は削除（ユーザー指示）
  - 左サイドバー（注文書一覧）は維持

### デプロイ確認
- cmv3-web リビルド・nginx 再起動完了
- 注文書ページ HTTP 200 確認済み

### コミット
- `f277b0d`: feat: 注文書ページ — スクショ準拠の2カラムレイアウトに全面改修

### 次のアクション
- ブラウザで注文書ページの目視確認
- Phase G-4: PDF/Excel 出力（工事台帳）
- 残確認事項 Q2〜Q5

---

## Session 2026-06-04（続き）— 設計書作成・機能拡張設計・実装開始

### 作業内容

**設計書整備**
- 直前セッション（設計書作成セッション）の引き継ぎ: 5設計書（01〜05）を `docs/specs/` に移動
- 設計書ヒアリング（ひささん Q&A 5問）実施
  - Q1: 工事台帳承認 → 任意ユーザーを都度選択
  - Q2: 取決金額 = 発注書合計
  - Q3: 変更理由入力欄 → なし
  - Q4: 承認ルート = 担当者がすべての承認依頼を行うフロー
  - Q5: 印影設定 → 全帳票に自動反映
- 追加要件: 権限ロールの複数選択対応
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md` 新規作成

**Phase 1 実装（DB基盤・Backend・Frontend）**
- Alembicマイグレーション `w7x8y9z0a1b2` 新規作成:
  - `users.roles userrole[]` 追加（複数ロール対応）
  - `users.stamp_text / stamp_style` 追加（印影設定）
  - `ledger_approvals` 承認枠を4枠→5枠に変更（担当→現場担当 + 営業担当追加）
- `backend/app/models/user.py`: `roles[]`, `stamp_text`, `stamp_style` カラム追加
- `backend/app/schemas/user.py`: `UserCreate/Update/Read` に `roles[]`, `stamp_*` 追加
- `backend/app/shared/services/permissions.py`: 新規作成（`has_role()`, `require_roles()`, `is_admin()` etc.）
- `backend/app/modules/admin/router.py`: 複数ロール対応・印影CRUD対応
- `backend/app/modules/project/ledger_router.py`: `LEDGER_ROLE_LABELS` を5枠に更新・権限チェックを `has_role()` に移行
- `frontend/src/types/auth.ts`: `UserRole`, `User` に `roles[]`, `stamp_*` 追加、`ROLE_LABEL/COLOR` 定数追加
- `frontend/src/app/admin/page.tsx`: 新規作成（admin.html準拠の統合管理ページ）
  - 左ナビ: 組織/マスタ/運用の3グループ、10セクション
  - ユーザー管理: 複数ロール選択UI（チェックボックスグループ）・印影設定・スタンププレビュー
  - 会社情報: 旧 /admin/company と同等
  - 印紙税表・見積条件文: 旧機能をマージ
  - 承認ルート/基本契約約款/QCDSテンプレート/監査ログ/バックアップ/システム状態: 準備中（次フェーズ）
- `frontend/src/components/layout/AppShell.tsx`:
  - NAV_ADMIN を `/admin/users`, `/admin/import`, `/admin/company` の3件 → `/admin` 1件に統合
  - 管理者権限チェックを `roles[]` 配列対応に更新
- `frontend/src/app/projects/page.tsx`:
  - 「Excelインポート」ボタンを「新規案件」横に追加（インラインモーダル）
  - `ExcelImportContent` コンポーネントをページ内定義（D&D + 自動インポート）
- `frontend/src/app/projects/[id]/page.tsx`:
  - 工事台帳承認スタンプ5枠カード（右カラム・工事価格の上）追加
  - 見積書承認ステータス ミニパネル（工事割出サマリー末尾）追加
  - クイックリンクカード削除
  - 押印依頼モーダル追加
  - `canEdit` 判定を複数ロール対応に更新
- `frontend/src/app/projects/[id]/history/page.tsx`: 5W1H形式に改修
  - 誰が/何を/いつ/どのように の4項目（WHYは省略）

### 変更ファイル
- `docs/specs/` — 設計書5本を移動（新規フォルダ作成）
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md` — 新規
- `backend/alembic/versions/w7x8y9z0a1b2_multi_role_stamp_ledger5.py` — 新規
- `backend/app/models/user.py` — roles[], stamp_text/style 追加
- `backend/app/schemas/user.py` — 更新
- `backend/app/shared/services/permissions.py` — 新規
- `backend/app/modules/admin/router.py` — 複数ロール・印影対応
- `backend/app/modules/project/ledger_router.py` — 5枠更新
- `frontend/src/types/auth.ts` — roles[] 対応
- `frontend/src/app/admin/page.tsx` — 新規（統合管理画面）
- `frontend/src/components/layout/AppShell.tsx` — NAV_ADMIN 統合
- `frontend/src/app/projects/page.tsx` — Excelインポートモーダル追加
- `frontend/src/app/projects/[id]/page.tsx` — 工事台帳承認・見積承認mini・QLink削除
- `frontend/src/app/projects/[id]/history/page.tsx` — 5W1H形式

### 次のアクション
- VPS デプロイ（Alembicマイグレーション w7x8y9z0a1b2 適用）
- `/admin` ページの動作確認（ユーザー管理・印影設定・会社情報）
- 工事台帳→案件詳細マージの残タスク（next session）:
  - 取決見通表（vtbl）の全幅テーブルを案件詳細ページに追加
  - 取決金額↔発注書自動連動ロジック（`services/qcds_sync.py`）
  - QCDSページから ledger タブへのリダイレクト設定
- admin.html: 承認ルート/基本契約約款/QCDSテンプレート/監査ログ/バックアップ/システム状態の実装

---

## Session 2026-06-04（続き）— 次セッションタスク一括実行

### 作業内容

**取決見通表（vtbl）を案件詳細ページに追加**
- `/projects/[id]/page.tsx` の 2カラムグリッド直下に取決見通表を追加
- 支払開始月ドロップダウン（ヘッダー先頭、デフォルト4月）
- 残支払列: `payment_completed` または 月別合計≥取決金額 で「済」表示（緑）
- テーブル幅100%（minWidth撤廃）
- 取決チェックボックス列は削除（agreement_checked カラムは維持）
- フッター行: 直接工事費 計 合計行

**取決金額 ↔ 発注書 自動連動**
- `backend/app/shared/services/qcds_sync.py` 新規作成
  - `sync_agreed_amount_from_orders()`: 業者別発注書合計 → QCDS agreed_amount に自動反映
- 発注書 create / update / delete の3エンドポイントにフック追加

**Admin 未実装セクション 全実装**
- `backend/app/modules/admin/audit_router.py` 新規作成:
  - `GET /admin/audit-log` 監査ログ一覧（ページネーション）
  - `GET /admin/audit-log/export-csv` CSV エクスポート（UTF-8 BOM付き）
  - `GET /admin/system-status` DBバージョン・テーブル数・稼働確認
- Alembicマイグレーション `x8y9z0a1b2c3`:
  - `company_settings.approval_route_config` JSONB 追加（3ステップ初期値）
  - `contract_clauses` テーブル作成（第1〜9条デフォルト挿入）
  - `qcds_templates` テーブル作成（標準テンプレート挿入）
- `backend/app/modules/admin/router.py` に6エンドポイント追加:
  - 承認ルート GET/PATCH
  - 基本契約約款 GET/PATCH
  - QCDSテンプレート GET/POST/PATCH
- `frontend/src/app/admin/page.tsx` に6セクション実装:
  - 承認ルート: ステップ別ロールチェックボックス・保存
  - 基本契約約款: インライン編集（第1〜9条）
  - QCDSテンプレート: 一覧表示・追加フォーム・経費率表示
  - 監査ログ: ページネーション付き一覧・CSV出力ボタン
  - バックアップ: 手動実行UI（VPS コマンド表示）
  - システム状態: DB接続・バージョン・テーブル数確認

**VPS デプロイ完了**
- tar.gz 差分転送 → `tar -xzf` 展開
- `cmv3-api` リビルド → migration `w7x8y9z0a1b2`, `x8y9z0a1b2c3` 自動適用（head 確認済み）
- `cmv3-web` リビルド（TypeScript エラー修正: `loadProjects` → `fetchProjects(1, filterStatus, searchQ)`）
- 動作確認: API 200 / Web 200 / migration head: `x8y9z0a1b2c3` ✅

### 変更ファイル
- `backend/alembic/versions/w7x8y9z0a1b2_multi_role_stamp_ledger5.py` — 前セッション分（VPS適用済み）
- `backend/alembic/versions/x8y9z0a1b2c3_admin_features.py` — 新規
- `backend/app/shared/services/qcds_sync.py` — 新規
- `backend/app/modules/admin/audit_router.py` — 新規
- `backend/app/modules/admin/router.py` — 承認ルート・約款・QCDSテンプレートAPI追加
- `backend/app/modules/purchase/routers/orders.py` — 発注書フック追加
- `backend/app/main.py` — audit_router 登録
- `frontend/src/app/admin/page.tsx` — 6セクション実装
- `frontend/src/app/projects/page.tsx` — ExcelImport onImported 修正
- `frontend/src/app/projects/[id]/page.tsx` — 取決見通表追加・LedgerDirectWork型追加

### 次のアクション
- ブラウザで以下を確認:
  - `/admin` → 承認ルート・基本契約約款・QCDSテンプレート・監査ログ・システム状態
  - `/projects/[id]` → 取決見通表の表示（工事台帳承認スタンプ・見積書承認ミニも確認）
- ユーザー管理で「権限ロール」複数選択が保存されるか確認
- 発注書を更新したときに QCDS 取決金額が自動反映されるか確認

---

## Session 2026-06-04（続き）— バグ修正5件

### 修正内容

1. **残支払「済」バグ** (`projects/[id]/page.tsx`)
   - `agreed_amount == null` または `paySum == 0` のときも「済」になっていた
   - 修正: `agreed_amount != null && agreed_amount > 0 && paySum > 0 && remaining <= 0` に変更

2. **発注書保存 500 エラー** (`qcds_sync.py`)
   - `PurchaseOrderStatus.cancelled` が存在しない Enum 値でエラー
   - 修正: `status.in_([issued, partial_delivered, delivered])` に変更

3. **管理者設定 404 エラー** (`admin/page.tsx`)
   - `apiFetch("/admin/...")` が `/api/v1` なしで Next.js ページに到達
   - 修正: 全 `apiFetch` 呼び出しに `/api/v1` プレフィックスを追加

4. **承認スタンプデザイン変更** (`projects/[id]/page.tsx`)
   - 縦リストから印影プレビュースタイル（横グリッド・丸スタンプ）に変更

5. **承認待ち「完了済み」に表示されない** (`approvals.py`)
   - 自分が依頼者ではなく承認者として参加した案件が表示されていなかった
   - 修正: `approved_as_approver` クエリを追加し、自分が承認ステップに参加 & status=approved のものも `completed` に含める

6. **詳細タブ→「工事台帳」に名称変更** (`ProjectSubNav.tsx`)
   - `getTabs()` の先頭エントリのラベルを「詳細」→「工事台帳」に変更

### 変更ファイル
- `backend/app/shared/services/qcds_sync.py`
- `backend/app/api/v1/approvals.py`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/projects/[id]/page.tsx`
- `frontend/src/modules/project/ProjectSubNav.tsx`

### デプロイ
- cmv3-api restart + cmv3-web rebuild → API 200 / Web 200

---

## Session 2026-06-04（続き）— 管理者設定CRUD・精算入力・取決連動修正

### 修正内容

**1. 工事台帳承認依頼が依頼中に反映されない**
- `ledger_router.py` に `GET /ledger-approvals/pending-for-me` エンドポイント追加
- `approvals/page.tsx` に「工事台帳 押印依頼」セクション追加
- `Promise.all` で quote 承認 + ledger 承認を同時取得

**2. 取決金額が発注書から反映されない**
- `qcds_sync.py` に `vendor_name_snapshot` でのフォールバックマッチング追加
- QCDS行に vendor_id が未設定でも vendor_name で部分一致して更新

**3. 精算(支払)見通セルが入力できない**
- 月別支払セルをクリックでインライン編集可能に改修
- `editingPayCell / editingPayValue` state 追加
- Enter/Escape/onBlur で `PATCH /projects/{id}/ledger/direct-works/{id}` を呼んで保存

**4. 管理者設定マスタの CRUD 整備**
- 印紙税表: 行追加（フォーム）・削除ボタン追加、法改正時の手動更新説明追加
- 見積条件文: 追加・編集・削除（有効/無効）の完全CRUD実装
- QCDSテンプレート: 全フィールドの編集フォーム実装（経費率・保険料率・固定費）

### 変更ファイル
- `backend/app/shared/services/qcds_sync.py` — vendor_name フォールバック
- `backend/app/modules/project/ledger_router.py` — pending-for-me エンドポイント追加
- `frontend/src/app/approvals/page.tsx` — 工事台帳押印依頼セクション
- `frontend/src/app/projects/[id]/page.tsx` — 月別支払インライン編集
- `frontend/src/app/admin/page.tsx` — 印紙税・見積条件文・QCDS CRUD
- `backend/app/modules/purchase/routers/orders.py` — _sync_after_status_change（issue/delivered/paid 全ステータス変更後に取決連動）

### デプロイ
- commit: d77ebee（Phase1拡張・Admin強化・取決連動修正・バグ修正）+ GitHub push
- SCP → `/root/cmv3` 展開 → cmv3-api restart + cmv3-web rebuild
- `✅ API /health 200 / Web 200`

### 次のアクション
- https://cmv3.fact-ally.com で動作確認:
  - 発注書を「発注済」にして QCDS 取決金額が自動更新されるか
  - 承認待ちページに「工事台帳 押印依頼」セクションが表示されるか
  - 案件詳細で月別支払セルをクリックして編集できるか
  - `/admin` で印紙税・見積条件文・QCDSテンプレートの CRUD が動くか
- Phase G-4: 工事台帳 PDF/Excel 出力
- 残確認事項 Q2〜Q5 をひささんに確認

---

## Session 2026-06-05

### 作業内容
- 前セッション（API制限によるストップ）の状態を session_log・メモリから把握
- スクショで確認: `orders.py` への `_sync_after_status_change` 追加が完了済みであることを確認
- `qcds_sync.py` の vendor_name_snapshot フォールバックも実装済みを確認
- 未コミット変更（sessions 1-4分）を1コミットにまとめてコミット・GitHub push（d77ebee）
- VPS デプロイ: `/root/cmv3` に tar.gz 展開 → cmv3-api restart → cmv3-web rebuild
- API 200 / Web 200 動作確認

### 変更ファイル
- commit d77ebee（全セッション変更のまとめコミット）

### 次のアクション
- 発注書ステータス変更 → QCDS 取決金額自動連動の実機確認
- Phase G-4: 工事台帳 PDF/Excel 出力
- 残確認事項 Q2〜Q5

---

## Session 2026-06-05（続き）— 見積条件文テンプレート追加・QCDSテンプレート 1E+4 バグ修正

### 作業内容

1. **見積条件文テンプレート追加**
   - スクショ（見積条件書）の内容を DB に直接 INSERT
   - テンプレート名: 「標準見積条件書（建築改修工事）」
   - 内容: 5.別途工事（4項目）/ 6.その他（14項目）/ 7.保証期間（13項目＋注記）
   - `/admin` → 見積条件文 から選択・使用可能

2. **QCDSテンプレート 通信交通費 1E+4 バグ修正**
   - 原因: `RATE_FIELDS` 全フィールドに `step="0.0001"` を適用していたため、10000 が 1E+4 と表示
   - 修正: `unit === "円"` のフィールドは `step="1" min="0"` に変更（`{ key, label, unit }` デストラクチャリング追加）
   - 修正: `toForm()` の円フィールドを `Math.round()` で整数に変換
   - commit: 1a9bd77

### 変更ファイル
- `frontend/src/app/admin/page.tsx` — step/min条件分岐・Math.round追加

### デプロイ
- cmv3-web リビルド → `✅ Up / HTTP 200`

---

## Session 2026-06-05（続き）— 管理画面 QCDSテンプレートセクション削除

### 背景
QCDS原価算定表ページ下部の「経費率・固定費設定」パネルで管理できるため、管理者画面の QCDSテンプレートは不要と判断。

### 作業内容
- `AdminSection` 型から `"qcds-templates"` を削除
- NAV から「QCDSテンプレート」メニューを削除
- `QCDSTemplatesSection` コンポーネント・関連型・関数を削除（142行削減）
- commit: 77b13a5 / VPS デプロイ → HTTP 200 確認

### 変更ファイル
- `frontend/src/app/admin/page.tsx`

---

## Session 2026-06-05（続き）— QCDS経費行 振替項目ドロップダウン化 + 特殊保険2種追加

### 作業内容

**要件**: QCDS原価算定表の経費行「振替項目」をドロップダウン選択にして、選択内容から計算式を自動更新。「特殊保険（設備生産物）」「特殊保険（解体工事賠責）」の2種を追加。ドロップダウンにない場合は手動入力も可能。

1. **Alembic migration** `y9z0a1b2c3d4`:
   - `qcds.special_insurance_equipment_rate` NUMERIC(8,6) DEFAULT 0.000110
   - `qcds.special_insurance_demolition_rate` NUMERIC(8,6) DEFAULT 0.019053

2. **Backend**:
   - `models/qcds.py`: 2カラム追加
   - `schemas/qcds.py`: QCDSInput/QCDSCalcFields/QCDSResponse に追加
   - `qcds_calculator.py`: QCDSCalcResult に追加、calculate_qcds で計算（工事価格×料率）、site_overhead_total に加算、_SYSTEM_FIELDS に追加

3. **Frontend**:
   - `types/qcds.ts`: QCDSInput/QCDSCalcFields/QCDSResponse に追加
   - `QCDSExpensePanel.tsx`:
     - `EXPENSE_OPTIONS` 追加（12種 + その他）
     - `SYSTEM_CALC_MAP` に2種追加
     - `computedFormulaStr` に formula 追加
     - `ExpenseRow` の振替項目を `<select>` ドロップダウンに変更（「その他」選択時のみテキスト入力表示）
   - `qcds/page.tsx`: headerState に2レート追加、applyQcdsData に追加、設定パネルに2フィールド追加

### 変更ファイル
- `backend/alembic/versions/y9z0a1b2c3d4_add_special_insurance_rates.py`
- `backend/app/models/qcds.py`
- `backend/app/schemas/qcds.py`
- `backend/app/services/qcds_calculator.py`
- `frontend/src/types/qcds.ts`
- `frontend/src/modules/estimate/QCDSExpensePanel.tsx`
- `frontend/src/app/projects/[id]/qcds/page.tsx`

### デプロイ
- commit: 5e7d7b9 / migration y9z0a1b2c3d4 適用済み（docker cp で手動注入）
- cmv3-api restart + cmv3-web rebuild → `✅ HTTP 200`

---

## Session 2026-06-05（続き）— 顧客見積 見積条件書テンプレ・ロゴ・PDF出力

### 問題の根本原因
- テンプレ不表示: `condition_templates`（空テーブル）と `quote_condition_templates` の混同
  - `GET /api/v1/condition-templates` → `condition_templates` テーブル（空）を参照
  - 実際のテンプレは `quote_condition_templates` テーブル（`GET /admin/quote-conditions`）に存在
- ロゴ不表示: `_LOGO_PATH` が `modules/report/templates/images/` を参照していたが実際は `app/templates/images/`

### 修正内容

1. **テンプレAPI修正**: `/api/v1/condition-templates` → `/api/v1/admin/quote-conditions`（`name` フィールドを `section_name` にマップ）

2. **テンプレモーダル全面改修**:
   - 旧: ボタンクリックで即挿入
   - 新: 大型テキストエリアで内容確認・編集 → 「この内容で適用」で確定
   - 工事件名・工期・支払条件を案件データから自動表示（参照用）
   - テンプレが複数ある場合はドロップダウンで選択可能

3. **ナンバリング除去**: 条件書アイテムの `{idx+1}.` 表示を削除

4. **見積条件書 PDF出力**:
   - `pdf_export.generate_condition_pdf()` 追加（A4縦・ロゴ・工事件名・工期・支払条件・条件文）
   - `GET /api/v1/projects/{id}/quotes/{id}/condition-pdf` エンドポイント新設
   - 見積条件書セクションに赤い「PDF出力」ボタン追加

5. **ロゴパス修正**: `_LOGO_PATH = _HERE.parent / "templates" / ...` → `_HERE.parent.parent.parent / "templates" / ...`

6. **備考欄**: ヘッダー編集モードに入力欄あり（元から実装済み）

### 変更ファイル
- `backend/app/modules/report/services/pdf_export.py`
- `backend/app/modules/report/routers/exports.py`
- `frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx`

### デプロイ
- commit: 3410118 / Backend: docker cp → cmv3-api restart / Frontend: cmv3-web rebuild中

---

## Session 2026-06-05（続き）— QCDS 3点修正

### 修正内容

**① 保存時リバートバグ（原因特定・修正）**
- 根本原因: バックエンド PUT `/projects/{id}/qcds` の `field_name` リストに `special_insurance_equipment_rate` / `special_insurance_demolition_rate` が漏れていた
- これらのフィールドが保存されず、GETのたびにDB デフォルト値に戻っていた（= "変更が戻る" 現象）
- 両フィールドをリストに追加して修正

**② 実際の現場人件費 ドロップダウン追加**
- `EXPENSE_OPTIONS` に「実際の現場人件費（直接入力）」追加（`B_dept` セクション）
- 選択時: `system_key = "site_personnel_cost"`, `item_name = "実際の現場人件費"`, `amount_override` を手動入力モード表示
- `dropdownValue` 計算で `item_name === "実際の現場人件費"` を検出して正しくハイライト

**③ 目標営業利益率 移動**
- 設定パネルから「目標営業利益率」を削除
- 「顧客提出価格試算表」ヘッダー右にインライン入力（%表示）追加
- 試算表末尾に緑背景「目標 (X%)」行追加（リアルタイム計算: 目標工事価格 = base / (1 - rate)）

### 変更ファイル
- `backend/app/modules/estimate/routers/qcds.py` — PUT handler にフィールド2件追加
- `frontend/src/modules/estimate/QCDSExpensePanel.tsx` — EXPENSE_OPTIONS / dropdownValue修正
- `frontend/src/app/projects/[id]/qcds/page.tsx` — 試算表ヘッダーインライン入力・目標行追加

### デプロイ
- commit: a7d87af / cmv3-api restart + cmv3-web rebuild → `✅ HTTP 200`

---

## Session 2026-06-05（続き）— 見積PDF 3点修正

### 作業内容（予定）
- 見積条件書PDF 500エラー修正
- 見積書PDFのロゴ+会社名を横並びに変更
- 印影テキストを縦書きに変更

### 作業結果

**見積条件書PDF 500エラー**
- 原因: `from app.api.v1.conditions import ConditionItem` → `ConditionItem` クラスが存在しない
- 修正: `from app.models.condition import QuoteConditionItem` に変更
- `getattr` でフィールド名の差異にも対応

**見積書PDF ロゴ横並び**
- CSS: `.company-header-row` を flex 横並びに追加
- HTML: ロゴ div + 会社情報 div を `.company-header-row` でラップ

**印影縦書き**
- `.stamp-circle` に `writing-mode: vertical-rl; text-orientation: upright` を追加
- `display: flex; align-items: center; justify-content: center` でセンタリング

### 変更ファイル
- `backend/app/modules/report/routers/exports.py` — QuoteConditionItem インポート修正
- `backend/app/modules/report/services/pdf_export.py` — CSS/HTML レイアウト変更

### デプロイ
- commit: 50f6abb / docker cp → cmv3-api restart → `✅ HTTP 200`

---

## Session 2026-06-05（続き）— QCDSドロップダウンバグ修正 + 自動保存

### 作業内容（予定）
- ドロップダウン変更後に保存すると違う値に変わるバグの根本原因修正
- 自動保存（変更後2秒）の実装
- ユーザーからの質問: "保存ボタンじゃなく自動保存だと逆にきつい？" → 実装することに

### 作業結果

**バグ根本原因（section フィールド非更新）**
- `handleDropdownChange` が `system_key` と `item_name` しか更新せず、`section` を変更していなかった
- 例: B_dept の "site_personnel_cost" を B_site 系の "labor_insurance" に変更 → `section: "B_dept"` のまま保存
- 保存後サーバーが (section, row_no) でソートして返す → 順序が変わって別の行に見えた
- 修正: `onChange` に `section: opt?.section ?? item.section` を追加

**自動保存（debounced auto-save）**
- 変更後2秒で自動的に PUT を呼ぶ
- `stateRef` で最新状態を参照して stale closure を防止
- `autoSaveStatus`: pending / saving / saved を AppShell action に表示
- 「今すぐ保存」ボタンは手動強制保存として残存

### 変更ファイル
- `frontend/src/modules/estimate/QCDSExpensePanel.tsx` — section 更新修正
- `frontend/src/app/projects/[id]/qcds/page.tsx` — useRef/useCallback/autoSave追加

### 作業結果
- ビルド完了・HTTP 200 確認

---

## Session 2026-06-05（続き）— 見積条件書 編集欄拡大

### 作業内容（予定）
- 編集欄が小さくて編集しづらい → 内容全体が見える大きさに変更
- 印影横書きはそのままでOK（ひささんより）

### 作業結果
- `editingConditionText.split("\n").length + 3` で rows を動的計算（最小12行）
- 新規追加欄も同様（最小8行）
- `resize: vertical` で手動調整も可能
- 保存/キャンセルボタンを右寄せに変更
- commit: 69b340e / cmv3-web rebuild 中

### 作業結果
- cmv3-web rebuild 完了・HTTP 200 確認

---

## Session 2026-06-05（続き）— QCDS自動保存バグ根本修正 + 担当者電話番号

### 作業内容（予定）
- QCDS 行追加→消えるバグの根本修正
- 担当者連絡先（電話番号）をユーザー管理に追加し見積書PDFに反映

### 作業結果

**QCDS 自動保存バグ根本修正**
- 原因①: `useCallback([id, isSaving])` の stale closure → タイマー時に古い `isSaving` を参照
- 原因②: 保存後 `setExpenseItems(server_data)` 全置換 → 保存中に追加・変更した行が消える
- 修正①: `isSavingRef` で排他制御（deps から `isSaving` を除去）
- 修正②: 保存後は `calc` 値のみ更新、`expenseItems` は新規行のID割当のみ（全置換しない）

**担当者電話番号**
- Alembic migration `z0a1b2c3d4e5`: `users.phone VARCHAR(20)` 追加・適用済み
- `UserRead/UserUpdate` スキーマに `phone` 追加
- 管理者設定ユーザー編集画面に「担当者電話番号」入力欄追加
- 見積書PDF 担当者ブロックに「連絡先：電話番号」を表示（stamp_users に `{id}_phone` キーで格納）

### 変更ファイル
- `backend/alembic/versions/z0a1b2c3d4e5_add_user_phone.py`
- `backend/app/models/user.py` / `schemas/user.py`
- `backend/app/modules/admin/router.py`
- `backend/app/modules/report/services/pdf_export.py`
- `backend/app/modules/report/routers/exports.py`
- `frontend/src/app/projects/[id]/qcds/page.tsx`
- `frontend/src/app/admin/page.tsx`

### デプロイ
- commit: 1273a63 / migration 適用済み / cmv3-api restart + cmv3-web rebuild → `✅ HTTP 200`

### 次のアクション
- QCDS で行追加→ドロップダウン選択が正常に保存されるか確認
- `/admin` → ユーザー管理で担当者電話番号を登録
- 見積書PDFで担当者欄に電話番号が表示されるか確認

---

## Session 2026-06-05（続き）— 顧客見積PDF 備考改行インデント修正

### 作業内容（予定）
- 備考欄に改行が入ると「：」の手前から2行目が始まる → 「：」の直後に揃えたい

### 作業結果
- `pdf_export.py` の備考レンダリングを flex 構造に変更
  - 旧: `<td>： 1行目<br>2行目</td>` → 2行目が左端から始まる
  - 新: `<div style="display:flex">` + `<span>：</span>` + `<span style="flex:1">テキスト</span>`
  - 改行後も「：」の直後に揃う
- commit: b84766a / docker cp → cmv3-api restart → HTTP 200

---

## Session 2026-06-05（続き）— 請求書選択削除 + 割合計算モーダル + TypeScript修正

### 作業内容（予定）
- 請求書一覧：チェックボックス選択・一括削除を追加
- 請求書詳細：「割合（%）」請求方法選択時に計算モーダルを追加
- TypeScriptエラー修正：admin/page.tsx の phone キャスト + User型に phone 追加

### 作業結果

**① TypeScript エラー修正 + phone 表示**
- `frontend/src/types/auth.ts`: `User` インターフェースに `phone: string | null` を追加（migration z0a1b2c3d4e5 で DB 追加済みだったが型未反映だった）
- `frontend/src/app/admin/page.tsx`: `(user as unknown) as { phone? }` キャストを `user?.phone ?? ""` にシンプル化

**② 請求書一覧：選択削除**
- `frontend/src/app/projects/[id]/invoice/page.tsx` 全面改修：
  - チェックボックス列追加（全選択・個別選択）
  - 入金済み請求書はチェック不可（薄表示）
  - N件選択中バナー＋「N件を削除」ボタン（右上 action に表示）
  - `billingMethodLabel()` 表示改善（割合%表示）
- `backend/app/modules/report/routers/invoices.py` に `DELETE /projects/{id}/invoices/{id}` エンドポイント追加（入金済みは 400 エラー）

**③ 割合計算モーダル**
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx`：
  - `billing_method === "percentage"` のとき「計算」ボタン（Calculator アイコン）を表示
  - クリックでモーダル表示 → 顧客見積合計金額を自動取得
  - 割合(%)を入力するとリアルタイムで税抜請求額を計算
  - 「適用」で `current_purchase` フィールドに自動セット
  - 未使用 `useRouter` を削除（TypeScript warning 解消）

### 変更ファイル
- `backend/app/modules/report/routers/invoices.py` — DELETE /invoices/{id} エンドポイント追加
- `frontend/src/types/auth.ts` — User.phone 追加
- `frontend/src/app/admin/page.tsx` — phone キャスト修正
- `frontend/src/app/projects/[id]/invoice/page.tsx` — 選択削除 UI 追加
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx` — 割合計算モーダル・useRouter 削除

### デプロイ
- commit: e7490ab (請求書選択削除・割合モーダル), 3eb52fc (TypeScript修正)
- cmv3-api docker cp restart / cmv3-web rebuild → `✅ HTTP 200 / API 200`

### 次のアクション
- 請求書一覧でチェックボックスをオンにして「N件を削除」が動作するか確認
- 請求書詳細で「割合（%）」選択 → 「計算」ボタン → 顧客見積合計が表示されるか確認
- ユーザー管理画面で担当者電話番号が入力・保存できるか確認（今セッションの TypeScript 修正で解消）

---

## Session 2026-06-05（続き）— 請求書PDF 500修正 + タブ②説明

### 作業内容（予定）
- 請求書PDF 500エラー修正
- タブ「②」の原因調査
- 顧客見積ステータス「案A（発行済みボタン）」の実装確認

### 作業結果

**① 請求書PDF 500エラー修正**
- 原因: `_render_invoice_html` 内でフィールド名が Invoice モデルと不一致
  - `invoice.subtotal` → `current_purchase`（Invoice モデルに subtotal なし）
  - `invoice.issued_at` → `issue_date`
  - `invoice.due_date` → `payment_due_date`
  - `paid_total` の `paid_at` フィルタを廃止（Payment モデルに paid_at なし、全合計に変更）
- `backend/app/modules/report/services/pdf_export.py` を修正・docker cp でデプロイ
- commit: 139b1c3

**② タブ「②」について**
- DB確認: invoices テーブルに該当案件の請求書は 1件（draft）のみ
- 「②」はブラウザキャッシュが原因 → **F5リロードで「①」に戻る**
- 削除ボタン実装後に一度削除しようとした際のキャッシュが残っていた可能性が高い

**③ 「25%で4枚自動作成すべき」について**
- 現在の「割合（%）」は「この請求書が全体の何%を請求するか」を記録する**ラベル**
- 自動分割（25%×4枚）は別機能として実装が必要（未実装）
- ひささんの判断待ち: 「割合を入力したら残りの請求書を自動作成する」機能を実装するか？

**④ 顧客見積ステータス（案A）**
- 未着手。次セッションで実装予定

### 変更ファイル
- `backend/app/modules/report/services/pdf_export.py`

### 次のアクション
- 請求書ページで PDF 出力を再試行して 200 で生成されることを確認
- 顧客見積「発行済みにする」ボタン（案A）の実装
- 割合分割自動作成機能の要否をひささんに確認

---

## Session 2026-06-05（続き）— 請求書分割自動作成・PDFレイアウト改修

### 作業内容（予定）
- 割合(%)から残り請求書を自動作成
- PDFをスクショ準拠レイアウトに全面改修
- n/n回目の表示追加

### 作業結果

**① Alembic migration: `inv_split_fields`**
- `invoices.split_sequence` INT（何回目か）
- `invoices.split_total` INT（全何回か）
- migration 適用確認: `Running upgrade z0a1b2c3d4e5 -> inv_split_fields`

**② 自動分割 API: `POST /invoices/{id}/auto-split`**
- `billing_percentage` から総枚数を `floor(100/pct)` で算出
- 例: 25%→4枚（25/25/25/25）、30%→3枚（30/30/40）
- 最後の1枚が端数（100 - (n-1)×pct）を加算
- 顧客見積 subtotal を取得して各請求書の current_purchase を自動計算
- 既に split_total が設定済みの場合は 400 エラー

**③ PDF レイアウト全面改修 (`_render_invoice_html` + `_INVOICE_CSS`)**
- スクショ準拠: 6列横並びサマリ（前月御請求額/御入金/差引残高/当月御買上額/今回消費税額/今回御請求額）
- 発行日を年・月・日に分割表示
- 弊社工事番号を右上に表示
- ロゴ+会社名を横並びで右カラムに配置
- 振込先テーブルを左ラベル+右値の2列に整理
- `n/n回目` ラベルをタイトルに追記（`（第X回 / 全Y回）`）

**④ フロントエンド更新**
- `invoice.ts`: `split_sequence / split_total` 追加
- 一覧: 請求番号に `2/4回` ミニバッジ表示
- 詳細: 「残り請求書を自動作成」ボタン追加（未分割かつ割合設定済みの場合のみ表示）
- 詳細: `第X回/全Y回` バッジ表示（分割済みの場合）
- パンくずに `（第X回/全Y回）` 表示

**⑤ session_log の「ひささん」→「ひささん」修正（2箇所）**

### 変更ファイル
- `backend/alembic/versions/inv_split_fields_invoice_split.py`
- `backend/app/models/invoice.py`
- `backend/app/schemas/invoice.py`
- `backend/app/modules/report/routers/invoices.py`
- `backend/app/modules/report/services/pdf_export.py`
- `frontend/src/types/invoice.ts`
- `frontend/src/app/projects/[id]/invoice/page.tsx`
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx`

### デプロイ
- commit: 8036baa / migration 適用済み / cmv3-api + cmv3-web 再ビルド完了

### 次のアクション
- 請求書で「割合（%）」25%を設定 → 「残り請求書を自動作成」ボタンで4枚作成されることを確認
- PDF出力で6列サマリ・発行日分割・n/n表示が正しく出るか確認
- 顧客見積ステータス「発行済みにする」ボタン（案A）の実装

---

## Session 2026-06-05（続き）— バグ修正・PDF改修・ダッシュボード強化

### 作業内容（予定）
- 顧客マスタ422バグ修正・PDF n/n位置変更・空行追加・ダッシュボード強化

### 作業結果

**① 顧客マスタ422バグ修正**
- 原因: `per_page=200` が API の上限 `le=100` を超えていた
- `modules/project/router.py` の per_page 上限を 100→500 に変更

**② PDF改修（3点）**
- n/n表示をタイトルから明細テーブル内の1行に移動（工事名行の下）
- 空行を自動追加（10行分まで埋める）
- 日付列に issue_date を使用（年/月/日形式）

**③ ダッシュボード: 統合期限アラート（`PeriodAlertsCard`）5種**
- 支払期日3日前/超過/完工後請求未発行/工期超過/60日以上未回収
- 各種別: 色分け・件数バッジ・行クリックで遷移

**④ ダッシュボード: 請求書年月別一覧（`MonthlyInvoicesCard`）**
- 年月グループ・折りたたみ・工事名/発注者/総額/入金済表示

**未対応（次セッション）**
- 請求書2②（総額+分割連動型）→ 大規模設計変更
- 顧客見積ステータス「発行済み」ボタン

### 変更ファイル
- `backend/app/modules/project/router.py`
- `backend/app/modules/report/routers/dashboard.py`
- `backend/app/modules/report/services/pdf_export.py`
- `frontend/src/app/dashboard/page.tsx`

### デプロイ
- commit: a0097d1 → HTTP 200 確認済み

---

## Session 2026-06-05（続き）

### 作業内容（予定）
- 請求書2②：総額請求書＋分割連動型の設計提案 → ひささんの承認後に実装開始
- specs設計書更新（§8 分割連動型仕様）
- ダッシュボードをデザインシステム準拠に修正

### 作業結果（前セッション分・2026-06-05）

**バグ修正・監査対応（2026-06-05 続き）**
- session_log.md の「Session 2026-06-06」→「Session 2026-06-05（続き）」に修正（JST）
- 発注書 POST 500: `qcds_sync.py` の `QCDSDirectWork.deleted_at` 存在しないカラム参照を削除
- auto-split 400: 自動分割前に `billing_method/percentage` を PATCH 保存するよう修正
- アーキテクチャ違反: `fmtMoney/fmtRelTime` を `lib/format.ts` に統一、`window.location.href` → `useRouter().push`
- ダッシュボード全面改修（dashboard.html 準拠）:
  - 期限アラート枠: `.alert-card/.alert-row.danger/.warn/.info` CSS クラス準拠
  - 「利益率ランキング Top 10」→「請求書一覧（月別）」に置き換え
  - grid-2 左列(1.4fr): 月別請求書一覧、右列(1fr): アラート＋タイムライン
- commit: 0649316, bb51ea2 / API 200 / Web 200

**① specs/設計書_06 §8 追記**
- 請求書 総額+分割連動型の仕様を設計書に正式記録

**② Alembic migration `invoice_split_v2`**
- `invoices.invoice_type` VARCHAR(20) DEFAULT 'standalone'（standalone/total/split）
- `invoices.parent_invoice_id` UUID FK（分割→総額の参照）
- `payments.target_split_id` UUID FK（入金の対象回）
- migration 適用確認: `Running upgrade inv_split_fields -> invoice_split_v2`

**③ Backend**
- `Invoice` モデルに `invoice_type`, `parent_invoice_id`, `children/parent` relationship 追加
- `Payment` モデルに `target_split_id` 追加
- `auto-split` 全面刷新: 既存請求書 → `total` 型へ変換、分割1〜n を `split` 型で作成
- `add_payment`: `target_split_id` で対象回を特定し、対象 split のステータス更新 + 次回繰越（前月残高・御入金額）を自動計算

**④ Frontend**
- `types/invoice.ts`: `invoice_type`, `parent_invoice_id`, `PaymentRead.target_split_id` 追加
- 一覧: `total` 行に「総額」バッジ、ChevronDown/Right で split 子行を折りたたみ表示
- 詳細（split）: 「第N回 / 全M回 · 総額請求書へのリンク」バナー、入金フォーム非表示
- 詳細（total）: 入金フォームに「対象回」セレクト、下部に分割一覧サマリテーブル

**⑤ ダッシュボード DS 準拠修正**
- `PeriodAlertsCard`: CSS 変数 `--c-warn/danger/success` を使用・`borderRadius: var(--r-pill)` に統一・Lucide アイコン追加
- `MonthlyInvoicesCard`: `.tbl` クラス使用・`var(--ff-mono)` で数値表示・ChevronDown/Right SVG

### 変更ファイル
- `backend/alembic/versions/invoice_split_v2_type_parent.py`
- `backend/app/models/invoice.py`, `backend/app/schemas/invoice.py`
- `backend/app/modules/report/routers/invoices.py`
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md`
- `frontend/src/types/invoice.ts`
- `frontend/src/app/projects/[id]/invoice/page.tsx`
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx`
- `frontend/src/app/dashboard/page.tsx`

### デプロイ
- commit: ba42938 / migration invoice_split_v2 適用済み / API 200 / Web 200

### 次のアクション
- 請求書で「割合25%」→「自動分割」を実行し、総額＋分割4枚が作成されることを確認
- 総額請求書詳細で「対象回」セレクトが表示されることを確認
- 入金追加後、次の分割請求書の「前月御請求額」「御入金額」が自動更新されることを確認
- ダッシュボードで期限アラート・月別請求書一覧が正しいデザインで表示されることを確認

---

## Session 2026-06-05（続き）— 日付入力バグ修正・PDF 500エラー修正

### 作業内容（予定）
- 請求書詳細ページ: 日付カレンダーがクリックしにくい・選択しても反映されない問題修正（工事完了日 / PDF追記行の年月日）
- 請求書PDF export-pdf 500エラーの根本原因調査・修正


### 作業結果

**① 請求書PDF 500エラー修正（根本原因）**
- 原因: _render_invoice_html の f-string 内で yr, mo, dy 変数を使用していたが未定義だった
- 修正: issue_date（なければ created_at）から年・月・日を抽出して定義するコードを追加
- ファイル: ackend/app/modules/report/services/pdf_export.py

**② 日付が保存後に反映されない問題修正**
- 原因: extraRows ロード時に date: "" とハードコードされており、DB の description フィールドを読まなかった
- 修正: date: i.description || "" に変更（保存済み日付が再表示される）
- ファイル: rontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx

**③ 日付カレンダーのクリック改善**
- onClick ハンドラで HTMLInputElement.showPicker() を呼ぶよう追加
- cursor: pointer 追加
- 工事完了日・追記行日付入力の両方に適用

### 変更ファイル
- ackend/app/modules/report/services/pdf_export.py
- rontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx

### デプロイ
- commit: fb65fc9 / GitHub push 済み
- cmv3-api: docker cp + restart → API 200 確認済み
- cmv3-web: rebuild → HTTP 307 (正常) 確認済み

### 次のアクション
- 請求書詳細ページでPDF出力が正常に生成されることを確認
- 追記行の日付を選択・保存後、再表示で正しい日付が表示されることを確認

---

## Session 2026-06-08 — 発注書↔工事台帳 取決金額連動 強化

### 作業内容（予定）
- qcds_sync.py: total_amount==0 でも agreed_amount を 0 にリセットするよう修正（発注書削除時のバグ修正）
- qcds_sync.py: completed ステータスを集計対象に追加
- 手動再同期 API 追加: POST /projects/{id}/qcds/sync-from-orders
- 工事台帳ページ: 「発注書から再同期」ボタン追加、同期後フィードバック表示
- 発注書ページ: 「発注する」ステータス変更時に「取決金額を更新しました」トースト表示


### 作業結果

**① qcds_sync.py バグ修正**
- 	otal_amount == 0 時に early return していた → 発注書削除後も取決金額がゼロにリセットされなかったバグを修正
- completed ステータスを集計対象に追加（_SYNC_STATUSES）
- sync_all_vendors_from_orders() 関数追加（全業者一括同期）

**② 手動再同期API追加**
- POST /api/v1/projects/{id}/qcds/sync-from-orders エンドポイント追加
- 案件内の全業者発注書合計を QCDS に一括反映

**③ 工事台帳ページ UI 改善**
- 「発注書から再同期」ボタン追加（同期後に etchLedger() で即時反映）
- 注記テキストを「発行済以降」と明確化

**④ 発注書ページ UI 改善**
- 「発注する」「納品済にする」「支払済にする」ボタン押下時に緑色バナーでフィードバック表示
- confirm ダイアログに「工事台帳の取決金額が自動更新されます」文言追加

### 変更ファイル
- ackend/app/shared/services/qcds_sync.py
- ackend/app/modules/estimate/routers/qcds.py
- rontend/src/app/projects/[id]/page.tsx
- rontend/src/app/projects/[id]/purchase/page.tsx

### デプロイ
- commit: cc66d3d / GitHub push 済み
- cmv3-api: docker cp + restart → API 200 確認済み
- cmv3-web: rebuild → Started 確認済み

### 次のアクション
- 発注書「発注する」クリック → 上部に「✓ 取決金額を工事台帳に反映しました」バナー表示されることを確認
- 工事台帳タブ → 「🔄 発注書から再同期」ボタンで手動同期できることを確認

---

## Session 2026-06-08（続き）— 発注書 4点改善

### 作業内容（予定）
- ① 発注書カードに業者見積版との差額を表示
- ② 発注書カード: 発行済以降も全明細を展開表示できるアコーディオン追加
- ③ 発注管理(/purchases)テーブルの行全体クリック対応
- ④ 発注書PDF出力機能追加（pdf_export.py + エンドポイント + UIボタン）


## Session 2026-06-08（続き）— 進捗タブ バグ修正 + 発注書残実装

### 作業内容（予定）
- 進捗削除500エラー修正（DELETE /progress/{id}）
- 図面添付ファイルの問題修正:
  ① 写真台帳に反映されない
  ② クリックで別タブが開き「認証情報が無効です」→ AuthBlob方式に変更
  ③ .jww ファイルを登録できるよう拡張子リストに追加
- 発注書: ② 発行済でも全明細展開できるアコーディオン追加
- 発注書: ④ PDF出力機能追加
- 発注書: ③ 発注管理(global)テーブル行全体クリック対応（デプロイ済み）


### 作業結果

**① 進捗削除500エラー修正（progress_router.py）**
- db.get(ProgressLog, log_id) → selectinload(ProgressLog.attachments) 付きの select に変更（async lazy load エラー解消）
- 権限チェックを oles[] 配列対応に更新（super_admin も削除可能に）
- unlink(missing_ok=True) で既に消えたファイルもエラーにしない

**② 図面ファイル3点修正**
- progress/page.tsx: <a target=_blank> → handleFileOpen() （認証付きfetch→blob→新窓またはDL）
- drawing input の ccept に .jww/.dxf/.dwg を追加
- photo-album/page.tsx: llAttachments フィルタを画像のみ→画像+PDF+図面対応に変更
- PhotoCard: 非画像ファイルをファイルアイコンカードで表示・クリックで認証DL

**③ 発注書: 全明細展開アコーディオン（purchase/page.tsx）**
- expandedOrders state 追加
- 「▼ 全N件を表示」クリックで全明細+小計/税/合計テーブルを展開
- 発行済以降も詳細が確認できる

**④ 発注書PDF出力**
- pdf_export.py: generate_purchase_order_pdf() 関数追加（A4縦・業者宛・明細テーブル）
- exports.py: GET /purchase-orders/{id}/export-pdf エンドポイント追加
- purchase/page.tsx: 各発注書カードに赤い「📄 PDF」ボタン追加

### 変更ファイル
- ackend/app/modules/site/progress_router.py
- ackend/app/modules/report/services/pdf_export.py
- ackend/app/modules/report/routers/exports.py
- rontend/src/app/projects/[id]/progress/page.tsx
- rontend/src/app/projects/[id]/photo-album/page.tsx
- rontend/src/app/projects/[id]/purchase/page.tsx
- rontend/src/app/purchases/page.tsx

### デプロイ
- commit: 0618be8 / GitHub push 済み
- API 200 / Web Started 確認済み

### 次のアクション
- 進捗削除が正常に動作するか確認
- 図面(PDF/.jww)ファイルをクリックして認証付きで開けるか確認
- 写真台帳に図面ファイルが表示されるか確認
- 発注書カード「▼ 詳細を表示」が全明細を展開するか確認
- 発注書「📄 PDF」ボタンでPDFが生成されるか確認

---

## Session 2026-06-08（続き）— 小修正3件

### 作業内容（予定）
- 発注書ボタン配置: 金額・ステータス・各ボタン間のマージン追加
- 顧客見積ステータス: 下書きから発行済等に変更できない問題修正
- 注文書/注文請書: PDFの基本契約約款に合わせてシステムのデフォルト表示を統一


### 作業結果（前セッション分 2026-06-08）

**① 発注書ボタン配置**: gap: 10px + 縦セパレーター追加
**② 顧客見積ステータス変更・選択削除**: QuoteUpdate に status 追加・DELETE エンドポイント追加・ステータス変更ボタン・チェックボックス削除追加
**③ 注文書/注文請書 約款デフォルト更新**: 管理者設定 DB を PDFの内容に一括更新（第1〜9条）
**④ 請求書設計提案**: Phase R-1/R-2/R-3 の3フェーズ設計文書作成（実装は別途）

### 変更ファイル
- ackend/app/schemas/quote.py
- ackend/app/modules/estimate/routers/quote_core.py
- rontend/src/app/projects/[id]/quote/page.tsx
- rontend/src/app/projects/[id]/purchase/page.tsx
- DB: contract_clauses テーブル（第1〜9条を PDF 記載内容に更新）

---

## Session 2026-06-08（続き）— 工事台帳Excel修正・PDF、QCDS Excel/PDF、注文請書

### 作業内容（予定）
- 工事台帳 Excel出力の「開けない」バグ修正・ファイル名に工事名+発注者を入れる
- 工事台帳 PDF出力を追加（WeasyPrint）
- QCDS原価算定表 Excel/PDF出力追加
- 注文請書に注文書のデータを反映できる機能追加


---

## Session 2026-06-08（続き）— 各種修正まとめ（session_log 追記）

### 作業内容（予定）
- 発注書カード・進捗削除・図面・QCDS連動・顧客見積ステータス・約款・編集履歴などの一連修正

### 作業結果

**発注書ボタン配置**: スペーシング改善（gap: 10px + セパレーター）
**発注書 全明細アコーディオン**: ▼ 詳細を表示ボタンで発行済み後も全明細確認可
**発注書 PDF生成中表示**: pdfLoadingId state 追加、生成中は「生成中…」グレーアウト表示
**発注書 業者見積取込**: price-history（業者マスタ横断）→ この案件の業者見積版（QuoteVersion）から取込に変更
**QCDS取決金額の税**: total_amount（税込）→ subtotal（税抜）に修正、再同期で正しい値に更新
**QCDS取決見通 税込/税抜トグル**: showTaxInclusive state・トグルスイッチ追加
**進捗削除 500エラー**: selectinload(attachments) + await db.delete(att) + db.flush() で修正
**図面ファイル認証エラー**: handleFileOpen()でfetch+blob、target=_blank廃止
**図面.jww対応**: accept に .jww/.dxf/.dwg 追加
**写真台帳 図面反映**: allAttachments フィルタを PDF/jww/drawing も含むよう修正
**編集履歴 変更前後 — 表示**: before/after キーに統一 + getDiff フォールバック + STATUS_LABEL 日本語変換
**顧客見積 ステータス変更**: QuoteUpdate に status 追加・PATCH endpoint 更新・UIボタン追加
**顧客見積 選択削除**: チェックボックス + N件を削除 ボタン + DELETE endpoint 追加
**約款デフォルト変更**: DB の contract_clauses テーブルを PDF 記載内容（第1〜9条）に直接更新

### 変更ファイル
- ackend/app/modules/site/progress_router.py
- ackend/app/modules/report/services/pdf_export.py
- ackend/app/modules/report/routers/exports.py
- ackend/app/shared/services/qcds_sync.py
- ackend/app/schemas/quote.py
- ackend/app/modules/estimate/routers/quote_core.py
- ackend/app/modules/project/router.py
- rontend/src/app/projects/[id]/page.tsx
- rontend/src/app/projects/[id]/purchase/page.tsx
- rontend/src/app/projects/[id]/progress/page.tsx
- rontend/src/app/projects/[id]/photo-album/page.tsx
- rontend/src/app/projects/[id]/quote/page.tsx
- rontend/src/app/projects/[id]/history/page.tsx
- rontend/src/app/purchases/page.tsx
- DB: contract_clauses（第1〜9条更新）

---


### 作業結果

**① 工事台帳 Excel 修正**
- subtotal_excl_tax → subtotal、due_date → payment_due_date、	otal_incl_tax → 	otal_amount など誤フィールド参照を getattr で安全修正
- ファイル名を 工事台帳_{番号}_{工事名}_{発注者}.xlsx に変更

**② 工事台帳 PDF出力**
- pdf_export.generate_ledger_pdf() 追加（A4横・取決見通表・合計行）
- GET /projects/{id}/export-pdf エンドポイント追加
- 案件詳細ページに赤い「PDF出力」ボタン追加

**③ QCDS Excel/PDF出力**
- excel_export.export_qcds_excel() 追加（直接工事費テーブル + 工事割出サマリー）
- pdf_export.generate_qcds_pdf() 追加（A4横・直接工事費 + サマリー）
- GET /projects/{id}/qcds/export-excel、/export-pdf エンドポイント追加
- QCDS ページのヘッダーに Excel / PDF ボタン追加

**④ 注文請書 → 注文書データ反映**
- handleImportFromOrder(): /api/v1/projects/{id}/orders から最新の発注済注文書を取得し、各フィールド（日付・顧客名・住所・工期・支払条件）をフォームに反映
- 「📋 注文書から取込」ボタンを注文請書ページに追加（保存で確定）

### 変更ファイル
- ackend/app/modules/report/services/excel_export.py
- ackend/app/modules/report/services/pdf_export.py
- ackend/app/modules/report/routers/exports.py
- rontend/src/app/projects/[id]/page.tsx
- rontend/src/app/projects/[id]/qcds/page.tsx
- rontend/src/app/projects/[id]/acknowledgment/page.tsx

### デプロイ
- commit: 86f98d6 / GitHub push 済み
- cmv3-api docker cp + restart → API 200 確認済み
- cmv3-web rebuild → Started 確認済み

### 次のアクション
- 工事台帳 Excel が正常に開けることを確認
- 工事台帳・QCDS の PDF 出力を確認
- 注文請書「📋 注文書から取込」ボタンで注文書データが反映されることを確認

---

## Session 2026-06-08（続き）— Excel/PDF/QCDS/注文請書 修正

### 作業内容（予定）
- ① 工事台帳 Excel 500エラー修正・ファイルが開けないバグ修正
- ② 工事台帳 PDF を全データ出力（A3横・承認印は苗字のみ表示）
- ③ QCDS PDF/Excel のカテゴリ名を日本語化・全データを出力（A3横）
- ④ 注文請書「注文書から取込」の内容明確化・約款の自動反映対応


