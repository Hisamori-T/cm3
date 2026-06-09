# Session Log

## ワークスペース概要

### ルール
- 設計書のStepに従って順番に実装する
- 各Stepの動作確認チェックリストを満たさないと次に進まない
- 不明点はひささんに必ず質問。勝手な解釈で進めない（名前は必ず「ひささん」）
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

### 過去ログ
- [session_log_2026-05.md](session_log_2026-05.md) — 2026年5月（Phase 1〜7 基盤構築完了）

---

## 5月からの引継ぎ

### 完了済み（Phase 1〜7）
- **Phase 1**: Docker環境・FastAPI・Next.js・DB・認証・案件CRUD・QCDS・見積書
- **Phase 2〜5**: スキャン機能・業者見積・顧客見積（版/大項目/稟議承認）
- **Phase 6**: Estimate モジュール分割（qcds / quote_core / quote_versions / quote_sections）
- **Phase 7**: Report / Customer / Vendor / Auth / Admin / Schedule / Site / Purchase モジュール集約
  - `main.py` を `modules/*` 直接 include_router 構造に全面書き換え

### 継続中・引継ぎ事項
- PDF 出力（WeasyPrint + Noto CJK JP）: 見積書・請求書・注文書・注文請書・写真台帳 実装済み
- 承認ワークフロー（approvals.py）実装済み・稟議ページ動作確認済み
- 工事台帳（Phase G-1〜G-3）: DB・API・フロント実装済み、G-4（PDF/Excel 出力）は未着手
- VPS: `cmv3.fact-ally.com` で稼働中、cmv3-api / cmv3-web / cmv3-worker / cmv3-nginx 全正常

### 残課題（6月対応予定）
- 工事台帳 G-4: PDF/Excel 出力
- Phase R-1: 出来高・控除・支払通知書（案件立場 element、請求書フロー分岐）
- 発注書ステータス管理・支払カレンダー（実装済みだが動作確認要）
- ダッシュボード：未入金アラーム・担当者別稼働時間（実装済み）

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
- 権限チェックを 
oles[] 配列対応に更新（super_admin も削除可能に）
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

### 作業結果

**① 工事台帳 Excel 500エラー修正**
- `exports.py`: `excel_export.export_project_all_excel`（旧モジュール・フィールド名ミスで AttributeError）→ `new_excel_export.export_project_all_excel` に変更
- `excel_export.py`（新モジュール）は `getattr` で安全にアクセスしており 500 が解消

**② 工事台帳 PDF 改善**
- A4横 → A3横（`@page { size: A3 landscape; }`）
- `精算（支払）見通し` 列を追加（settlement_amount）・合計行にも追加
- Excel・PDF 出力ボタンに `生成中…` ローディング状態を追加（disabled + 色変化）
- 承認印の split 正規表現を `split(" ")` → `split(/[\s　]/)` に修正（全角スペース対応）

**③ QCDS PDF/Excel カテゴリ日本語化 + A3横**
- `pdf_export.py`: `_QCDS_CATEGORY_JA` マップ追加・`_category_ja()` ヘルパー関数追加
  - subcontract → 外注 / material → 資材 / other → その他
- QCDS PDF: A4横 → A3横・工種列削除・精算見通し列追加・合計行追加
- `excel_export.py`: QCDS Excel の区分列も日本語化

**④ 注文請書 取込改善**
- `acknowledgment/page.tsx`: `terms_and_conditions` をフェッチ型定義に追加・`setTerms()` で反映
- `acknowledged` ステータスの注文書も発行済み扱いに
- confirm ダイアログに反映項目一覧を表示
- 成功トーストに実際に反映した項目名を列挙（例: 発行日・受注者・工期・約款）

### 変更ファイル
- backend/app/modules/report/routers/exports.py
- backend/app/modules/report/services/excel_export.py
- backend/app/modules/report/services/pdf_export.py
- frontend/src/app/projects/[id]/page.tsx
- frontend/src/app/projects/[id]/acknowledgment/page.tsx

### デプロイ
- commit: 1db456c / GitHub push 済み
- cmv3-api: docker cp + restart → Up 確認済み
- cmv3-web: docker build + up -d → Up 確認済み

### 次のアクション
- 工事台帳「Excel出力」が 500 エラーなく DL できることを確認
- 工事台帳「PDF出力」が A3横・精算見通し列ありで出力されることを確認
- QCDS「PDF/Excel」の区分列が日本語（外注・資材・その他）で表示されることを確認
- 注文請書「注文書から取込」で約款が反映され、トーストに反映項目が表示されることを確認
- 承認印が苗字のみ表示されることを確認

---

## Session 2026-06-08（続き）— 請求書システム 再設計レビュー

### 作業内容（予定）
- ひささんからの設計フィードバック（①Pros / ②Cons / ③④ワイヤーフレーム / ⑤会計連携）をもとに、前回 Claude が提案した請求書設計の矛盾・ルール逸脱を検証し、改訂版設計を提案する

### 作業結果

#### 既存コードとの整合性確認
- `invoice_phase` と `split_sequence/split_total` は **補完関係（競合なし）**
  - `invoice_phase`：請求の段階（前払/中間/完成）
  - `split_sequence`：その段階内での分割番号（例: 2/3回目）
- `InvoiceItem`（追記行・正）と `InvoiceDeduction`（控除行・負）は **役割が異なり競合なし**
- `cumulative_billed` は **計算値で保存不要**（保存すると不整合リスク）

#### ルール準拠確認（全項目 OK）
- 論理削除：`invoice_deductions.is_deleted = True` で対応
- 編集履歴：親 Invoice の `edit_histories` に控除変更を記録
- Alembic マイグレーション：全スキーマ変更経由
- SQLAlchemy 経由：直接 DB 操作なし
- 発行後ロック：`draft` 以外で控除変更を拒否する API ガード

#### フィードバックへの対応方針
| 指摘 | 対応 |
|---|---|
| ① JSONB の集計コスト | 正規化テーブル `invoice_deductions` に変更（JSONB 廃止）|
| ② スナップショット保持 | `invoices` に `project_role_snapshot` / `contract_amount_snapshot` を追加、発行時に自動転記 |
| ③ R-2 工数爆発リスク | `client_invoice_templates` 廃止、freee/MF 連携用 標準 CSV のみ提供 |

#### 改訂版スキーマ（主要変更のみ）

```
# projects テーブル追加
project_role: VARCHAR(10) NULLABLE  -- 'prime' | 'sub' | 'public'

# invoices テーブル追加
invoice_phase: VARCHAR(20) NULLABLE            -- 'advance'|'interim'|'final'|'partial'
project_role_snapshot: VARCHAR(10) NULLABLE    -- 発行時スナップショット
contract_amount_snapshot: NUMERIC(12,0) NULLABLE

# 新テーブル invoice_deductions
id, invoice_id(FK), name, amount, deduction_type(auto_percent|manual),
calculation_rate, account_hint(任意), is_deleted, row_no
```

#### 改訂版エンドポイント
```
PATCH  /projects/{id}/role
POST   /invoices/{id}/deductions
DELETE /invoices/{id}/deductions/{did}  → is_deleted = True (draft のみ)
GET    /invoices/{id}/progress-summary  → cumulative_billed / outstanding_contract を動的計算
GET    /invoices/{id}/payment-notice-pdf
```

#### 3フェーズ（改訂）
- **R-1**：コアスキーマ追加 + 出来高入力 UI + 控除入力 UI + 支払通知書 PDF
- **R-2**：累計管理 UI 完成 + freee/MF 標準 CSV 出力
- **R-3**：インボイス制度対応 / 電子帳簿保存法ロック / 法定福利費 / 仕訳 CSV 出力

### 未確認事項（ひささんへの質問）
1. `project_role` を追加した場合、案件一覧にフィルター追加が必要か（R-1 ではスキップ可？）
2. 控除の `account_hint`（勘定科目ヒント）は R-1 から入力させるか？
3. 支払通知書は実際の業務で必要か（元請として下請に渡すケースが発生しているか）

### ひささんからの回答（2026-06-08）

**Q1. `project_role` フィルター**
- **R-1 で必須**
- 理由：元請/下請が混在すると誤ったフォーマット発行等のオペレーションミスを誘発する
- 実装内容：複合検索は不要。一覧での「役割バッジ表示」＋「元請/下請/公共のタブ or プルダウン絞り込み」のみ

**Q2. `account_hint`（勘定科目ヒント）**
- **R-3 まで完全不要**
- R-1 では `deduction_type_enum`（安全協力会費・立替金など）の選択のみ
- R-3 実装時に「管理画面マスタ設定で Enum 値に対して勘定科目を一括紐付け」する設計とする

**Q3. 支払通知書の業務発生有無**
- **ヒアリング必須（最重要事項）**
- ターゲットが「専門工事業者（二次・三次下請け）」の場合 → 支払通知書・控除査定機能は完全なオーバースペック
  - R-1 スコープから除外し、「下請としての出来高請求書」の使い勝手に全リソースを集中
- ターゲットが「元請・一次下請の立場も持つ会社」の場合 → R-1 で予定通り実装

### R-1 実装スコープ（回答を踏まえた最終確定版）

| 機能 | 判定 | 備考 |
|---|---|---|
| `project_role` カラム追加（projects） | ✅ R-1 必須 | |
| 案件一覧: 役割バッジ + 絞り込み | ✅ R-1 必須 | タブ or プルダウン |
| `invoice_phase` / スナップショット追加 | ✅ R-1 必須 | |
| `invoice_deductions` テーブル | ✅ R-1 必須 | `account_hint` は列定義のみ・UI は R-3 |
| 出来高入力 UI（下請フロー） | ✅ R-1 必須 | |
| 控除入力 UI（元請フロー） | ✅ R-1 必須 | |
| 支払通知書 PDF | ⚠️ ヒアリング後に決定 | 業務発生しなければ除外 |
| `account_hint` UI 入力 | ❌ R-3 以降 | |
| freee/MF 連携 CSV | ❌ R-2 以降 | |

### 次のアクション
- 支払通知書（Q3）の業務ヒアリング結果を確認する
- ヒアリング結果を踏まえ R-1 実装を開始する

---

## Session 2026-06-08（続き）— 請求書 Phase R-1 設計書執筆

### 作業内容（予定）
- Q3 確定：支払通知書 R-1 で実装（必須要件と確定）
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md` に Phase R-1 の完全設計を追加
  - 新 Enum 定義（ProjectRole / InvoicePhase / DeductionType）
  - DB スキーマ差分（projects / invoices テーブル追加列 + invoice_deductions 新テーブル）
  - SQLAlchemy 2.0 スタイルのモデル定義
  - Alembic マイグレーション SQL
  - 新 API エンドポイント一覧
  - UI 画面仕様（出来高入力 / 控除査定 / 支払通知書 PDF）

### 作業結果

**設計書 セクション 10「請求書システム Phase R-1」追加完了**

`docs/specs/設計書_06_機能拡張仕様_2026-06.md` に以下10サブセクションを追加：

| # | 内容 |
|---|---|
| 10.0 | スコープ確定テーブル（R-1/R-2/R-3 分類） |
| 10.1 | 新 Enum 定義（ProjectRole / InvoicePhase / DeductionType） |
| 10.2 | DB スキーマ差分 SQL（projects / invoices / invoice_deductions） |
| 10.3 | SQLAlchemy 2.0 モデル定義（Invoice 追加列 / InvoiceDeduction 新クラス / Project 追加列） |
| 10.4 | Alembic マイグレーション（upgrade/downgrade 完全版） |
| 10.5 | 新 API エンドポイント（role変更/progress-summary/控除CRUD/支払通知書PDF） |
| 10.6 | Pydantic スキーマ追加/変更分 |
| 10.7 | サービス層 控除計算ロジック |
| 10.8 | フロントエンド UI 仕様（バッジ/出来高入力/控除入力/支払通知書PDF） |
| 10.9 | 編集履歴記録方針（親 Invoice の edit_histories に記録） |
| 10.10 | 実装ファイル一覧（Backend/Frontend 全対象ファイル） |

**既存コードとの整合性確認事項**:
- `ContractType`（prime/sub）は既存。`ProjectRole` は新規 enum（public を含む）
- `InvoiceStatus` は既存のまま変更なし。`InvoicePhase` は別概念として追加
- `BillingMethod` と `InvoicePhase` は役割が異なり競合なし
- 既存 `Invoice.items`（InvoiceItem）と新規 `Invoice.deductions`（InvoiceDeduction）は役割が異なり競合なし

### 変更ファイル
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md`（セクション 10 追加）

### 次のアクション
- 設計書をもとにバックエンド実装を開始する
  1. Alembic マイグレーション作成・適用
  2. Enum / モデル / スキーマ追加
  3. API エンドポイント実装
  4. フロントエンド UI 実装

---

## Session 2026-06-08（続き）— スキーマ型定義改訂（金額フィールド）

### 作業内容（予定）
- ひささんからの提案「金額フィールドは `float` ではなく `int` / `Decimal` に統一」を採用
- 設計書 10.6 の Pydantic スキーマを修正版で上書き
  - 金額フィールド（amount 等）: `float` → `int`
  - 率フィールド（calculation_rate 等）: `float` → `Decimal`
  - バリデーター・型エイリアス（Yen / Rate）追加
  - 7点の不備（InvoiceDeductionUpdate 欠落 / ProgressSummaryResponse 欠落 等）も同時反映

### 作業結果

**設計書 10.6 を確定版スキーマで上書き完了**

主な変更点：
- 型方針を冒頭に明記（`float` 禁止・`int`/`Decimal` 理由付き）
- `Yen = Annotated[int, Field(ge=0)]` / `Rate = Annotated[Decimal, ...]` 型エイリアス追加
- `InvoiceDeductionCreate`: `float` → `int/Decimal` + `@model_validator` バリデーター追加
- `InvoiceDeductionUpdate`: 新規追加（欠落していたクラス）
- `InvoiceDeductionRead`: `float` → `int/Decimal` + `is_deleted`, `created_at` フィールド追加
- `ProgressSummaryResponse`: 新規追加（欠落していたクラス）
- `ProjectRoleUpdate`: 新規追加（欠落していたクラス）
- 既存 `InvoiceCreate/Update/Read`, `Project*` への追加列をコメント形式で明記
- `Decimal` の JSON シリアライズ注意事項を追記

既存コードの `float` 残存は別スプリントで対応（R-1 スコープ外）。

### 変更ファイル
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md`（10.6 上書き）

### 次のアクション
- 設計完了。バックエンド実装を開始する

---

## Session 2026-06-08（続き）— Phase R-1 詳細設計（コントローラー/サービス/PDF/フロントエンド）

### 作業内容（予定）
設計書 10.11〜10.14 として以下4セクションを追加する：
- 10.11: ルーティング・エンドポイント骨格設計（コントローラー層）
- 10.12: サービス層 詳細設計（関数シグネチャ・ロジック・エラー処理）
- 10.13: 支払通知書 PDF レイアウト詳細設計（WeasyPrint）
- 10.14: フロントエンドコンポーネント設計（型定義・props・状態管理）

### 作業結果

設計書 `docs/specs/設計書_06_機能拡張仕様_2026-06.md` に 10.11〜10.14 を追加：

**10.11 コントローラー層設計**
- 既存 `invoices.py`/`project/router.py` のパターン（`_to_read()`・`structlog`・`APIRouter`）を踏襲した骨格コードを記載
- `PATCH /projects/{id}/role` / `GET progress-summary` / 控除CRUD 5本 / `GET payment-notice-pdf` の計8エンドポイント
- 既存 `_to_read()` 関数への R-1 追加フィールド拡張方法を明記
- 発行時スナップショット転記の追記箇所（既存 status 変更処理内）を明記

**10.12 サービス層詳細設計（deduction_service.py）**
- 関数一覧: `add_deduction` / `update_deduction` / `remove_deduction` / `get_progress_summary`
- ヘルパー: `_guard_draft`（draft 以外拒否） / `_calc_amount`（rate or 手動） / `_recalculate_totals`（集計→Invoice更新）
- `get_progress_summary`: SQL `func.sum` で動的計算・`Decimal` で進捗率計算
- 下請業者名の取得元を暫定設計し、実装時確認事項として明記

**10.13 支払通知書 PDF 設計（WeasyPrint）**
- A4縦 レイアウト・テーブル構成・ASCII アスキーアートで全体図を明記
- `_PAYMENT_NOTICE_CSS` + `generate_payment_notice_pdf()` + `_render_payment_notice_html()` のコードを設計
- 支払予定日・支払方法フィールドの不足を実装時確認事項として明記

**10.14 フロントエンドコンポーネント設計**
- 型定義: `DeductionType` / `DEDUCTION_LABEL` / `InvoiceDeductionRead` / `ProgressSummaryResponse` / `ProjectRole` / `PROJECT_ROLE_LABEL` / `PROJECT_ROLE_COLOR`
- ① `RoleBadge` コンポーネント（色・ラベル一覧）
- ② `ProgressSection`（% ⟺ 金額 双方向連動・progress-summary API 呼び出し）
- ③ `DeductionSection`（追加/削除フォーム・rate%→Decimal 変換）
- ④ 支払通知書 PDF ダウンロードボタン（表示条件: prime かつ deductions.length > 0）

### 変更ファイル
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md`（10.11〜10.14 追加）

### 次のアクション
- 設計フェーズ完了。実装開始の承認をもらう
- 実装時の確認事項（下請業者名フィールド・支払方法フィールドの要否）をひささんに確認

---

## Session 2026-06-08（続き）— アーキテクチャルール準拠チェック → 設計書 10.11/10.12 修正

### 作業内容（予定）
アーキテクチャルールチェックで発見した4点の問題を設計書に反映する：
- 🔴 Rule 2 違反: project + report モジュールを同時変更 → 実装フェーズを R-1a〜d に分割
- 🔴 URL 不一致: `/{invoice_id}/deductions` → `/projects/{pid}/invoices/{iid}/deductions`
- 🟡 `_DEDUCTION_LABEL_JA` 定数の重複 → `shared/constants/deduction.py` に一元化
- 🟡 `_check_edit_permission` の存在未確認 → grep 結果を踏まえてインライン実装を明記

### 作業結果

`docs/specs/設計書_06_機能拡張仕様_2026-06.md` の 10.11・10.12 を全面修正：

**10.11 修正内容**
- タイトルに「【アーキテクチャルール修正済み】」を付記
- 冒頭に適用ルール確認表を追加（Rule 2・URL一貫性・権限チェック・既存パターン）
- **実装フェーズ分割テーブル追加（Rule 2 準拠）**
  - R-1a: shared + models + schemas + alembic
  - R-1b: `modules/project` のみ（PATCH role）
  - R-1c: `modules/report` のみ（控除CRUD・summary・snapshot・PDF）
  - R-1d: frontend のみ
  - 「R-1b と R-1c は別コミット・別セッションで実施すること」を明記
- 権限チェック: `_check_edit_permission`（存在しない）→ 既存パターンのインライン3行に修正
- URL パターン修正: `/{invoice_id}/deductions` → `/projects/{pid}/invoices/{iid}/deductions`
- 全エンドポイント関数シグネチャに `project_id: uuid.UUID` 引数を追加

**10.12 修正内容**
- タイトルに「【アーキテクチャルール修正済み】」を付記
- **`backend/app/shared/constants/deduction.py` 新規ファイル設計を追加**（Rule 1 準拠）
- `deduction_service.py` の `_DEDUCTION_LABEL` ローカル定義を削除
- `from app.shared.constants.deduction import DEDUCTION_LABEL_JA` に変更
- `_get_invoice_or_404` に `project_id` 引数を追加（URL の project_id と invoice.project_id を照合）
- 全サービス関数シグネチャに `project_id: uuid.UUID` を追加
- `_calc_amount` に税抜ベース計算の注釈を追加（「税込ベースにする場合は total_amount に変更」）
- `pdf_export.py` 側の `shared` import 指示を末尾に追記

### 変更ファイル
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md`（10.11・10.12 修正）

### 次のアクション
- 設計完了。実装開始の承認を得る

---

## Session 2026-06-08（続き）— 優先バグ修正 5件

### 作業内容（予定）
- ① 印影: `stamp_text` をスタンプ表示・PDF に反映（工事台帳承認 / 顧客見積PDF）
- ② 受注額: 案件一覧の受注額がゼロ → 参照先確認・修正
- ③ 工事台帳 Excel/PDF: 全データ出力（案件情報・担当者・承認印・工事価格・予算/取決/精算）
- ④ QCDS Excel/PDF: UIに表示される全データを出力
- ⑤ 顧客見積 ステータス: 詳細画面内に移動 + QuoteStatus.approved 追加 + 承認完了時の自動承認済み

### 作業結果

**① 印影修正**
- `ledger_router.py`: `LedgerApprovalRead` に `approver_stamp_text` フィールド追加
  - `_stamp()` ヘルパー: `stamp_text` 優先、未設定なら `full_name` の姓
- `exports.py`（見積書PDF）: `stamp_text` を fetch して `stamp_users` に格納（旧: `full_name` のみ）
- `pdf_export.py`: `_stamp_td` の split 廃止（`stamp_users` が既に解決済みの値を持つため）
- `page.tsx`: `a.approver_stamp_text ?? a.approver_name.split()[0]` で表示
- TypeScript `LedgerApproval` インターフェースに `approver_stamp_text: string | null` 追加

**② 受注額**
- `router.py` の `_to_list_item`: `project_price` が 0/null の場合、発行済み・承認済み見積の最大 `total_amount` をフォールバック
- `selectinload(Project.quotes)` をリスト用クエリに追加

**③ 工事台帳 PDF**
- `exports.py` の ledger エンドポイント: `LedgerApproval`・担当者を eager load し承認印データを構築
- `pdf_export.generate_ledger_pdf()`: 案件情報グリッド・担当者・承認印5枠・直接工事費テーブル・工事割出サマリーを全出力（A3横）

**④ QCDS PDF/Excel**
- `exports.py`: QCDS PDF/Excel エンドポイントで `selectinload(QCDS.expense_items)` 追加
- `pdf_export.generate_qcds_pdf()`: 現場経費テーブル（`QCDSExpenseItem`）を追加
- `excel_export.export_qcds_excel()`: 現場経費明細シート（項目名・金額）を追加

**⑤ 顧客見積 ステータス変更**
- `shared/models/enums.py`: `QuoteStatus.approved = "approved"` 追加
- `alembic/versions/a1b2c3d4e5f6_add_quote_approved_status.py`: 新規マイグレーション（`ALTER TYPE quotestatus ADD VALUE 'approved'`）
- `alembic/versions/merge_heads_2026.py`: 複数ヘッド解消のためのマージマイグレーション追加
- `quote_core.py`: スタンプ押印時、全3スタンプ完了で `status = QuoteStatus.approved` を自動設定
- `quote/page.tsx`: ステータス変更ボタンを一覧から削除（「詳細で変更」テキストに差し替え）
- `quote/[quote_id]/page.tsx`: `handleStatusChange()` + ステータスボタン（発行済みに / 下書きに戻す / 承認済みに）を詳細ページのアクションエリアに追加

### 変更ファイル
- backend/app/modules/project/ledger_router.py
- backend/app/modules/project/router.py
- backend/app/modules/report/routers/exports.py
- backend/app/modules/report/services/pdf_export.py
- backend/app/modules/report/services/excel_export.py
- backend/app/shared/models/enums.py
- backend/app/modules/estimate/routers/quote_core.py
- backend/alembic/versions/a1b2c3d4e5f6_add_quote_approved_status.py（新規）
- backend/alembic/versions/merge_heads_2026.py（新規）
- frontend/src/app/projects/[id]/page.tsx
- frontend/src/app/projects/[id]/quote/page.tsx
- frontend/src/app/projects/[id]/quote/[quote_id]/page.tsx

### デプロイ
- commit: 211745d / GitHub push 済み
- Alembic `upgrade heads` 適用済み（approved enum + merge）
- cmv3-api: Up 確認済み
- cmv3-web: rebuild + Started 確認済み

### 次のアクション
- ① 工事台帳承認スタンプが `stamp_text`（例: たいら）で表示されることを確認
- ② 案件一覧の 26-1-001 受注額が ¥0 → 見積金額に変わることを確認
- ③ 工事台帳 PDF に承認印・案件情報・全テーブルが出力されることを確認
- ④ QCDS PDF/Excel に現場経費が出力されることを確認
- ⑤ 顧客見積詳細ページにステータス変更ボタンがあること・全スタンプ完了時に自動承認されることを確認

---

## Session 2026-06-08（続き）— スクショ再開 + アーキテクチャルール準拠チェック

### 作業内容（予定）
- スクショで中断された `pdf_export.py` の `_terms_html` 修正が完了済みか確認
- 設計書 10.11〜10.14（R-1 フェーズ: 請求書控除・案件立場・支払通知書PDF）のアーキテクチャルール違反チェック
  - 不正なクロスインポート（Rule 1）
  - 変更の局所性（Rule 2）
  - UI とロジックの分離
  - Shared の利用状況

### 作業結果

**① スクショ作業（_terms_html fix）の完了確認と残修正**
- `_terms_html()` 関数は `pdf_export.py` line 1214 に追加済み（前セッションで完了）
- ただし `_render_acknowledgment_html` / `_render_order_html` の f-string 内が依然 `{_ORDER_TERMS_HTML}` を直展開していた（未修正）
- 修正: 各関数内で `terms_html = _terms_html(getattr(doc/ack, "terms_and_conditions", None))` を取得し `{terms_html}` に置換
- `{_ORDER_TERMS_HTML}` の直接参照が 0 件になったことを grep で確認

**② アーキテクチャルール準拠チェック（設計書 10.11〜10.14）**

| チェック項目 | 結果 | 詳細 |
|---|---|---|
| Rule 1: クロスインポート禁止 | ✅ PASS | `deduction_service.py` は同ドメイン・shim・shared のみ参照 |
| Rule 2: 局所的変更 | ✅ PASS | R-1a〜R-1d に分割済み。別コミット指示あり |
| Rule 3: UI一斉置換禁止 | ✅ PASS | 新規コンポーネント追加のみ |
| Shared 利用 | ✅ PASS | `DEDUCTION_LABEL_JA` → `shared/constants/deduction.py` |
| 権限チェック | 🟡 要修正 → **修正済み** | R-1b が旧単一ロール `current_user.role == UserRole.admin` を使用。`can_edit_project()` に変更（roles[] 複数ロール対応） |

**設計書修正箇所:**
- `10.11 R-1b`: `from app.shared.services.permissions import can_edit_project` を追加し、権限チェックを `can_edit_project(current_user, project)` に置換

### 変更ファイル
- `backend/app/modules/report/services/pdf_export.py` — `_render_acknowledgment_html` / `_render_order_html` の `{_ORDER_TERMS_HTML}` → `{terms_html}` 置換
- `docs/specs/設計書_06_機能拡張仕様_2026-06.md` — 10.11 R-1b の権限チェックを `can_edit_project()` に修正

### 次のアクション
- `pdf_export.py` 修正を VPS に反映（`docker cp` → `cmv3-api restart`）
- R-1 実装開始の承認をひささんに確認（実装前確認事項: 下請業者名フィールド・支払方法フィールドの要否）

---

## Session 2026-06-08（続き）— VPS 反映 + Phase R-1 全実装（10.1〜10.14）

### 作業内容（予定）
1. VPS に `pdf_export.py`（`_terms_html` 完全修正版）を反映
2. R-1a: `shared/constants/deduction.py` + モデル差分（`InvoiceDeduction` / `Invoice` 新カラム / `ProjectRole` Enum） + Alembic マイグレーション + スキーマ
3. R-1b: `modules/project/router.py` に `PATCH /projects/{id}/role` 追加
4. R-1c: `modules/report/services/deduction_service.py` + 控除CRUD + progress-summary + スナップショット転記 + 支払通知書 PDF エンドポイント
5. R-1d: フロントエンド — `ProjectRole` バッジ・絞り込み / 出来高セクション / 控除セクション / 支払通知書 PDF ボタン
6. VPS デプロイ（全フェーズ完了後）

### 作業結果

**VPS 反映（pdf_export.py `_terms_html`）**
- `_render_acknowledgment_html` / `_render_order_html` の `{_ORDER_TERMS_HTML}` → `{terms_html}` 置換完了
- `sudo docker cp` → `cmv3-api restart` → Up 確認

**R-1a（基盤）**
- `shared/constants/deduction.py` / `shared/models/enums.py` に3 Enum 追加（ProjectRole / InvoicePhase / DeductionType）
- `models/invoice.py`: `InvoiceDeduction` + `Invoice` 5カラム追加
- `models/project.py`: `project_role` カラム追加
- スキーマ（schemas/invoice.py / project.py）に対応フィールド追加
- Alembic `R1_invoice_role_phase_deductions` 作成

**R-1b（modules/project のみ）**
- `PATCH /projects/{id}/role` 追加（`can_edit_project()` 権限チェック）

**R-1c（modules/report のみ）**
- `deduction_service.py` 新規（add/update/remove/progress_summary）
- `invoices.py`: 控除 CRUD + progress-summary + スナップショット転記 + deductions eager load
- `exports.py`: 支払通知書 PDF エンドポイント追加
- `pdf_export.py`: `generate_payment_notice_pdf()` 追加

**R-1d（フロントエンド のみ）**
- `types/invoice.ts` / `types/project.ts`: Phase R-1 型定義追加
- `projects/page.tsx`: 立場バッジ列 + 役割絞り込みタブ
- `invoice/[invoice_id]/page.tsx`: 出来高セクション（sub）+ 控除セクション（prime）+ PDF ボタン

**VPS デプロイ**
- tar.gz 転送 → API リビルド → Alembic migration `R1_invoice_role_phase_deductions` 適用確認
- TypeScript エラー修正（fetchProjects 引数 3→4）→ Web リビルド
- `cmv3-api: Up 6min` / `cmv3-web: Up 16sec` 全コンテナ正常

### 変更ファイル
- `backend/alembic/versions/R1_invoice_role_phase_deductions.py`（新規）
- `backend/app/models/enums.py` / `invoice.py` / `project.py`
- `backend/app/modules/project/router.py`
- `backend/app/modules/report/routers/invoices.py` / `exports.py`
- `backend/app/modules/report/services/deduction_service.py`（新規）/ `pdf_export.py`
- `backend/app/schemas/invoice.py` / `project.py`
- `backend/app/shared/constants/__init__.py` / `deduction.py`（新規）
- `backend/app/shared/models/enums.py`
- `frontend/src/types/invoice.ts` / `project.ts`
- `frontend/src/app/projects/page.tsx`
- `frontend/src/app/projects/[id]/invoice/[invoice_id]/page.tsx`

### コミット
- `6acc702`: feat: Phase R-1 全実装（20 files, 1097 insertions）
- `6cdcd2f`: fix: fetchProjects 引数修正 + session_log

### 次のアクション
- https://cmv3.fact-ally.com で動作確認
- 案件に `project_role` を設定する UI の追加（案件詳細ページに立場変更ドロップダウン）
- 未確認事項（**保留** — 現行実装のまま次のステップへ進む）:
  - 下請業者名: `work_description` 流用のまま継続
  - 支払方法: `billing_note` 流用のまま継続

---

## Session 2026-06-09 — バグ修正2件・session_log 名前修正・R-1 UI 確認

### 作業内容（予定）
- ① 請求書削除後もタブバッジ④が残る → 調査・修正
- ② 請求書なし状態で「請求合計 ¥3,684,692」が残る → 調査・修正
- session_log の「ひさん」誤記を「ひささん」に一括修正
- CLAUDE.md・メモリに名前ルールを追記

### 作業結果

**バグ①②の根本原因**
- `invoice_type="split"` の子行が削除対象から除外されており、親を削除しても孤立化して DB に残留
- 孤立 split 4件（¥3,684,692）が `project_invoice_summary` ビューに集計され続けていた
- `layout.tsx` は初回マウントのみカウントを取得するため削除後もバッジが古い値のまま

**修正内容**
- `delete_invoice`: 親削除前に split 子行を cascade 削除
- `invoice_count`: `invoice_type='split'` を除外
- `project-context.tsx`: `refreshCounts` を context に公開
- `layout.tsx`: `refreshCounts()` 実装
- `invoice/page.tsx`: 削除後に `refreshCounts()` 呼び出し
- DB: 孤立 split 4件を手動 DELETE（`remaining = 0` 確認）

**名前修正**
- session_log 内「ひさん」7箇所 → 「ひささん」に一括修正
- `CLAUDE.md` 作業フロー3番に注記追記
- メモリ `feedback-user-name.md` 新規作成

**Phase R-1 動作確認の状況**
- フロントエンドは VPS にデプロイ済み
- ただし全案件の `project_role` が NULL のため、バッジ・控除/出来高セクションが表示されない
- 案件詳細に「立場変更 UI」が未実装のため、設定手段がない

### 変更ファイル
- `backend/app/modules/report/routers/invoices.py`
- `backend/app/modules/project/router.py`
- `frontend/src/contexts/project-context.tsx`
- `frontend/src/app/projects/[id]/layout.tsx`
- `frontend/src/app/projects/[id]/invoice/page.tsx`
- `CLAUDE.md`
- `memory/feedback-user-name.md`（新規）

### コミット
- `3cff828`: fix: 請求書削除後のタブバッジ・合計残存バグ修正

### 次のアクション
- 案件詳細ページに立場変更ドロップダウン（PATCH /projects/{id}/role）を追加
- 立場設定後に案件一覧バッジ・請求書の控除/出来高セクションが動作することを確認

---

## Session 2026-06-09（続き）— docs 掃除・技術的負債解消

### 作業内容（予定）
- /docs 以外のセッションログファイルを削除
- 不要 docs ファイル削除（旧設計書・Gemini作業ファイル・zip・一時ファイル・architecture/）
- フロントエンドの `toLocaleString` → `fmtYen` 統一（dashboard / projects / kanban / estimate / vendors）

### 作業結果









