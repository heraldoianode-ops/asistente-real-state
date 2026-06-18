from app.core.config import settings

# Runtime LLM provider switch.
# ES: El motor de IA se puede cambiar con un clic desde el panel (app_settings.llm_provider):
#     'local' (Ollama, gratis) por defecto, o 'anthropic' (Claude) / 'openai' on-demand.
# EN: The AI engine is switchable at runtime from the admin panel (app_settings.llm_provider):
#     'local' (Ollama, free) by default, or 'anthropic' (Claude) / 'openai' on demand.
_SCHEMA = "asistente_real_state"


def get_active_provider() -> str:
    """Resolve the active LLM provider: app_settings override, else env (ai_policy)."""
    try:
        from app.core.supabase import get_supabase
        res = (
            get_supabase()
            .schema(_SCHEMA)
            .table("app_settings")
            .select("value")
            .eq("key", "llm_provider")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if rows and rows[0].get("value"):
            return str(rows[0]["value"]).strip().lower()
    except Exception:
        # Any lookup failure falls back to the env policy — never breaks the agent.
        pass
    return settings.ai_policy


def get_llm():
    policy = get_active_provider()
    if policy == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model="claude-3-5-sonnet-20241022", api_key=settings.anthropic_api_key)
    elif policy == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model="gpt-4o", api_key=settings.openai_api_key)
    else:
        from langchain_ollama import OllamaLLM
        return OllamaLLM(base_url=settings.ollama_base_url, model=settings.ollama_model)


def get_embeddings():
    from langchain_ollama import OllamaEmbeddings
    return OllamaEmbeddings(base_url=settings.ollama_base_url, model="nomic-embed-text")
