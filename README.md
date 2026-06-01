# Construction Manager v3

株式会社クラップの工事台帳をExcelからWebアプリに移行するシステム。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 14 (App Router) / TypeScript / Tailwind CSS / shadcn/ui |
| バックエンド | Python 3.11 / FastAPI / SQLAlchemy 2.0 / Celery |
| データベース | PostgreSQL 16 |
| キャッシュ/キュー | Redis 7 |
| AI | Google Gemini API (gemini-2.5-pro) |
| デプロイ | WebARENA Indigo VPS + Coolify |

---

## ローカル開発環境のセットアップ

### 前提条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) インストール済み
- Git インストール済み

### 手順

#### 1. リポジトリをクローン

```bash
git clone https://github.com/Hisamori-T/construction-manager-v3.git
cd construction-manager-v3
```

#### 2. 環境変数ファイルを作成

```bash
cp .env.example .env
```

`.env` を編集して適切な値を設定（開発環境ではデフォルト値のままでもOK）。

#### 3. インフラコンテナを起動

```bash
docker compose -f docker-compose.dev.yml up -d
```

起動確認：

| URL | 内容 |
|---|---|
| http://localhost:8080 | Adminer（DB管理UI） |
| http://localhost:5432 | PostgreSQL（直接接続用） |
| http://localhost:6379 | Redis |

Adminerへのログイン情報：
- システム: PostgreSQL
- サーバー: cmv3-db
- ユーザー名: cmv3user
- パスワード: cmv3pass
- データベース: cmv3

#### 4. コンテナの停止

```bash
docker compose -f docker-compose.dev.yml down
```

データも含めて削除する場合：

```bash
docker compose -f docker-compose.dev.yml down -v
```

---

## 開発フェーズごとの追加手順

### Step 1-3: FastAPI起動（実装後）

```bash
docker compose -f docker-compose.dev.yml up -d
# バックエンドAPIが http://localhost:8000 で起動
# ヘルスチェック: curl http://localhost:8000/api/v1/health
```

### Step 1-5: DBマイグレーション（実装後）

```bash
cd backend
uv run alembic upgrade head
uv run python scripts/seed.py
```

### Step 1-4: フロントエンド起動（実装後）

```bash
cd frontend
npm run dev
# http://localhost:3000 でアクセス可能
```

---

## プロジェクト構成

```
construction-manager-v3/
├── CLAUDE.md                  # Claude Code用ガイド（コーディング規約）
├── README.md                  # このファイル
├── docker-compose.dev.yml     # 開発環境
├── docker-compose.yml         # 本番環境（Step 6-2で作成）
├── .env.example               # 環境変数サンプル
├── docs/                      # 設計書一式
├── backend/                   # FastAPI バックエンド
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/
│   └── app/
│       ├── main.py
│       ├── core/
│       ├── models/
│       ├── schemas/
│       ├── api/v1/
│       ├── services/
│       ├── tasks/
│       └── templates/
└── frontend/                  # Next.js フロントエンド
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/
        ├── components/
        ├── lib/
        └── types/
```

---

## 設計書

| ドキュメント | 内容 |
|---|---|
| [01_企画書](docs/base/企画設計MD/01_企画書_工事台帳Web化プロジェクト.md) | プロジェクト概要・要件 |
| [02_設計書_Part1](docs/base/企画設計MD/02_設計書_Part1_アーキテクチャとデータモデル.md) | アーキテクチャ・データモデル・API設計 |
| [03_設計書_Part2](docs/base/企画設計MD/03_設計書_Part2_実装手順とテスト計画.md) | 実装手順・テスト計画 |
| [04_承認フロー](docs/base/企画設計MD/04_設計書_追補_承認フロー.md) | 承認フロー詳細 |
| [06_QCDSマスタ](docs/base/企画設計MD/06_設計書_追補_QCDS業務マスタ.md) | QCDS業務マスタ |
| [実装着手ガイド](docs/base/企画設計MD/10_実装着手ガイド.md) | Claude Codeへの指示テンプレート集 |

---

## 注意事項

- **セキュリティ**: `.env` ファイルは絶対にGitにコミットしない
- **DB操作**: 必ずSQLAlchemy経由（直接SQL禁止）
- **スキーマ変更**: 必ずAlembicマイグレーション経由
- **Excelテンプレート**: スタイル変更禁止。値の埋め込みのみ
- **案件削除**: 物理削除禁止。`deleted_at` による論理削除のみ
