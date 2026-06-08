from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://ars_user:changeme@postgres:5432/asistente_real_state"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # AI
    ai_policy: str = "local"  # local | anthropic | openai
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3"
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # JWT
    jwt_secret: str = "changeme_jwt_secret_min32chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # WhatsApp
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = "changeme_verify"
    whatsapp_app_secret: str = ""

    # Google Drive
    google_service_account_json: str = ""
    google_drive_folder_id: str = ""

    # Email
    resend_api_key: str = ""
    resend_from_email: str = "noreply@example.com"

    # Sentry
    sentry_dsn: str = ""

    # CORS
    cors_origins: List[str] = ["http://localhost:3001", "http://dashboard:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
