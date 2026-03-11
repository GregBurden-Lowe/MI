from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int = 720

    admin_email: str = "admin@example.com"
    admin_password: str

    cors_origin: str = "https://reports.lpgapps.work"
    cookie_secure: bool = True


settings = Settings()
