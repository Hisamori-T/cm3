# ========================================================
# Construction Manager v3 - Backend (FastAPI + uv)
# ========================================================
FROM python:3.11-slim

# uv パッケージマネージャーをインストール
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# システム依存関係（asyncpg ビルド + pdf2image に必要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    poppler-utils \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 依存関係を先にインストール（レイヤーキャッシュ最適化）
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-install-project

# アプリケーションコードをコピー
COPY . .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
