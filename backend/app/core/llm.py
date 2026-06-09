from app.core.config import settings


def get_llm():
    policy = settings.ai_policy
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
