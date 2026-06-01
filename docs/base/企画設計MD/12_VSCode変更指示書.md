# VSCode Claude Code 変更指示書（Phase 1.5 改修）

**プロジェクト**：Construction Manager v3
**位置づけ**：Phase 1A 完成・本番稼働後の改修
**作成日**：2026-05-18
**重要**：本指示書は **Phase単位で区切って実装** すること。1Phase完了→動作確認→commit→次Phase の順番を厳守。

---

## ⚠ Claude Code への重要事項

### 必ず守ること

1. **本指示書を最初に全文読む**。途中から実装を始めない
2. **各Phaseは独立してデプロイ可能な単位**。順序を勝手に入れ替えない
3. **既存実装を尊重**。session_log で完成している機能（V3見積システム、稟議承認、印影など）は壊さない
4. **DBスキーマ変更は必ずAlembicマイグレーション経由**
5. **本番DBにデータが入っているため、破壊的変更は事前に必ず本人確認**
6. **論理削除を物理削除に変えない**。論理削除済データを誤って削除しない
7. **不明点は実装前に必ず本人（ひささん）に質問**。勝手に解釈で進めない

### V2失敗の教訓（session_log参照）

「後付け機能追加で迷路化」を二度と起こさないため：
- 既存スキーマに合わない要件 → 既存テーブルを書き換えるのではなく、必要なら新規テーブルを足す
- 既存画面で動線が破綻 → 画面を継ぎ足すのではなく、本指示書のPhase通りに整理
- 「とりあえず動かす」実装 → 設計書に書かれた構造を必ず守る

### ファイル構成（既知）

```
backend/
├ alembic/versions/
├ app/
│  ├ models/ (project, qcds, vendor, quote, order, invoice, scan, ...)
│  ├ schemas/
│  ├ api/v1/
│  ├ services/
│  └ tasks/
└ scripts/
frontend/
├ src/
│  ├ app/
│  │  ├ projects/[id]/ (page.tsx, qcds/, quote/, estimate/, order/, invoice/, ...)
│  │  ├ scan/
│  │  ├ vendors/
│  │  └ admin/
│  ├ components/
│  └ lib/
```

---

## 全課題の一覧（実装の参照用）

```
【スキャン-QCDS連動】
  ① 一括選択（チェックボックス）
  ② 一括削除（論理削除、ゴミ箱、管理者は完全削除可）
  ③ 一括転記（案件選択+QCDS/見積書/両方）
  ④ スキャン編集後の一覧戻り
  ⑤ QCDS表は1業者=1行のグロス表示、明細はドリルダウン
  ⑥ 転記結果のトースト+リンク表示

【顧客管理】
  ⑦ 顧客マスタ実装（clients/client_sites/client_contacts）
  ⑧ 170店舗対応UI
  ⑨ 見積書作成時の顧客検索選択
  ⑩ 既存案件のclient_name→clientsマスタ移行

【帳票連動】
  ⑪ 案件作成時に見積書・注文書・注文請書・請求書のドラフト自動生成
  ⑫ 見積マスター連動方式（金額・明細は連動、宛先・日付は独立）
  ⑬ 注文請書テーブル新規追加
  ⑭ 各帳票で個別編集可能な項目の明示

【見積書構造】
  ⑮ 2階層構造（大項目→明細行7カラム）
  ⑯ ページ構成（1.表紙 2.大項目集計 3+.大項目別明細）
  ⑰ 業者見積版から大項目への反映UI改善
  ⑱ 大項目テンプレ機能
  ⑲ 見積書の枝番採番（26-1-001-1, 26-1-001-2）

【請求書】
  ⑳ 1案件に複数請求書をぶら下げる構造
  ㉑ 請求金額の決め方は柔軟（割合/直接入力/明細選択）
  ㉒ 請求書の枝番採番（26-1-001-請1、-請2）
  ㉓ 累計請求額・残請求額の自動計算
  ㉔ 請求起動はクラップ側・顧客承認側どちらからもOK
  ㉔b 請求書ステータス6個（draft/sent/paid/partially_paid/overdue/cancelled）

【注文書・注文請書】
  ㉕ 注文請書テーブル新規追加
  ㉖ 注文書に「注文請書を発行」ボタン
  ㉗ 注文書ステータス5個（draft/sent/signed/acknowledged/cancelled）
  ㉘ PDF出力ボタン配置
  ㉘b 稟議承認フローは見積書のみ（他帳票には拡張しない）

【ナビゲーション・UX】★最重要
  ㉙ 案件サブナビゲーション（全画面共通の案件内タブ）
  ㉚ サブナビにバッジ付き件数表示
  ㉛ 案件詳細以外の画面でも他の関連データへ1クリックで遷移
  ㉜ Next.js app/projects/[id]/layout.tsx で共通レイアウト化
```

---

## Phase 構成

| Phase | スコープ | 想定期間 | 課題番号 |
|---|---|---|---|
| Phase A | 案件サブナビゲーション（基盤） | 0.5日 | ㉙〜㉜ |
| Phase B | スキャン-QCDS連動の改修 | 2日 | ①〜⑥ |
| Phase C | 顧客マスタ実装＋既存案件移行 | 2日 | ⑦〜⑩ |
| Phase D | 帳票連動＋注文請書テーブル | 2日 | ⑪〜⑭、㉕〜㉘b |
| Phase E | 見積書の階層構造とテンプレ | 2日 | ⑮〜⑲ |
| Phase F | 複数請求書とステータス | 1.5日 | ⑳〜㉔b |

**合計：約10日（実働換算）**

各Phaseの順序を守ってください。Aを最優先で実装し、以降BCDEF順。

---

# Phase A：案件サブナビゲーション（最優先・基盤）

## 目的

全画面で案件コンテキスト内のナビゲーションを共通表示することで、画面遷移後も他の関連データへ1クリックで行けるようにする。これは UI 改善の基盤になるので最初に着手する。

## 実装内容

### A-1：共通レイアウトの作成

**新規ファイル**：

`frontend/src/app/projects/[id]/layout.tsx`
- 案件サブナビを表示する共通レイアウト
- 子ルート全てに自動適用される
- props で children を受け取る

`frontend/src/components/project/ProjectSubNav.tsx`
- タブ型ナビゲーションコンポーネント
- props: `projectId`, `counts: { qcds, estimate, quote, order, acknowledgment, invoice, progress, history }`

### A-2：データ取得

`backend/app/api/v1/projects.py` の `GET /projects/{id}` レスポンスに `counts` フィールドを追加：

```python
{
  "id": "...",
  "project_number": "26-1-001",
  ...
  "counts": {
    "qcds": 1,
    "estimate": 0,
    "quote": 1,
    "order": 0,
    "acknowledgment": 0,
    "invoice": 0,
    "progress": 0,
    "history": 12
  }
}
```

### A-3：タブ構成

```
[詳細] [QCDS] [業者見積] [顧客見積] [注文書] [注文請書] [請求書] [進捗] [編集履歴]
```

- 各タブにバッジで件数表示（0件は薄いグレー）
- アクティブタブはクラップネイビーの下線
- 案件番号と件名は左上に固定表示

### A-4：既存画面の調整

既存の `frontend/src/app/projects/[id]/page.tsx`（案件詳細）にある「関連データ」セクションは削除。役割をサブナビに移譲する。

### A-5：注文請書ルートの追加

ルートを先に確保（コンテンツは Phase D で実装）：
- `frontend/src/app/projects/[id]/acknowledgment/page.tsx` （仮置き、「準備中」表示）

## 動作確認チェックリスト

- [ ] 案件詳細画面で全タブが表示される
- [ ] QCDS画面に移動してもサブナビが表示される
- [ ] 見積、注文、請求、進捗、編集履歴の各画面でもサブナビ表示
- [ ] バッジが正しい件数を反映
- [ ] アクティブタブが現在のページに対応している
- [ ] 案件番号・件名がヘッダに表示
- [ ] スマホ表示でタブが横スクロールできる
- [ ] 既存機能が壊れていない

## Claude Code に投げるプロンプト

```
@docs/12_VSCode変更指示書.md の Phase A を実装してください。

注意：
- Phase A 以外には手を出さないこと
- A-1 から A-5 まで順番に実装
- 既存画面の「関連データ」セクション削除は最後に
- 完了後、動作確認チェックリスト全項目を実行して報告
- 不明点は実装前に質問
```

---

# Phase B：スキャン-QCDS連動の改修

## 目的

業者見積スキャンから案件への転記フローを、一括処理・削除・結果可視化対応にする。QCDS表示も業者単位グロスにする。

## 前提（既存実装の確認）

- `scan_jobs`、`scan_results`、`scan_result_items` は実装済
- `qcds_direct_works` は実装済（取決見通表）
- 現状は1件ずつのレビュー画面 `/scan/[id]` のみ

## B-1：DBスキーマ変更

**Alembicマイグレーション新規**：`add_soft_delete_to_scan.py`

`scan_jobs` テーブルに以下のカラム追加：
- `deleted_at: TIMESTAMP NULL`
- `deleted_by: UUID FK→users NULL`

`scan_results` テーブルに以下のカラム追加：
- `deleted_at: TIMESTAMP NULL`
- `deleted_by: UUID FK→users NULL`

`qcds_direct_works` テーブルに以下のカラム追加：
- `source_scan_result_id: UUID FK→scan_results NULL` （どのスキャン由来か）

`quote_items` テーブル（または既存の見積明細）に以下のカラム追加：
- `source_scan_result_id: UUID FK→scan_results NULL`

これで「QCDSの1業者行 = 1つのscan_resultを参照、明細はscan_result_itemsから動的取得」が可能に。

## B-2：バックエンドAPI

**新規エンドポイント**：

```
POST /api/v1/scan/bulk-apply
  body: {
    scan_result_ids: UUID[],
    project_id: UUID,
    targets: ("qcds" | "quote")[]  // 両方も可
  }
  
  処理:
  1. 各 scan_result について、targets で指定された転記を実行
  2. qcds: qcds_direct_works に1行追加（業者単位グロス）
     - vendor_id, vendor_name_snapshot, work_type, budget_amount(=scan_resultのtotal), source_scan_result_id
  3. quote: quote_items に行追加（複数 = scan_result_items を展開）
  4. レスポンス: { applied_count, qcds_affected: int, quote_affected: int, target_links: { qcds_url, quote_url } }

POST /api/v1/scan/bulk-delete
  body: { scan_result_ids: UUID[] }
  処理: deleted_at, deleted_by を設定（論理削除）

POST /api/v1/scan/bulk-restore (admin only)
  body: { scan_result_ids: UUID[] }
  処理: deleted_at を NULL に戻す

DELETE /api/v1/scan/bulk-purge (admin only)
  body: { scan_result_ids: UUID[] }
  処理: 物理削除

GET /api/v1/scan/results?include_deleted=true (admin only)
  ゴミ箱閲覧用
```

**既存エンドポイント変更**：

`GET /api/v1/scan/results` のレスポンス：
- デフォルトで `deleted_at IS NULL` のみ返す

`POST /api/v1/scan/results/{id}/apply`：
- 既存の単発apply。bulk-applyと整合させ、内部的にbulk-applyを呼び出す形に統一推奨

## B-3：フロントエンド改修

### B-3-1：スキャン一覧画面 `/scan/page.tsx`

レイアウト：

```
┌─ ヘッダ（既存維持） ───────────────────────────────┐
│ 業者見積スキャン  [新規アップロード]                │
│ KPI: 今月のスキャン3件 / 平均信頼度91% / 未レビュー1 / 完了2 │
├─ アップロードエリア（既存維持） ────────────────  │
├─ 一括操作バー（1件以上選択時に表示） ─────────  │
│ ☑2件選択中  [選択した案件に転記▼]  [一括削除]    │
├─ 処理ジョブテーブル（チェックボックス列を追加） ──  │
│ ☑ ファイル名 / 業者  形式  進捗  ステータス  信頼度  操作
│ ☑ 米原商事.pdf    PDF  完了    完了    97%    [詳細][🗑]
│ ☐ 文化シヤッター.pdf PDF 完了 完了    80%    [詳細][🗑]
└─ タブ：すべて / 処理中 / 未レビュー / 完了 / ゴミ箱（adminのみ）
```

「一括転記」モーダル：
```
┌─ 一括転記 ──────────────────────────────────┐
│ 案件を選択 *                              │
│ [検索ボックス] 26-1-001 ○○ビル工事 [×]   │
│                                          │
│ 転記先を選択 *                            │
│ ☑ QCDS 直接工事費（取決見通表）           │
│ ☑ 顧客向け見積書（明細追加）              │
│                                          │
│ ☐ 業者マスタに保存                       │
│                                          │
│ [キャンセル] [転記する]                    │
└──────────────────────────────────────────┘
```

転記実行後：
- 画面上部にトースト「2件をQCDSと見積書に転記しました [QCDSを見る →] [見積書を見る →]」
- トーストは8秒表示、リンククリックで該当画面へ遷移

### B-3-2：スキャン詳細画面 `/scan/[id]/page.tsx`

修正点：
- 上部の「転記先」プルダウンを **大きな案件選択ボタン** に変更
- 案件未選択時は黄色背景＋「案件を選択してください」明示
- 「選択先に転記する」押下後、トースト表示後に `/scan` 一覧に自動遷移

### B-3-3：QCDS画面 `/projects/[id]/qcds/page.tsx`

取決見通表の表示変更：

```
┌─ 取決見通表 ─────────────────────────────────  │
│ No │ 業者名         │ 工種      │ 取決金額 │ ✓ │ 4月 │ 5月 │ ... │ 計    │  │
│ 1  │ 米原商事       │ クレーン  │ ¥150,000 │ ☐ │ -   │ -   │ ... │ -    │ ▼ │
│ ├─ 展開（▼押下時） ──────────────────────  │
│ │  No │ 名称       │ 仕様 │ 単位│ 数量│ 単価   │ 金額    │ 摘要 │
│ │  1  │ ラフタークレーン │ -   │ 日  │ 3   │ 50,000 │ 150,000│ -    │
│ ├──────────────────────────────────────  │
│ 2  │ 文化シヤッター │ スチール │ ¥81,800  │ ☐ │ -   │ -   │ ... │ -    │ ▼ │
│ ...
```

- 1業者=1行のグロス表示が基本
- 各行右端に `[▼]` ボタン
- クリックで行下にアコーディオン展開、`scan_result_items` の明細を表示
- 展開状態は localStorage で記憶（戻ってきたら同じ状態）

## 動作確認チェックリスト

- [ ] 複数選択して一括転記できる
- [ ] 一括削除できる、トーストから「元に戻す」できる
- [ ] 削除済データはデフォルト一覧に出ない
- [ ] adminはゴミ箱を見れる、復活・完全削除できる
- [ ] 単発の詳細編集→転記後、一覧に自動遷移
- [ ] QCDSが1業者=1行のグロス表示
- [ ] 展開で明細が表示される
- [ ] 既存の単発apply機能が動く（後方互換）
- [ ] 既存QCDSデータ（Phase A 以前に登録済み）も正しく表示される

## マイグレーション注意

既存の `qcds_direct_works` には `source_scan_result_id` が NULL のレコードがある。これは「手動で追加された行」として扱い、明細展開時は「明細なし」と表示。

## Claude Code に投げるプロンプト

```
@docs/12_VSCode変更指示書.md の Phase B を実装してください。

注意：
- Phase A が完了していることを確認してから着手
- B-1（スキーマ変更）→ B-2（API）→ B-3（フロント）の順
- B-1のマイグレーション実行前に、本番DBバックアップを取ること
- 既存の単発apply機能を壊さない（後方互換維持）
- 完了後、動作確認チェックリスト全項目を実行
```

---

# Phase C：顧客マスタ実装＋既存案件移行

## 目的

平和堂約170店舗対応の顧客マスタを実装し、既存案件の `client_name` を `clients` マスタに移行する。

## C-1：DBスキーマ

**新規テーブル3つ**（追補③ 6.2 参照）：

```
clients
  id, client_code, client_name, client_name_kana,
  postal_code, address, phone, fax, email, representative,
  client_rank ENUM('A','B','C'),
  payment_condition_default, credit_limit, tax_id,
  is_active, note, created_at, updated_at

client_sites
  id, client_id FK, site_code, site_name,
  postal_code, address, site_manager, site_phone, note

client_contacts
  id, client_id FK, client_site_id FK NULL,
  department, name, name_kana, title, phone, email,
  is_primary, note
```

**`projects` テーブルへのカラム追加**：

```
client_id UUID FK→clients NULL  (移行中はNULL許可)
client_site_id UUID FK→client_sites NULL
client_contact_id UUID FK→client_contacts NULL
```

既存の `client_name`, `project_location` 等は当面残す（後方互換）。移行完了後に別途整理。

## C-2：マイグレーションスクリプト

`backend/scripts/migrate_clients.py`：

```python
"""既存projectsのclient_nameからclientsマスタを構築"""
1. 全projectsから client_name の distinct を取得
2. 各 client_name について clients テーブルに新規登録（既存なら使い回し）
3. projects.client_id を更新
4. 店舗推定：project_name や project_location から「アル・プラザ アミ」「アル・プラザ 鯖江」等を抽出
   → client_sites として登録、projects.client_site_id を更新
5. レポート出力：何件の顧客・店舗が作成されたか

dry_run モード対応。先に dry_run で結果確認、OKなら本番実行。
```

## C-3：API

```
GET    /api/v1/clients
POST   /api/v1/clients
GET    /api/v1/clients/{id}
PATCH  /api/v1/clients/{id}
DELETE /api/v1/clients/{id}  (admin only)

GET    /api/v1/clients/{id}/sites
POST   /api/v1/clients/{id}/sites
PATCH  /api/v1/clients/{id}/sites/{site_id}

GET    /api/v1/clients/{id}/contacts
POST   /api/v1/clients/{id}/contacts

GET    /api/v1/clients/search?q=...  (店舗名・コード・住所で検索)
```

## C-4：フロントエンド

### C-4-1：顧客一覧 `/clients/page.tsx`

- テーブル形式：顧客名、ランク、累計取引、案件数、最終取引日
- 検索、フィルタ（ランク別）
- 新規登録ボタン

### C-4-2：顧客詳細 `/clients/[id]/page.tsx`

追補③ 6.4 参照のレイアウト：
- 上部：基本情報、取引実績グラフ
- 中央：店舗一覧（170店舗を地域別タブで分類）
- 下部：案件一覧、窓口担当者

### C-4-3：店舗検索コンポーネント

`frontend/src/components/client/SiteSearch.tsx`（共通コンポーネント）：
- 検索ボックス + 候補リスト
- 案件作成、見積書作成などで使い回せる
- ピン留め店舗を上位表示
- 地域別フィルタ

### C-4-4：案件作成・編集画面の修正

`/projects/new`、`/projects/[id]` の編集モード：
- `client_name` 単純テキスト入力 → 顧客選択コンポーネント
- 顧客選択後、店舗選択（必須/任意）
- 窓口担当者選択（任意）
- 既存案件は client_id NULL の場合、表示は client_name 文字列で代替

## C-5：サイドバーへの追加

`frontend/src/components/Sidebar.tsx`：
- 「業者マスタ」の下に「顧客マスタ」を追加

## 動作確認チェックリスト

- [ ] dry_run スクリプトでマイグレーション結果を確認
- [ ] 本番マイグレーション後、全案件に client_id がセットされている
- [ ] 顧客一覧画面が表示される
- [ ] 顧客詳細画面で店舗・案件・担当者が見える
- [ ] 新規案件作成時に顧客検索＋店舗選択ができる
- [ ] 既存案件編集時も顧客変更ができる
- [ ] 店舗検索コンポーネントが見積書作成画面でも使える

## Claude Code に投げるプロンプト

```
@docs/12_VSCode変更指示書.md の Phase C を実装してください。

注意：
- C-2 のマイグレーションスクリプトは必ず dry_run で結果を見せてから本番実行
- 既存案件の client_name は当面残す（後方互換）
- 平和堂の店舗推定ロジックは精度を見ながら調整、誤推定があれば手動修正できるUIも提供
```

---

# Phase D：帳票連動＋注文請書テーブル

## 目的

見積書を作成すると、注文書・注文請書・請求書のドラフトが自動生成される。見積書がマスターで、金額・明細を変更すると他帳票も連動する。注文請書テーブルを新規追加する。

## D-1：DBスキーマ

**新規テーブル**：

```
acknowledgments （注文請書）
  id, order_id FK→orders,
  acknowledgment_number, issue_date,
  // 注文書の内容を複製しつつ、注文請書独自の項目を持つ
  status ENUM('draft', 'issued'),
  created_at, updated_at
```

**既存テーブル変更**：

`orders`：
- `status` ENUM を `('draft', 'sent', 'signed', 'acknowledged', 'cancelled')` に変更
- 既存の `signed_returned` 状態のデータは `signed` にマッピング
- `quote_id` FK 追加（マスター見積書への参照）
- `linked_to_quote BOOL DEFAULT TRUE`（連動有効フラグ）

`invoices`：
- `status` ENUM を `('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')` に変更
- `quote_id` FK 追加
- `linked_to_quote BOOL DEFAULT TRUE`

## D-2：帳票連動ロジック

`backend/app/services/document_sync_service.py`（新規）：

```python
async def sync_dependent_documents_on_quote_change(quote_id):
    """見積書の変更を注文書・注文請書・請求書に伝播"""
    # linked_to_quote=True の orders, invoices を検索
    # 金額・明細を見積書からコピー
    # 宛先・日付・支払条件などはコピーしない（独立項目）
```

連動する項目：
- 合計金額、明細（数量・単価・金額）
- 大項目構造（quote_sectionsを参照）

連動しない項目（各帳票で独立編集）：
- 発行日、送付日、支払期日
- 宛先会社名、担当者名、住所
- 約款・特記事項
- ステータス

## D-3：API

**新規エンドポイント**：

```
POST /api/v1/quotes/{id}/generate-related-documents
  処理: 注文書・注文請書・請求書のドラフトを生成
  レスポンス: { order_id, acknowledgment_id, invoice_id }

POST /api/v1/orders/{id}/issue-acknowledgment
  処理: 注文書ステータスが 'signed' のとき、注文請書を発行
  レスポンス: { acknowledgment_id }

PATCH /api/v1/orders/{id}/unlink
  処理: linked_to_quote = FALSE に設定（独立編集モード）

GET    /api/v1/projects/{id}/acknowledgments
POST   /api/v1/projects/{id}/acknowledgments
GET    /api/v1/acknowledgments/{id}
PATCH  /api/v1/acknowledgments/{id}
GET    /api/v1/acknowledgments/{id}/export?format=pdf|xlsx
```

## D-4：フロントエンド

### D-4-1：見積書画面の改修

`/projects/[id]/quote/page.tsx`：
- 「関連帳票を一括生成」ボタン追加（quote.status が draft 以外のとき表示）
- 押下で注文書・注文請書・請求書ドラフト生成 → トースト表示

### D-4-2：注文書画面の改修

`/projects/[id]/order/page.tsx`：

```
┌─ 注文書 #1 ────────────────────────────────────  │
│ [ステータス: 草案 ▼]  [PDF出力] [Excel出力]       │
│                                                   │
│ ⚠ この注文書は見積書と連動中 [連動を解除]        │
│   （見積書を変更すると金額・明細が同期されます）  │
│                                                   │
│ ─── 連動項目（編集不可） ─────────────  │
│ 合計金額: ¥3,000,000 ...                          │
│ 明細: ...（見積書と同じ）                         │
│                                                   │
│ ─── 独立項目（個別編集可） ──────────  │
│ 発行日 [____] / 工期 [____] - [____]            │
│ 宛先 [____] / 担当 [____] / 住所 [____]           │
│ 支払条件 [____]                                   │
│ 約款・特記事項 [____]                            │
│                                                   │
│ ステータスが「サイン受領済」のとき:              │
│ [注文請書を発行] ボタン表示                       │
└──────────────────────────────────────────  │
```

### D-4-3：注文請書画面（新規）

`/projects/[id]/acknowledgment/page.tsx`：
- Phase A で仮置きしたページを本実装
- 注文書と同じ構造、宛先・発行日のみ編集可
- PDF/Excel出力ボタン

### D-4-4：請求書画面の改修

`/projects/[id]/invoice/page.tsx`：
- Phase F で複数請求書対応するので、ここでは「連動表示」と「ステータス6種対応」のみ
- 連動表示は注文書と同じ形式

### D-4-5：PDF/Excel出力の実装

未実装の場合：
- `GET /api/v1/orders/{id}/export?format=pdf|xlsx`
- `GET /api/v1/acknowledgments/{id}/export?format=pdf|xlsx`
- `GET /api/v1/invoices/{id}/export?format=pdf|xlsx`

既存テンプレートを使う：
- `backend/app/templates/excel/order.xlsx`
- `backend/app/templates/excel/acknowledgment.xlsx`（新規必要）
- `backend/app/templates/excel/invoice.xlsx`
- `backend/app/templates/pdf/order.html.j2` 等

## 動作確認チェックリスト

- [ ] 見積書から「関連帳票を一括生成」で注文書・注文請書・請求書が作られる
- [ ] 見積書の金額を変更すると、連動中の他帳票も自動更新される
- [ ] 「連動を解除」で独立編集可能になる
- [ ] 注文書のステータス5種が動作する
- [ ] 注文書 `signed` 状態で注文請書を発行できる
- [ ] 注文請書画面が表示される
- [ ] 全帳票でPDF/Excel出力ボタンが動作
- [ ] 既存テンプレートのレイアウト保持

## Claude Code に投げるプロンプト

```
@docs/12_VSCode変更指示書.md の Phase D を実装してください。

注意：
- 既存の orders / invoices テーブルに quote_id, linked_to_quote を追加するマイグレーション
- 既存データは linked_to_quote = FALSE で初期化（誤連動防止）
- 注文請書のExcelテンプレートが未配置なら、本人に確認
- 帳票連動のロジック競合（同時編集）に注意。楽観的ロックで対応
```

---

# Phase E：見積書の階層構造とテンプレ

## 目的

見積書を「大項目→明細行7カラム」の2階層構造で編集可能にし、ページ構成（1.表紙 2.大項目集計 3+.大項目別明細）でPDF出力する。大項目のテンプレ機能を追加する。

## 前提

session_log 5/15 で `quote_sections`（大項目）テーブル追加済。`quote_versions`（業者見積版）も実装済。

## E-1：DBスキーマ確認・拡張

既存：
- `quote_sections` (id, quote_id, section_code A/B/C..., section_name, display_order)
- `quote_items` (id, quote_id, row_no, item_name, spec, unit, quantity, unit_price, amount, remarks, ...)

確認事項：
- `quote_items` に `section_id FK→quote_sections` があるか？なければ追加

新規テーブル：
```
section_templates （大項目テンプレ）
  id, template_name (例「仲都型」「改修型」), description,
  is_active, created_at, updated_at

section_template_items （テンプレ内の大項目構成）
  id, section_template_id FK,
  section_code A/B/C..., section_name,
  display_order, default_items JSONB
```

## E-2：API

```
GET    /api/v1/section-templates
POST   /api/v1/section-templates
PATCH  /api/v1/section-templates/{id}
DELETE /api/v1/section-templates/{id}

POST   /api/v1/quotes/{id}/apply-template
  body: { template_id }
  処理: テンプレから大項目を一括追加

POST   /api/v1/quotes/{id}/sections
  body: { section_name, display_order }
  処理: 大項目を手動追加

POST   /api/v1/quotes/{id}/items
  body: { section_id, item_name, spec, unit, quantity, unit_price, amount, remarks }

GET    /api/v1/quotes/{id}/export?format=pdf|xlsx
  ページ構成：
  - ページ1: 表紙
  - ページ2: 大項目集計（A=¥xxx, B=¥xxx, ...）
  - ページ3+: 大項目別明細
```

## E-3：見積書の枝番採番

`backend/app/services/quote_number_generator.py`：

```python
def generate_quote_number(project: Project) -> str:
    """26-1-001-1, 26-1-001-2 のように枝番付与"""
    existing_count = count_quotes_for_project(project.id)
    return f"{project.project_number}-{existing_count + 1}"
```

## E-4：フロントエンド

### E-4-1：見積書編集画面の改修

`/projects/[id]/quote/[quote_id]/page.tsx`：

```
┌─ 見積書 26-1-001-1 ─────────────────────────────  │
│ [PDF] [Excel] [テンプレ適用▼]                     │
│                                                   │
│ ─── 大項目 ─────────────────────────────  │
│ ▼ A. 建築工事                    小計 ¥5,000,000│
│   No│名称       │仕様 │単位│数量│単価   │金額   │摘要│
│   1 │基礎工事   │コンクリ│式 │1  │500,000│500,000│-  │
│   2 │躯体工事   │鉄骨H300│t │5  │200,000│1,000,000│-│
│   [+ 行を追加] [+ 業者見積版から反映]            │
│                                                   │
│ ▼ B. 電気設備工事                小計 ¥2,000,000│
│   ...                                             │
│                                                   │
│ [+ 大項目を追加]                                  │
│                                                   │
│ ─── 合計 ─────────────────────────────  │
│ 小計（税抜） ¥7,000,000                          │
│ 消費税(10%)   ¥700,000                           │
│ 合計         ¥7,700,000                          │
└──────────────────────────────────────────  │
```

- 大項目は折りたたみ可能
- 「テンプレ適用」プルダウンで section_templates から選択
- 行追加・削除はインライン操作
- 「業者見積版から反映」で `/projects/[id]/estimate` の業者見積版を選んで反映（既存仕組み活用）

### E-4-2：見積書一覧画面

`/projects/[id]/quote/page.tsx`：
- 同じ案件に対する複数の見積書（枝番ごと）を一覧表示
- 「新規見積書を作成」ボタン

### E-4-3：テンプレ管理画面

`/admin/section-templates/page.tsx`：
- テンプレ一覧、新規登録、編集
- 各テンプレに大項目構成を設定

## 動作確認チェックリスト

- [ ] 見積書に大項目を追加できる
- [ ] テンプレを選んで大項目を一括追加できる
- [ ] 各大項目に明細行を追加できる
- [ ] 業者見積版から大項目に流し込みできる
- [ ] PDF出力でページ構成が正しい（表紙→集計→明細）
- [ ] Excel出力でも同様
- [ ] 1案件で複数見積書を作成できる（-1, -2 の枝番）
- [ ] 既存の見積書（Phase E 前のもの）も表示できる

## Claude Code に投げるプロンプト

```
@docs/12_VSCode変更指示書.md の Phase E を実装してください。

注意：
- session_log で quote_versions / quote_sections は実装済を前提
- まず既存テーブルの状態を確認してから着手
- E-3 の枝番採番は既存の単発見積書とも互換が必要
```

---

# Phase F：複数請求書とステータス

## 目的

1案件に対して請求書を複数発行できるようにする（分割請求・出来高請求・月次請求 等あらゆるパターン対応）。

## F-1：DBスキーマ

`invoices` テーブル変更：
- `parent_invoice_id` FK NULL：削除（1案件複数請求書はFK で project_id → invoice の1対多で表現）
- `invoice_number` の採番ルール変更：`{project_number}-請{N}` 形式
- `billing_method` ENUM: `direct_amount` / `percentage` / `item_selection`
- `billing_percentage` DECIMAL NULL：割合指定の場合の%
- `billing_note` TEXT：「着工時請求」「中間請求」「完工請求」等の自由入力

集計用ビュー：
```sql
CREATE VIEW project_invoice_summary AS
SELECT
  project_id,
  COUNT(*) AS invoice_count,
  SUM(CASE WHEN status IN ('paid', 'partially_paid') THEN total_amount ELSE 0 END) AS billed_total,
  SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END) AS pending_total
FROM invoices
WHERE deleted_at IS NULL
GROUP BY project_id;
```

## F-2：API

```
GET    /api/v1/projects/{id}/invoices
POST   /api/v1/projects/{id}/invoices
  body: {
    billing_method: 'direct_amount' | 'percentage' | 'item_selection',
    amount: DECIMAL (direct_amount時),
    percentage: DECIMAL (percentage時),
    selected_quote_item_ids: UUID[] (item_selection時),
    billing_note: TEXT,
    issue_date: DATE,
    payment_due_date: DATE
  }

PATCH  /api/v1/invoices/{id}
GET    /api/v1/invoices/{id}/export?format=pdf|xlsx

POST   /api/v1/invoices/{id}/payments
  body: { amount, payment_date, payment_method, note }
  処理: 入金記録、累計入金額が請求額以上で status='paid' に
        一部入金時 'partially_paid' に

GET    /api/v1/projects/{id}/invoice-summary
  レスポンス: { invoice_count, billed_total, pending_total, project_total, remaining }
```

## F-3：請求書ステータス自動遷移

バックグラウンドジョブ（Celery）：
```python
@celery.task
def check_overdue_invoices():
    """支払期日超過の請求書を 'overdue' に変更"""
    today = date.today()
    invoices = Invoice.query.filter(
        Invoice.status == 'sent',
        Invoice.payment_due_date < today,
    )
    for inv in invoices:
        inv.status = 'overdue'
        # 通知も飛ばす
```

毎日朝9時に実行。

## F-4：フロントエンド

### F-4-1：請求書一覧

`/projects/[id]/invoice/page.tsx`：

```
┌─ 請求書一覧 ──────────────────────────────────  │
│ [+ 新規請求書を作成]                              │
│                                                   │
│ 案件合計: ¥7,700,000  請求済: ¥3,000,000        │
│ 未収: ¥0  残請求可能額: ¥4,700,000              │
│                                                   │
│ ┌────────────┬─────────┬─────────┬──────────┐ │
│ │請求書No   │発行日   │金額     │ステータス│ │
│ │26-1-001-請1│2026/05/01│¥3,000,000│●入金済 │ │
│ │26-1-001-請2│2026/06/15│¥2,000,000│●送付済 │ │
│ │[+ 追加]                                     │ │
│ └────────────┴─────────┴─────────┴──────────┘ │
└──────────────────────────────────────────  │
```

### F-4-2：請求書作成モーダル

```
┌─ 新規請求書を作成 ─────────────────────────  │
│                                              │
│ 請求方法 *                                   │
│ ◉ 金額を直接入力                             │
│ ○ 案件合計の割合で指定                       │
│ ○ 明細を選択して請求                         │
│                                              │
│ 金額 *  ¥[____________]                     │
│                                              │
│ 請求メモ                                     │
│ [着工時請求___________]                     │
│                                              │
│ 発行日 *  [2026/05/01]                       │
│ 支払期日 [2026/06/30]                        │
│                                              │
│ [キャンセル] [作成]                          │
└──────────────────────────────────────  │
```

### F-4-3：請求書詳細画面

`/projects/[id]/invoice/[invoice_id]/page.tsx`：
- 通常の請求書編集画面
- 入金登録セクション（複数入金記録可能）
- PDF/Excel出力

## 動作確認チェックリスト

- [ ] 1案件に複数請求書を作成できる
- [ ] 枝番採番が正しい（-請1, -請2, ...）
- [ ] 3種類の請求方法すべて動作
- [ ] 入金登録ができる
- [ ] 一部入金で `partially_paid` に
- [ ] 全額入金で `paid` に
- [ ] 支払期日超過で `overdue` に自動遷移
- [ ] 累計請求額・残請求額が正しく計算される
- [ ] サブナビの請求書バッジが件数を反映

## Claude Code に投げるプロンプト

```
@docs/12_VSCode変更指示書.md の Phase F を実装してください。

注意：
- 既存の単一invoiceデータと互換性を持たせる
- Celeryタスクの初回設定が必要
- 入金記録は別テーブル payments を新規作成
```

---

# 全Phase 完了後の確認

## 統合テスト

1. 新規案件作成 → 顧客選択 → 業者見積スキャン → QCDS反映 → 見積書作成 → 関連帳票生成 → 注文書サイン受領 → 注文請書発行 → 複数請求書発行 → 入金記録
2. 各画面でサブナビが動作すること
3. PDF/Excel出力が顧客提出可能な品質であること

## デプロイ

各Phase完了ごとに：
1. ローカルでの動作確認
2. ステージング環境（あれば）でテスト
3. 本番DBバックアップ
4. 本番デプロイ
5. 本人による受け入れ確認

---

# 補足：Claude Code への共通指示

各Phaseの実装前に必ずこのプロンプトを最初に投げてください：

```
@docs/12_VSCode変更指示書.md の冒頭「Claude Code への重要事項」と
「V2失敗の教訓」を全文読みました。

これから Phase X を実装します。
不明点があれば実装前に質問します。
勝手な解釈で進めません。
```

これでClaude Codeが沼らずに済むはずです。
