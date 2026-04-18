from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "web_betong-api"
    app_version: str = "0.2.0"
    app_env: str = "development"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://postgres:postgres@postgres:5432/web_betong"
    redis_url: str = "redis://redis:6379/0"

    jwt_secret_key: str = "web_betong_dev_secret_change_me"
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 30
    refresh_token_exp_days: int = 14

    sentry_dsn: str = ""
    cors_allow_origins: str = "*"
    upload_dir: str = "/root/web_betong/backend/uploads"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
