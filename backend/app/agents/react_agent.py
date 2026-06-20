from langchain.agents import AgentExecutor, create_react_agent
from langchain.memory import ConversationBufferWindowMemory
from langchain_core.prompts import PromptTemplate
from app.core.llm import get_llm
from app.core.redis import get_session, set_session
from app.agents.tools.registry import discover_tools
from app.models.message import Message  # noqa: F401 — register model for metadata/create_all
import json

SYSTEM_PROMPT = """Sos un asistente inmobiliario profesional para Argentina. Tu objetivo es ayudar a los clientes a encontrar propiedades, agendar visitas y responder consultas.

Tenés acceso a las siguientes herramientas:
{tools}

Usá el siguiente formato:
Thought: pensá qué hacer
Action: nombre_herramienta
Action Input: input de la herramienta
Observation: resultado
... (repetí Thought/Action/Observation según sea necesario)
Thought: ya sé la respuesta final
Final Answer: respuesta al usuario

Pregunta: {input}
{agent_scratchpad}"""

# Tools are auto-discovered from the app.agents.tools package (registry pattern):
# dropping a new tool file in that folder registers it without editing this agent.
TOOLS = discover_tools()


async def run_agent(wa_contact_id: str, message: str, db) -> dict:
    llm = get_llm()
    prompt = PromptTemplate.from_template(SYSTEM_PROMPT)
    agent = create_react_agent(llm, TOOLS, prompt)

    # Load session history from Redis
    history_raw = await get_session(wa_contact_id)
    history = json.loads(history_raw) if history_raw else []

    memory = ConversationBufferWindowMemory(k=10, memory_key="chat_history", return_messages=True)
    for turn in history[-10:]:
        memory.chat_memory.add_user_message(turn["human"])
        memory.chat_memory.add_ai_message(turn["ai"])

    executor = AgentExecutor(
        agent=agent,
        tools=TOOLS,
        memory=memory,
        verbose=False,
        handle_parsing_errors=True,
        max_iterations=6,
    )

    result = await executor.ainvoke({"input": message})
    reply = result.get("output", "")
    escalated = "ESCALAR" in reply.upper() or "AGENTE" in reply.upper()

    # Persist session
    history.append({"human": message, "ai": reply})
    await set_session(wa_contact_id, json.dumps(history[-20:]))

    # Persist the turn to Postgres + refresh the rolling conversation summary
    # (best-effort; never breaks the reply).
    from app.services.conversations import record_conversation
    await record_conversation(db, wa_contact_id, message, reply)

    return {"reply": reply, "escalated": escalated}
