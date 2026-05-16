from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ai_port: int = 8000
    database_url: str = "postgresql://chatbox:chatbox@localhost:5432/chatbox"

    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"

    ai_confidence_threshold: float = 0.7
    ai_top_k: int = 5
    ai_retrieve_k: int = 20

    cohere_api_key: str = ""
    cohere_rerank_model: str = "rerank-multilingual-v3.0"

    anthropic_api_key: str = ""
    anthropic_chat_model: str = "claude-3-5-haiku-latest"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def use_openai(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def use_cohere(self) -> bool:
        return bool(self.cohere_api_key)

    @property
    def use_anthropic(self) -> bool:
        return bool(self.anthropic_api_key)


settings = Settings()
