/**
 * Right at Home BnB — Echo LLM Helper
 *
 * Routes LLM/chat calls through the Echo SDK gate (FORGE) using the
 * `echo.claude.oauth` capability — a Max-OAuth Claude gateway that
 * spawns the `claude` CLI under the Commander's existing Max subscription
 * ($0 billing). Same gateway the echo-op.com numerology page uses.
 *
 * Architecture (per NO-CLOUDFLARE doctrine, CLAUDE.md):
 *
 *   browser → Vercel Next.js /api route → echo-llm.ts → cloudflared tunnel
 *           → FORGE SDK gate :8000 /sdk/invoke
 *           → echo.claude.oauth cap (:8420 systemd service)
 *           → claude CLI (Max OAuth)
 *
 * Replaces the prior direct calls to
 *   api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/ai/run/@cf/meta/llama-3.1-8b-instruct
 * which were Cloudflare Workers AI (doctrine-banned).
 *
 * Configure via Vercel env vars:
 *   ECHO_SDK_GATE       e.g. https://sdk1.echo-op.com  (tunnel public hostname)
 *   ECHO_SOVEREIGN_KEY  the FORGE sovereign API key (header X-Echo-API-Key)
 *   LLM_CAP             defaults to "echo.claude.oauth"
 *   LLM_MODEL           defaults to "claude-haiku-4-5-20251001" (fast + cheap)
 *
 * @author ECHO OMEGA PRIME
 */

type ChatRole = 'system' | 'user' | 'assistant';
interface ChatMsg {
  role: ChatRole | string;
  content: string;
}

interface EchoLLMOptions {
  /** Optional system prompt. Stripped from `messages` if present there. */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Per-call override; otherwise reads env LLM_MODEL. */
  model?: string;
  /** Per-call timeout (default 30s — claude CLI startup is the long pole). */
  timeoutMs?: number;
}

interface EchoLLMResult {
  /** The model's text response. */
  text: string;
  /** Where the text was extracted from (for telemetry/debug). */
  source: 'anthropic-messages' | 'workers-ai' | 'plain-text' | 'choices' | 'unknown';
  /** Pass-through billing tag from the gate, if present. */
  billing?: string;
  /** Raw upstream body — provided so callers can inspect on debug paths. */
  raw?: unknown;
}

const GATE = (process.env.ECHO_SDK_GATE || '').replace(/\/+$/, '');
const KEY = process.env.ECHO_SOVEREIGN_KEY || '';
const CAP = process.env.LLM_CAP || 'echo.claude.oauth';
const MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5-20251001';

/**
 * Returns true if the Echo LLM path is configured (gate URL + sovereign key).
 * Lets callers short-circuit to GROQ / static fallback when not yet provisioned.
 */
export function isEchoLLMConfigured(): boolean {
  return Boolean(GATE && KEY);
}

/**
 * Extracts the model's text reply from whatever shape the cap returned.
 * The Anthropic Messages API shape is the expected primary, but we accept
 * a few common alternates so the helper survives cap upgrades.
 */
function extractText(body: unknown): { text: string; source: EchoLLMResult['source'] } {
  if (!body || typeof body !== 'object') return { text: '', source: 'unknown' };
  const b = body as Record<string, unknown>;

  // Anthropic Messages API: { content: [{ type:"text", text:"..." }, ...] }
  if (Array.isArray(b.content)) {
    const parts = (b.content as Array<{ type?: string; text?: string }>)
      .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string);
    if (parts.length) return { text: parts.join('\n').trim(), source: 'anthropic-messages' };
  }

  // OpenAI / GROQ shape: { choices: [{ message: { content } }] }
  if (Array.isArray(b.choices) && b.choices.length) {
    const first = b.choices[0] as Record<string, unknown>;
    const msg = (first?.message as Record<string, unknown>) || {};
    const c = msg.content;
    if (typeof c === 'string' && c.trim()) return { text: c.trim(), source: 'choices' };
  }

  // Cloudflare Workers AI legacy: { result: { response: "..." } }  (already-stripped on gate)
  const result = b.result as Record<string, unknown> | undefined;
  if (result && typeof result.response === 'string' && result.response.trim()) {
    return { text: (result.response as string).trim(), source: 'workers-ai' };
  }

  // Plain shapes: { text } / { response } / { message }
  if (typeof b.text === 'string' && b.text.trim()) return { text: b.text.trim(), source: 'plain-text' };
  if (typeof b.response === 'string' && (b.response as string).trim()) {
    return { text: (b.response as string).trim(), source: 'plain-text' };
  }
  if (typeof b.message === 'string' && (b.message as string).trim()) {
    return { text: (b.message as string).trim(), source: 'plain-text' };
  }

  return { text: '', source: 'unknown' };
}

/**
 * Generate a chat completion via the Echo SDK gate.
 * Throws on transport errors or unsuccessful HTTP status; returns
 * `{text:''}` if the cap responded but produced no extractable text
 * (callers should treat as "AI silent" and fall back).
 */
export async function echoChat(
  messages: ChatMsg[],
  opts: EchoLLMOptions = {}
): Promise<EchoLLMResult> {
  if (!isEchoLLMConfigured()) {
    throw new Error('echoChat: ECHO_SDK_GATE / ECHO_SOVEREIGN_KEY not configured');
  }

  // Hoist any system message into `system` (Anthropic-style); the cap accepts both,
  // but lifting it keeps the messages array clean and matches Claude SDK conventions.
  let systemPrompt = opts.system;
  const cleanedMsgs: ChatMsg[] = [];
  for (const m of messages) {
    if (m && m.role === 'system' && typeof m.content === 'string') {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${m.content}`
        : m.content;
      continue;
    }
    cleanedMsgs.push(m);
  }

  const params: Record<string, unknown> = {
    model: opts.model || MODEL,
    messages: cleanedMsgs,
    max_tokens: opts.maxTokens ?? 512,
    temperature: opts.temperature ?? 0.7,
  };
  if (systemPrompt) params.system = systemPrompt;

  const envelope = {
    envelope_version: 1,
    capability: CAP,
    params,
    context: { source: 'rah-midland.com', component: 'echo-llm.ts' },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);

  try {
    const res = await fetch(`${GATE}/sdk/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Echo-API-Key': KEY,
      },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`echoChat: gate ${res.status}: ${txt.slice(0, 240)}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    // Universal gate envelope: { ok, result: { body, status, ... }, billing?, ... }
    const result = (json.result as Record<string, unknown>) || {};
    const body = result.body ?? result;
    const billing =
      (typeof json.billing === 'string' && (json.billing as string)) ||
      (typeof result.billing === 'string' && (result.billing as string)) ||
      undefined;

    const { text, source } = extractText(body);
    return { text, source, billing, raw: body };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`echoChat: timed out after ${opts.timeoutMs ?? 30000}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
