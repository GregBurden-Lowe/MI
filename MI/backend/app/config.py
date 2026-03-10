from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    database_url: str = 'postgresql+psycopg://postgres:postgres@localhost:5432/powerbi_portal'
    jwt_secret: str = 'change-me'
    jwt_expire_minutes: int = 720
    admin_email: str = 'admin@example.com'
    admin_password: str = 'ChangeMe123!'
    cors_origin: str = 'http://localhost:5173'
    cookie_secure: bool = False


settings = Settings()
