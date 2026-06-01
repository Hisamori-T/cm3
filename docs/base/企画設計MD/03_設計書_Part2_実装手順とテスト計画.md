# 設計書 Part2：実装手順 / Claude Code 指示テンプレート / テスト計画

**作成者**：平等 久盛
**作成日**：2026年5月13日
**バージョン**：1.0

---

## 11. CLAUDE.md（リポジトリルートに配置）

リポジトリ直下に以下の内容で `CLAUDE.md` を配置する。VSCode Claude Code拡張はこのファイルを自動読み込みし、毎セッションのコンテキストとして使う。

```markdown
# Construction Manager v3 開発ガイド

## プロジェクト概要
株式会社クラップの工事台帳をExcelからWebシステムに移行するプロジェクト。
詳細は `docs/01_企画書.md`, `docs/02_設計書_Part1.md`, `docs/03_設計書_Part2.md` を参照。

## 環境
- バックエンド: Python 3.11 / FastAPI / SQLAlchemy 2.0 / Celery / PostgreSQL 16 / Redis
- フロントエンド: Next.js 14 (App Router) / TypeScript / Tailwind CSS / shadcn/ui / Recharts
- デプロイ: WebARENA Indigo VPS + Coolify (Docker Compose)
- AI: Google Gemini API (gemini-2.5-pro / flash)

## コーディング規約
- Pythonは ruff + mypy (strict) で linting/型チェック
- TypeScriptは strict mode、eslint + prettier
- 関数・クラスにはdocstring/JSDocを必ず書く
- セキュリティ：環境変数は .env のみ。コードへのハードコード禁止
- ログ：structlog（バック）、console.log は本番ビルドで削除

## ディレクトリ規約
backend/app/api/v1/<resource>.py に APIエンドポイント
backend/app/services/<feature>.py にビジネスロジック
backend/app/models/<entity>.py に SQLAlchemyモデル
backend/app/schemas/<entity>.py に Pydanticスキーマ
frontend/src/app/<route>/page.tsx にページコンポーネント
frontend/src/components/<feature>/ に機能別コンポーネント

## 重要な業務ルール
1. 工事番号は `{西暦下2桁}-{社員番号}-{連番3桁}` で自動採番、手動編集可
2. 編集権限は「管理者」または「作成者本人」のみ。閲覧は全員可
3. 案件ステータスは7段階: 見積中→受注→着工→施工中→完工→請求済→入金済
4. 全エンティティの変更は edit_histories に自動記録
5. 業者見積スキャンの解析結果は必ずユーザーレビューを経てから反映
6. Excel帳票は既存テンプレート(backend/app/templates/excel/)に値を埋めるだけ。スタイルは触らない

## 作業フロー
1. 新機能の実装前に該当のPhase/Step（設計書11章）を確認
2. 各Stepの「動作確認チェックリスト」を満たさないと次に進まない
3. 不明点があれば必ず本人（ひささん）に質問。勝手な解釈で進めない
4. ライブラリ追加は事前に提案して承諾を得る
5. DBスキーマ変更は必ずAlembicマイグレーション経由

## してはいけないこと
- 既存Excelテンプレートのスタイル変更
- ハードコードのAPIキー・パスワード
- データベース直接操作（必ずSQLAlchemy経由）
- Excelの計算式を勝手に解釈して別ロジックに置き換える
- 案件削除を物理削除で行う（必ず論理削除）
```

---

## 12. 実装手順（Phase 1、6週間の詳細ステップ）

### Week 1：基盤構築

#### Step 1-1：リポジトリ初期化とCLAUDE.md配置
- GitHubに private repo 作成（例：`Hisamori-T/construction-manager-v3`）
- `CLAUDE.md`、`README.md`、`.gitignore` を配置
- `docs/` に企画書・設計書をコミット
- 動作確認：`git push` 成功、Claude Codeが `CLAUDE.md` を読み込めること

#### Step 1-2：Docker Compose環境構築
- `docker-compose.dev.yml` 作成（PostgreSQL、Redis、Adminer）
- `backend/Dockerfile`、`frontend/Dockerfile` 作成
- 動作確認：`docker compose -f docker-compose.dev.yml up` で全コンテナ起動

#### Step 1-3：FastAPI骨格
- pyproject.toml（FastAPI, SQLAlchemy 2.0, asyncpg, alembic, pydantic-settings, structlog, argon2-cffi, python-multipart, fastapi-users）
- `app/main.py`、`app/core/config.py`、`app/core/database.py`
- ヘルスチェックエンドポイント `/api/v1/health`
- 動作確認：`curl localhost:8000/api/v1/health` で 200 OK

#### Step 1-4：Next.js骨格
- create-next-app で TypeScript + Tailwind + App Router
- shadcn/ui セットアップ（button, input, table, dialog, dropdown-menuなど基本コンポーネント）
- API client（fetch wrapper、JWT管理）
- 動作確認：`/` で「Construction Manager v3」と表示

#### Step 1-5：DBスキーマとAlembic
- 設計書2章のテーブル定義をSQLAlchemyモデルで実装
- Alembicマイグレーション初回適用
- シードデータ（管理者ユーザー1名、印紙税テーブル、サンプル業者数件）
- 動作確認：`alembic upgrade head` 成功、Adminerで全テーブル確認可

#### Step 1-6：認証実装
- FastAPI Users 設定（JWT + refresh token、Argon2id）
- `/api/v1/auth/login`, `/refresh`, `/me`, `/logout`
- フロント側ログイン画面（`/login`）、認証Context
- 動作確認：ログイン→ダッシュボード遷移、ログアウト動作

**Week 1 完了基準**
- 管理者ユーザーでログイン可能
- 空のダッシュボードが表示される
- DBに全テーブルが存在
- ローカル開発環境がリセット後5分以内に立ち上がる

---

### Week 2：工事台帳・QCDS・見積書

#### Step 2-1：案件一覧と新規作成
- `GET /api/v1/projects`、`POST /api/v1/projects`
- フロント `/projects` 一覧画面（フィルタ、ソート、検索）
- 新規作成モーダル（最小必須項目）
- 工事番号自動採番ロジック実装

#### Step 2-2：案件詳細・編集
- `GET /api/v1/projects/{id}`、`PATCH /api/v1/projects/{id}`
- フロント `/projects/[id]` 案件詳細画面
- 設計書4.2のレイアウトを実現
- 編集モード切替、保存、楽観的ロック

#### Step 2-3：ステータス管理
- `POST /api/v1/projects/{id}/status`
- フロント側ドロップダウンUI、ステータスバッジ表示
- 編集履歴への status_changed_to 記録

#### Step 2-4：QCDS
- モデル、API、画面
- 計算ロジック（直接工事費合計、現場経費、経費、営業利益）
- 設計書2.2 qcds テーブル定義に基づく派生計算サービス
- 取決見通表の30行入力UI（テーブル形式、業者名オートコンプリート）

#### Step 2-5：見積書
- モデル、API、画面
- 内訳入力（行追加、業者見積から流用ボタンはWeek 3で実装）
- 見積条件書のテンプレート選択UI（現行Excelの条件文をマスタ化）
- PDF出力（WeasyPrint）、Excel出力（テンプレート埋め込み）
- 印鑑のロゴはExcelテンプレートに既に入っているので、出力時に保持

#### Step 2-6：編集履歴
- SQLAlchemy event listener 実装（設計書8.3参照）
- `/projects/[id]/history` 画面で時系列表示

**Week 2 完了基準**
- 新規案件を作成→工事番号自動採番→詳細編集→ステータス変更が一連で動く
- QCDSの入力と計算が現行Excelと同じ結果を返す
- 見積書をPDF/Excel両方で出力でき、レイアウト崩れがない
- 編集履歴が誰が・いつ・何を変えたか記録されている

---

### Week 3：業者見積スキャン

#### Step 3-1：業者マスタ
- CRUD API、`/vendors` 画面、`/vendors/[id]` 詳細画面
- 単価履歴の表示・検索

#### Step 3-2：ファイルアップロードとジョブ管理
- `POST /api/v1/scan/upload`（multipart）
- VPSローカル一時保存、scan_jobs テーブル INSERT
- Celery + Redis セットアップ、ワーカー起動

#### Step 3-3：Gemini API連携
- `app/services/gemini_scanner.py` 実装
- プロンプトとresponseSchemaの定義（設計書5.2）
- PDF→画像変換（pdf2image）、Excel→構造化テキスト変換
- エラーハンドリング、リトライ（指数バックオフ）

#### Step 3-4：レビュー画面
- `/scan/[job_id]` レビュー画面実装
- 左ペイン：ファイルプレビュー（react-pdf、画像はimg）
- 右ペイン：解析結果テーブル（低信頼度フィールド黄色強調、編集可）
- 業者マスタとの fuzzy matching 候補表示

#### Step 3-5：QCDS/見積への転記
- `POST /api/v1/scan/results/{id}/apply`
- target=qcds: qcds_direct_works に行追加
- target=quote: quote_items に行追加
- vendor_price_histories へ蓄積

#### Step 3-6：見積流用機能
- 見積書編集画面に「過去見積から流用」ボタン
- 業者マスタ→単価履歴検索、選択して見積項目にコピー
- 案件横断の類似工事検索（工事名や工種でマッチ）

**Week 3 完了基準**
- PDF業者見積をアップロード→Geminiで解析→レビュー→QCDSに転記が動く
- 過去スキャン結果が業者マスタの単価履歴に蓄積されている
- 単価履歴から新しい見積項目を流用できる
- Excel形式の業者見積も解析できる

---

### Week 4：注文書・請求書・印紙税

#### Step 4-1：注文書・注文請書
- モデル、API、画面
- 基本契約約款テンプレ（注文書の右側に長文）はマスタ化して再利用
- 印紙税自動算定（QCDS印紙税テーブル準拠）
- PDF/Excel出力

#### Step 4-2：請求書
- モデル、API、画面
- 前月御請求額・御入金・差引残高の入金管理連携
- 入金登録機能、ステータス`paid`への遷移
- PDF/Excel出力

#### Step 4-3：印紙税表管理
- `/admin/stamp-tax` 画面
- 印紙税テーブルのCRUD（effective_fromで版管理）

#### Step 4-4：見積条件書テンプレート管理
- `/admin/quote-conditions` 画面
- 条件文のマスタ管理、新規見積で選択肢として表示

**Week 4 完了基準**
- 注文書を作成→印紙税が自動算定→PDF/Excel出力
- 請求書を作成→入金登録→ステータス変更→案件側にも反映
- 印紙税表が管理画面で更新できる

---

### Week 5：Excelインポート・進捗・ダッシュボード

#### Step 5-1：Excelインポート
- `POST /api/v1/excel/import` 実装
- `cell_mappings.yaml` に基づくセル座標読み取り
- 既存案件との照合、上書き確認UI
- インポート結果サマリ表示

#### Step 5-2：Excelエクスポート（一括）
- `GET /api/v1/projects/{id}/excel/export` 実装
- 工事台帳/QCDS/見積/注文/請求の全シートに値を埋めたExcelファイル生成
- 既存テンプレートのレイアウト・書式を完全維持

#### Step 5-3：進捗ログ
- モデル、API、画面
- ファイルアップロード（写真・図面）
- 画像はWebP変換版とオリジナル両方保持
- タイムライン表示

#### Step 5-4：ダッシュボード
- KPIカード、ステータス分布円グラフ、月別推移、利益率ランキング、期限アラート、最近の活動
- Recharts でグラフ描画
- 集計クエリの最適化（マテリアライズドビューも検討）

#### Step 5-5：管理画面
- ユーザー管理（admin only）
- 印紙税表、見積条件テンプレ、基本契約約款テンプレの管理

**Week 5 完了基準**
- 既存Excel工事台帳をアップロード→Webに取り込める
- Web案件をExcel出力→既存テンプレートと同じレイアウトで出る
- 写真・図面を案件に紐付けて保存・閲覧できる
- ダッシュボードで全案件の損益・進捗が一目でわかる

---

### Week 6：テスト・受入・本番移行

#### Step 6-1：テスト整備
- バックエンド：pytest（主要APIエンドポイント、サービス層）、最低限のカバレッジ60%
- フロントエンド：playwright で主要シナリオE2E（ログイン→案件作成→見積→PDF出力）

#### Step 6-2：本番デプロイ準備
- 本番用 `docker-compose.yml`、`.env.production`
- Coolifyでアプリケーション登録、SSL設定、自動デプロイ設定
- DBバックアップ設定（pg_dump 日次、7日保持）
- MuuMuDNS設定（サブドメイン）

#### Step 6-3：受入テスト
- 株式会社クラップ社内ユーザーに使ってもらう
- フィードバック収集、優先度高い修正のみ対応

#### Step 6-4：マニュアル作成
- 操作マニュアル（PDF or Webサイト）
- 高齢従業員向け簡易ガイド（Excel併用フロー）
- 管理者マニュアル

#### Step 6-5：本番リリース
- 既存Excel案件の一括インポート
- 全社員アカウント発行
- 運用開始、Slackで質問対応窓口

**Week 6 完了基準**
- 本番URLで全機能が動作する
- 社内6名以上がアカウント取得し、ログインできる
- マニュアルが整備されている
- 既存Excel案件が全件インポート済み

---

## 13. Claude Code 指示テンプレート集

各StepごとにClaude Codeにそのまま投げられるプロンプトを用意。

### テンプレート 13-1：Step 1-3 FastAPI骨格

```
@CLAUDE.md @docs/02_設計書_Part1.md を読みました。
これから設計書 Step 1-3「FastAPI骨格」を実装してください。

要件：
- backend/ ディレクトリに以下を作成
  - pyproject.toml: FastAPI, SQLAlchemy 2.0 (asyncpg), alembic, pydantic-settings,
    structlog, argon2-cffi, python-multipart, fastapi-users を含む
  - Dockerfile: Python 3.11-slim ベース、uv で依存解決
  - app/main.py: FastAPI インスタンス、CORS設定、ルーター登録、起動/終了ハンドラ
  - app/core/config.py: pydantic-settings、.env から DATABASE_URL, REDIS_URL, 
    GEMINI_API_KEY, JWT_SECRET, ALLOWED_ORIGINS を読み込み
  - app/core/database.py: 非同期エンジン、async session maker、get_db依存関数
  - app/api/v1/health.py: GET /api/v1/health を実装
- ログは structlog で JSON 出力
- 環境変数のサンプル: .env.example
- ローカル起動コマンドを README に記載

進める前に：
- ライブラリ選定で気になる点があれば質問してください
- ディレクトリ構成は設計書 1.3 に従ってください
```

### テンプレート 13-2：Step 1-5 DBスキーマとAlembic

```
@docs/02_設計書_Part1.md の第2章「データモデル」を読みました。
これから Step 1-5 を実装してください。

要件：
- 第2章で定義された全テーブルを SQLAlchemy 2.0 (DeclarativeBase) で実装
- backend/app/models/ に entity ごとにファイル分割
  - user.py, project.py, qcds.py, vendor.py, quote.py, order.py, invoice.py,
    progress.py, scan.py, edit_history.py, master.py (印紙税表、採番管理)
- 全モデルに created_at, updated_at（mixin推奨）
- 論理削除対象（Project）には deleted_at
- ENUM は SQLEnum で定義
- リレーションは relationship() で双方向
- Alembic初期化：alembic init alembic
- 初回マイグレーション生成
- シードスクリプト backend/scripts/seed.py
  - 管理者ユーザー (admin@clap-corp.example, パスワードは環境変数から)
  - 印紙税テーブル（QCDS印紙税シートの全行を投入）※下記参照
  - サンプル業者 (HIT, 開拓工業, 山春組, つくーる)
- 動作確認手順を README に追記

印紙税テーブルの初期データはExcelのQCDS「印紙税額算定表」シートに準じます。
具体的な金額帯と印紙税額は次のファイルから読み取って投入: @data/stamp_tax.csv
(このCSVは私が後で用意します。まずはマスタテーブルの定義とサンプル数行で動かしてください)

完了したら以下のコマンドが動くか確認してください：
- docker compose -f docker-compose.dev.yml up -d
- cd backend && uv run alembic upgrade head
- cd backend && uv run python scripts/seed.py
- Adminerで全テーブルが存在しシードデータが入っていること
```

### テンプレート 13-3：Step 2-2 案件詳細画面

```
@docs/02_設計書_Part1.md の 2.2, 3.2, 4.2 を読みました。
これから Step 2-2「案件詳細・編集」を実装してください。

要件（バックエンド）：
- GET /api/v1/projects/{id} で案件詳細を返す
  - QCDS、見積、注文、請求、進捗の件数も含めて返す
  - 編集権限フラグ (can_edit: bool) を計算して付与
- PATCH /api/v1/projects/{id} で案件更新
  - 権限チェック: admin or created_by のみ
  - 楽観的ロック: リクエストの If-Unmodified-Since と updated_at 比較、不一致は 409
  - 編集履歴自動記録（SQLAlchemy event listener、設計書8.3を実装）

要件（フロントエンド）：
- frontend/src/app/projects/[id]/page.tsx
- 設計書 4.2 のレイアウトを忠実に再現
  - 左カラム: 案件情報（工事名、場所、発注者、工期、区分、支払条件、概要、客先担当、当社担当）
  - 右カラム: 工事割出テーブル、現場経費計
  - 下部: 取決見通表（30行のテーブル、Week 3まではプレースホルダーで可）
  - クイックリンク: QCDS、見積書、注文書、請求書、進捗、履歴
- 編集モード切替ボタン
- 保存時の楽観的ロック衝突表示
- ステータスドロップダウン（編集権限なくても変更権限を別途定義するか相談）

判断保留しているので、進める前に質問してください：
- ステータス変更は「編集権限がない人でも変更可能にする」か「編集権限者のみ」か？
- 工期(見積/契約/実施)の3種類は全部表示するか、タブ切替か？
- 取決見通表の編集は同じ画面でやるか、別画面か？

shadcn/ui コンポーネントを優先利用してください。
```

### テンプレート 13-4：Step 3-3 Gemini API連携

```
@docs/02_設計書_Part1.md の 5.1, 5.2, 5.3 を読みました。
これから Step 3-3「Gemini API連携」を実装してください。

要件：
- backend/app/services/gemini_scanner.py
  - クラス: GeminiScanner
  - メソッド: scan(file_path: Path, file_type: ScanFileType) -> ScanResultSchema
  - PDF: pdf2image でページごと PNG 化、複数ページを Gemini に同時送信
  - 画像: そのまま送信
  - Excel: openpyxl で全シート全セルを読み取り、Markdownライクなテキスト化してテキストプロンプトに含める
  - レスポンスは responseSchema で構造化出力を強制
  - 設計書 5.2 の Pydantic スキーマを使う
  - エラーハンドリング: HTTPエラー、JSONパース失敗、信頼度低すぎ
  - リトライ: 指数バックオフ (1s, 2s, 4s, 8s, 最大4回)、HTTP 529 は専用処理
  - ログ: 入力ファイル、使用モデル、レスポンス概要、処理時間
- backend/app/tasks/scan_tasks.py
  - Celery タスク: process_scan_job(scan_job_id)
  - DB更新: status の遷移（pending→processing→succeeded/failed）
  - 解析結果を scan_results, scan_result_items に保存
  - 業者名で vendors を fuzzy matching（pg_trgm の similarity 関数を使う）
- テスト用にダミーPDF/画像/Excelを用意（@tests/fixtures/scan/）
- ユニットテスト: モックされたGeminiレスポンスでパース成功・失敗・信頼度低を検証

注意：
- Gemini APIキーは環境変数 GEMINI_API_KEY、コードにハードコードしない
- モデルは初回 gemini-2.5-pro、失敗時に gemini-2.5-flash フォールバックを検討（コスト削減）
- gemini-2.5-pro の Vision 機能を使うのは初めての可能性があるので、
  使い方が不明なら最新の公式ドキュメントを Web 検索してから着手してください
```

### テンプレート 13-5：Step 5-1 Excelインポート

```
@docs/02_設計書_Part1.md の 第7章「Excelインポート設計」を読みました。
これから Step 5-1「Excelインポート」を実装してください。

要件：
- backend/app/services/excel_importer.py
  - クラス: ExcelImporter
  - 入力: Excelファイル(.xlsx)
  - 処理:
    1. シート構成チェック（工事台帳、QCDS、見積書表紙、内訳書、注文書・請書、請求書）
    2. 各シートからセル座標で値を抽出（cell_mappings.yaml 使用）
    3. 既存案件との照合 (project_number で)
    4. QCDS A 直接工事の取決見通表から qcds_direct_works を生成
    5. 業者名から業者マスタ参照／自動登録（fuzzy match）
    6. インポート結果サマリを返却
- cell_mappings.yaml の作成（設計書 7.3 を初版とする）
- 検証ロジック：
  - 工事番号フォーマット (XX-X-XXX)
  - 工期の日付パース
  - 金額の数値パース（カンマ・円記号除去）
  - 工事区分の判定 (民間/官庁 など)
- API: POST /api/v1/excel/import
  - multipart で Excel を受け取り、ExcelImporter に渡す
  - dry_run パラメータで「確認のみ・実DB変更なし」モードをサポート
  - レスポンス: { created: [...], updated: [...], errors: [...], warnings: [...] }
- フロントエンド: frontend/src/app/import/page.tsx
  - ファイルアップロード
  - dry_runで結果プレビュー → ユーザー確認 → 本番実行
  - 結果テーブル表示
  - エラー・警告は詳細展開可

注意：
- Excelテンプレートが将来変わる可能性があるので、cell_mappings.yaml は外部化必須
- 添付された @工事台帳2026.xlsx の記入例シート（"工事台帳 (記入例)"）を参考に動作確認
- まずは記入例のテストケースが全件インポート成功するところまでを Step 5-1 のゴールとする
- 大量インポート用バッチは Step 5-2 で扱う
```

### テンプレート 13-6：本番デプロイ（Step 6-2）

```
@docs/02_設計書_Part1.md の 1.2, 1.3 を読みました。
これから Step 6-2「本番デプロイ準備」を実装してください。

要件：
- docker-compose.yml（本番用）作成
  - cmv3-web, cmv3-api, cmv3-worker, cmv3-db, cmv3-redis の5コンテナ
  - ボリューム: pgdata, uploads, templates
  - ネットワーク: 内部のみ。Coolify Nginx が外部公開
  - ヘルスチェック設定
  - restart: unless-stopped
- 本番用 .env.production.example
- Coolify デプロイ手順を docs/deploy.md に記載
  - リポジトリ連携
  - ビルドパック選択（Docker Compose）
  - 環境変数設定
  - SSL設定（Let's Encrypt）
  - ドメイン設定（MuuMuoDomain の DNS A レコード設定手順含む）
- DB バックアップスクリプト
  - backend/scripts/backup.sh: pg_dump → /var/backups/cmv3/YYYY-MM-DD.sql.gz
  - cron 設定例 (毎日深夜2時)
  - 保持期間: 7日
  - 復元手順を docs/operations.md に記載
- 監視
  - UptimeRobot 無料枠で /api/v1/health を5分ごとチェック
  - 設定手順を docs/operations.md に記載
- セキュリティチェックリスト
  - CORS の ALLOWED_ORIGINS 本番値
  - JWT_SECRET の生成と保管
  - PostgreSQL のパスワード強度
  - Redis にパスワード設定
  - rate limiter（slowapi）の設定
  - HTTPS 強制リダイレクト
  - HSTS ヘッダ

本番デプロイ前に既存の WebARENA Indigo VPS の状態（既存 invoice app が動いている）と
ポート競合・リソース使用率を確認した上で進めてください。
Coolify上で別アプリケーションとして登録する想定です。
```

---

## 14. テスト計画

### 14.1 単体テスト（バックエンド）

| 領域 | テスト対象 | カバレッジ目標 |
|---|---|---|
| 認証 | login/refresh/permission decorator | 80% |
| 工事番号採番 | generate_project_number（同年同社員の連番、複数年） | 100% |
| 印紙税算定 | calculate_stamp_tax（境界値、適用日切替） | 100% |
| QCDS計算 | 直接工事費、現場経費、経費、営業利益の算出 | 90% |
| Excelインポート | cell_mappings に基づくパース、エラーハンドリング | 70% |
| Gemini解析 | モックレスポンスのパース、信頼度評価 | 70% |
| 編集履歴 | event listener、JSON diff | 80% |

### 14.2 統合テスト

| シナリオ | 内容 |
|---|---|
| 案件ライフサイクル | 作成→QCDS→見積→注文→施工→請求→入金 |
| 業者見積スキャン | アップロード→Celery処理→レビュー→QCDS転記 |
| Excelインポート→エクスポート | 同じ案件で値が変わらないこと |
| 権限制御 | 別ユーザーの編集試行が拒否されること |

### 14.3 E2Eテスト（Playwright）

主要5シナリオ：

1. ログイン→案件一覧→新規作成→詳細表示
2. 既存案件の編集→PDF出力→Excel出力
3. 業者見積（PDF）アップロード→Gemini解析→QCDS転記
4. Excelファイル一括インポート
5. ダッシュボードのKPI表示と絞り込み

### 14.4 受入テスト（UAT）

社内ユーザー数名に1週間使ってもらう。チェック項目：

- [ ] 各役割（社長、部長、経理、営業、工事）の利用シナリオが完遂できる
- [ ] 既存Excelで作成中の案件をWebに引き継げる
- [ ] Web案件をExcelダウンロードして既存のワークフローでも使える
- [ ] 業者見積スキャンが3社中2社以上で実用レベル（手修正10項目以内）
- [ ] PDF/Excel出力が顧客提出可能な品質
- [ ] スマホでの閲覧（ダッシュボード・案件詳細）が読める

---

## 15. リスク対応と緊急時の運用

### 15.1 障害対応フロー

1. UptimeRobotから通知 → Slack通知
2. Coolify管理画面でコンテナ状態確認
3. ログ確認（structlog出力）
4. 直近のデプロイ履歴確認、必要に応じてCoolifyからロールバック
5. 復旧後、ポストモーテムを記録

### 15.2 データ復旧

- DB破損時：直近のpg_dumpバックアップから復元（最大1日分のデータロス）
- 写真・図面：VPSローカル＋（Phase 2では）Canonサーバーの二重化

### 15.3 Gemini API停止／コスト急増

- 抽象化レイヤを噛ませているので Claude API、OpenAI Vision に切替可能
- スキャン処理は手動入力で代替可能（UIに「スキャンなしで手入力」ボタン）

### 15.4 Coolify自体のトラブル

- 移行先候補：素のDocker Compose運用、Dokploy、Caddy + systemd
- 一度動いた docker-compose.yml は Coolify を介さずとも起動可能な構成

---

## 16. 次に何をするか（本人向けTODO）

1. **本書のレビュー**：違和感ある箇所、追加要件があれば修正
2. **Canon サーバーの仕様調査**：製品名、ネットワーク経路、認証方式
3. **印紙税テーブルのCSV化**：QCDS印紙税シートからCSV抽出
4. **見積条件書の文章マスタ化**：現行の条件文をテキストファイルに切り出し
5. **基本契約約款のマスタ化**：注文書の右側にある第1条〜第N条
6. **GitHubリポジトリ作成**：`Hisamori-T/construction-manager-v3` をprivate新設
7. **本書一式 (docs/) をリポジトリにコミット**
8. **VSCode + Claude Code でリポジトリを開き、テンプレ13-1から順に流す**

---

## 付録 A：Excelとの対応表（主要セル）

工事台帳シートの主要セルとデータベースカラムの対応。Excelインポート／エクスポートの両方で使う。

| Excelセル | カラム | 例示値 |
|---|---|---|
| L11 | project_number | `026-1-001` |
| L12 | project_name | `アル・プラザ アミ 改修工事` |
| L14 | project_location | `〒919-0413 福井県坂井市春江町随応寺16-11` |
| L16 | client_name | `株式会社 平和堂` |
| L18 | original_client_name | （元発注者） |
| L19, X19 | period_quote_* | 工期(見積) |
| L20, X20 | period_contract_* | 工期(契約) |
| L21, X21 | period_actual_* | 工期(実施) |
| L22 | order_type | `民間 ・官庁` |
| T22 | contract_type | `元請 ・下請` |
| AA22 | awarding_type | `特命 ・競争` |
| L23 | payment_condition | `工事完了後毎月20日〆翌月10日一括現金払い` |
| B26〜 | project_summary | 工事概要 |
| L33 | prev_construction_type | `当社 (`年施工`)` `他社 (`）` |
| Q34 | client_contact_company | `株式会社 平和堂` |
| Q35 | client_contact_person | `店舗建設部 〇〇〇〇` |
| Q36 | client_contact_phone | |
| L37 | sales_person | (営業) |
| L38 | construction_person | (工事) |
| BB11 | project_price | `3,000,000` |
| AS14 | direct_construction_budget | `2,350,000` |
| AS15 | site_overhead | `#N/A`(計算式) |
| AS17 | overhead | `300,000` |
| AS19 | operating_profit_1 | `#N/A` |
| AS20 | target_operating_profit | `300,000` |
| BH5 | quote_no | `26-APアミ①` |
| 24〜53行 AJ〜CT | direct_works行 | 1〜30行の取決見通表 |

（完全版は cell_mappings.yaml で管理）

---

## 付録 B：用語集

| 用語 | 説明 |
|---|---|
| 工事台帳 | 案件単位の管理シート。本システムの中心エンティティ |
| QCDS | Quality・Cost・Delivery・Safety。クラップ社の原価算定表の呼称 |
| 直接工事費 | 外注・資材・その他の合計 |
| 現場経費 | 労災・工事保険・印紙代・事務用品・通信交通・雑費の合計 |
| 経費 | 共通経費・一般管理費 |
| 営業利益① | 直接工事費 + 現場経費 + 経費 を引いた利益 |
| 取決見通表 | 業者ごとの取決金額、月別支払予定の一覧 |
| 取決伺 | 専門業者への発注決裁 |
| 印紙税 | 契約金額に応じて課税される印紙代 |
| 注文書・注文請書 | 顧客との契約書ペア |
| QCDS A〜C | A=直接工事、B=経費、C=その他経費 |

---

以上、設計書 Part 2。
