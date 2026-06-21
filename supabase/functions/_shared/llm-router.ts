// PropTech AI Platform — F100 LLM Router (M0 Platform Core)
//
// Free-first complexity routing (decision D016):
//   simple  -> Ollama   (free, default)
//   medium  -> DeepSeek (paid API, cheap)
//   heavy   -> Claude   — ONLY when adminRequest === true
//
// Routine chat, matching, summarization and meta-learning MUST cost zero
// Claude tokens (pattern P006). Claude is reachable solely on explicit
// administrator request for heavy analysis/reports (D016). No web access (D019).
//
// Runtime: Supabase Edge Functions (Deno). Uses global fetch for all three
// providers so the edge bundle stays minimal and the provider surface is uniform.

export type Complexity = "simple" | "medium" | "heavy";
export type Provider = "ollama" | "deepseek" | "claude";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: ChatMessage[];
  system?: string;
  complexity?: Complexity; // default "simple"
  maxTokens?: number; // default 1024
  /** Gates the heavy (Claude) tier. Must be true for any Claude call. */
  adminRequest?: boolean;
}

export interface LLMResult {
  text: string;
  provider: Provider;
  model: string;
}

const OLLAMA_URL = Deno.env.get("OLLAMA_URL") ?? "http://localhost:11434";
const OLLAMA_MODEL = Deno.env.get("OLLAMA_MODEL") ?? "llama3";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const DEEPSEEK_MODEL = Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-chat";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-4-8";

/**
 * Resolve which provider serves a request. Claude is NEVER selected without an
 * explicit admin request; a heavy task from a non-admin downgrades to DeepSeek.
 */
export function routeProvider(
  complexity: Complexity = "simple",
  adminRequest = false,
): Provider {
  if (complexity === "heavy") {
    return adminRequest ? "claude" : "deepseek";
  }
  if (complexity === "medium") return "deepseek";
  return "ollama";
}

export async function runLLM(req: LLMRequest): Promise<LLMResult> {
  const provider = routeProvider(req.complexity, req.adminRequest);
  const maxTokens = req.maxTokens ?? 1024;

  switch (provider) {
    case "ollama":
      return await callOllama(req, maxTokens);
    case "deepseek":
      return await callDeepSeek(req, maxTokens);
    case "claude":
      // Hard guard: defence-in-depth against a heavy call slipping through
      // without admin authorization.
      if (!req.adminRequest) {
        throw new Error("Claude requires adminRequest === true (D016).");
      }
      return await callClaude(req, maxTokens);
  }
}

// --- Ollama (free, default) -------------------------------------------------
async function callOllama(req: LLMRequest, _maxTokens: number): Promise<LLMResult> {
  const messages = req.system
    ? [{ role: "system", content: req.system }, ...req.messages]
    : req.messages;

  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
  });
  if (!r.ok) throw new Error(`Ollama error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return { text: data?.message?.content ?? "", provider: "ollama", model: OLLAMA_MODEL };
}

// --- DeepSeek (medium tier, OpenAI-compatible) ------------------------------
async function callDeepSeek(req: LLMRequest, maxTokens: number): Promise<LLMResult> {
  if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not set.");
  const messages = req.system
    ? [{ role: "system", content: req.system }, ...req.messages]
    : req.messages;

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, max_tokens: maxTokens }),
  });
  if (!r.ok) throw new Error(`DeepSeek error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return {
    text: data?.choices?.[0]?.message?.content ?? "",
    provider: "deepseek",
    model: DEEPSEEK_MODEL,
  };
}

// --- Claude (heavy tier, admin-request only) --------------------------------
// Anthropic Messages API, raw HTTP wire format.
async function callClaude(req: LLMRequest, maxTokens: number): Promise<LLMResult> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set.");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages,
    }),
  });
  if (!r.ok) throw new Error(`Claude error ${r.status}: ${await r.text()}`);
  const data = await r.json();

  if (data?.stop_reason === "refusal") {
    throw new Error("Claude declined the request (stop_reason: refusal).");
  }
  const text = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return { text, provider: "claude", model: data?.model ?? CLAUDE_MODEL };
}
