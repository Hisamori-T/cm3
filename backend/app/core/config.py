"""アプリケーション設定（pydantic-settings で .env から読み込み）。"""
import logging

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """環境変数から設定値を読み込む。未設定の場合は開発用デフォルト値を使用。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://cmv3user:cmv3pass@cmv3-db:5432/cmv3"

    # Redis
    redis_url: str = "redis://:cmv3redis@cmv3-redis:6379/0"

    # AI
    gemini_api_key: str = ""

    # Auth (JWT)
    jwt_secret: str = "dev_jwt_secret_change_in_production_32chars!!"
    jwt_access_token_expire_minutes: int = 480
    jwt_refresh_token_expire_days: int = 7

    # CORS（カンマ区切りで複数指定可）
    allowed_origins: str = "http://localhost:3000"

    # App
    app_env: str = "development"
    log_level: str = "INFO"
    upload_dir: str = "/tmp/cmv3_uploads"

    # Admin seed account
    admin_email: str = "admin@clap-corp.example"
    admin_password: str = "change_in_production"

    @computed_field
    @property
    def allowed_origins_list(self) -> list[str]:
        """CORS 許可オリジンをリストで返す。"""
        return [o.strip() for o in self.allowed_origins.split(",")]

    @computed_field
    @property
    def log_level_int(self) -> int:
        """structlog/logging 用の数値ログレベル。"""
        return getattr(logging, self.log_level.upper(), logging.INFO)


settings = Settings()
