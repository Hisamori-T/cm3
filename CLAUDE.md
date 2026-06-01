# Construction Manager v3 開発ガイド

## プロジェクト概要
株式会社クラップの工事台帳をExcelからWebシステムに移行するプロジェクト。
詳細は `docs/base/企画設計MD/01_企画書_工事台帳Web化プロジェクト.md`, `docs/base/企画設計MD/02_設計書_Part1_アーキテクチャとデータモデル.md`, `docs/base/企画設計MD/03_設計書_Part2_実装手順とテスト計画.md` を参照。

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
- `backend/app/api/v1/<resource>.py` に APIエンドポイント
- `backend/app/services/<feature>.py` にビジネスロジック
- `backend/app/models/<entity>.py` に SQLAlchemyモデル
- `backend/app/schemas/<entity>.py` に Pydanticスキーマ
- `frontend/src/app/<route>/page.tsx` にページコンポーネント
- `frontend/src/components/<feature>/` に機能別コンポーネント

## 重要な業務ルール
1. 工事番号は `{西暦下2桁}-{社員番号}-{連番3桁}` で自動採番、手動編集可
2. 編集権限は「管理者」または「作成者本人」のみ。閲覧は全員可
3. 案件ステータスは7段階: 見積中→受注→着工→施工中→完工→請求済→入金済
4. 全エンティティの変更は `edit_histories` に自動記録
5. 業者見積スキャンの解析結果は必ずユーザーレビューを経てから反映
6. Excel帳票は既存テンプレート(`backend/app/templates/excel/`)に値を埋めるだけ。スタイルは触らない

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

## クラップ社情報（帳票出力用）
- 会社名：株式会社クラップ（CLAP CORPORATION）
- 住所：〒913-0043 福井県坂井市三国町錦3-4-2
- TEL：0776-81-8330 / FAX：0776-81-8331
- 代表取締役：奴間 正人
- 登録番号：T5210001007332（適格請求書発行事業者番号）
- 振込先：福井銀行 経田支店 普通 1068586 株式会社クラップ
