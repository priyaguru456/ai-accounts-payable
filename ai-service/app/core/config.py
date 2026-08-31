from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    internal_api_key: str = ""
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5"
    llm_fallback_model: str = "claude-haiku-4-5-20251001"
    confidence_threshold: float = 0.75
    reverification_threshold: float = 0.6
    request_timeout_seconds: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
