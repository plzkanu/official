from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "dev-secret-key-change-in-production"
    database_url: str = "sqlite:///./official_doc.db"
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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_production(self) -> bool:
        return bool(self.static_dir.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
