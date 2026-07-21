import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"

def _parse_ssl_verify(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip().lower()
    return normalized not in {"0", "false", "no", "off"}


class Settings(BaseSettings):
    secret_key: str = "dev-secret-key-change-in-production"
    database_url: str = ""
    upload_dir: str = "./uploads"
    receipt_dir: str = "./receipts"
    stamp_dir: str = "./assets"
    stamp_filename: str = "digital_stamp.png"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    static_dir: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@company.com"
    smtp_use_tls: bool = True

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.is_file() else None,
        extra="ignore",
    )

    @property
    def database_ssl_verify(self) -> bool:
        return _parse_ssl_verify(os.environ.get("SUPABASE_SSL_VERIFY"))

    @property
    def is_production(self) -> bool:
        return bool(self.static_dir.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def require_database_url(self) -> str:
        url = self.database_url.strip()
        if not url:
            raise RuntimeError(
                "DATABASE_URL 환경 변수가 필요합니다. "
                "Supabase Dashboard → Settings → Database → Connection string(Session mode) 값을 "
                "backend/.env 또는 Replit Secrets에 설정하세요."
            )
        return url


settings = Settings()
