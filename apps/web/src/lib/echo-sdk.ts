/**
 * Right at Home BnB - ECHO SDK Gateway Client
 *
 * Talks to the Echo SDK gate on FORGE (192.168.1.137:8000) via the
 * `echo-omega-bridge` cloudflared named tunnel — public hostname
 * `sdk1.echo-op.com` (configurable via ECHO_SDK_GATE env var).
 *
 * Replaces the prior `echo-sdk-gateway.bmcii1976.workers.dev` Cloudflare
 * Worker (doctrine-banned). Uses the canonical SDK envelope
 *
 *   POST /sdk/invoke
 *   X-Echo-API-Key: <sovereign key>
 *   body: { envelope_version:1, capability, params, context }
 *
 * Cap mapping (old REST path → new capability):
 *   /engine/query     → echo.engine.query
 *   /knowledge/search → echo.knowledge.search
 *   /brain/ingest     → echo.context.remember
 *   /brain/search     → echo.context.recall
 *   /worker/call      → echo.claude.oauth   (via echo-llm.ts)
 *
 * For chat/LLM use, prefer importing `echoChat` from './echo-llm.ts' directly
 * — `generateChatResponse` here remains for back-compat with the old shape.
 */

import { echoChat } from './echo-llm';

const GATE = (process.env.ECHO_SDK_GATE || '').replace(/\/+$/, '');
const KEY = process.env.ECHO_SOVEREIGN_KEY || process.env.ECHO_API_KEY || '';

interface SDKInvokeOptions {
  /** Per-call timeout (default 15s). */
  timeoutMs?: number;
  /** Free-form context passed through to the gate for telemetry / audit. */
  context?: Record<string, unknown>;
}

/**
 * Universal /sdk/invoke wrapper. Throws on transport errors or unsuccessful
 * HTTP status; returns the unwrapped `result.body` on success.
 */
async function sdkInvoke<T>(
  capability: string,
  params: Record<string, unknown>,
  opts: SDKInvokeOptions = {}
): Promise<T> {
  if (!GATE) {
    throw new Error('ECHO_SDK_GATE env var is not set');
  }

  const envelope = {
    envelope_version: 1,
    capability,
    params,
    context: { source: 'rah-midland.com', component: 'echo-sdk.ts', ...(opts.context || {}) },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);

  try {
    const res = await fetch(`${GATE}/sdk/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(KEY ? { 'X-Echo-API-Key': KEY } : {}),
      },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`ECHO SDK error ${res.status} (${capability}): ${txt.slice(0, 240)}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const result = (json.result as Record<string, unknown>) || {};
    // Gate convention: payload sits at result.body; some caps return at result directly.
    return ((result.body as T) ?? (result as T)) as T;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`ECHO SDK timed out after ${opts.timeoutMs ?? 15000}ms (${capability})`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// ENGINE QUERIES — echo.engine.query
// ============================================

export interface EngineQueryResult {
  engine_id: string;
  domain: string;
  doctrines: Array<{
    topic: string;
    conclusion: string;
    confidence: number;
    authority: string[];
  }>;
  latency_ms: number;
}

/**
 * Query an ECHO Intelligence Engine by domain.
 * Useful for getting domain-specific knowledge (hospitality, tax, legal, etc.).
 */
export async function queryEngine(
  query: string,
  domain: string,
  options?: { limit?: number }
): Promise<EngineQueryResult> {
  return sdkInvoke<EngineQueryResult>('echo.engine.query', {
    q: query,
    domain,
    ...(options?.limit ? { limit: options.limit } : {}),
  });
}

// ============================================
// KNOWLEDGE FORGE — echo.knowledge.search
// ============================================

export interface KnowledgeSearchResult {
  results: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    similarity: number;
  }>;
  total: number;
}

/**
 * Search the ECHO Knowledge Forge (5,387+ docs, 75K+ chunks).
 * Returns semantically relevant documents and chunks.
 */
export async function searchKnowledge(
  query: string,
  options?: { category?: string; limit?: number }
): Promise<KnowledgeSearchResult> {
  return sdkInvoke<KnowledgeSearchResult>('echo.knowledge.search', {
    q: query,
    ...(options?.category ? { category: options.category } : {}),
    limit: options?.limit ?? 5,
  });
}

// ============================================
// SHARED BRAIN — echo.context.remember / recall
// ============================================

export interface BrainIngestResult {
  id: string;
  stored: boolean;
}

/**
 * Store a memory in the ECHO Shared Brain (memory_spine).
 * Use for persisting decisions, events, and important interactions.
 */
export async function ingestToBrain(
  content: string,
  importance: number,
  tags: string[]
): Promise<BrainIngestResult> {
  return sdkInvoke<BrainIngestResult>('echo.context.remember', {
    kind: 'episode',
    content,
    source_agent: 'rah-midland-bnb',
    importance: Math.min(1, Math.max(0, importance / 10)), // legacy 1–10 → 0–1
    tags,
  });
}

export interface BrainSearchResult {
  results: Array<{
    id: string;
    content: string;
    importance: number;
    tags: string[];
    created_at: string;
    similarity?: number;
  }>;
}

/**
 * Search the ECHO Shared Brain for relevant memories.
 */
export async function searchBrain(
  query: string,
  limit: number = 10
): Promise<BrainSearchResult> {
  return sdkInvoke<BrainSearchResult>('echo.context.recall', {
    query,
    limit,
  });
}

// ============================================
// CHAT / AI GENERATION — echo.claude.oauth
// ============================================

export interface ChatResponse {
  text: string;
  model: string;
  tokens_used: number;
}

/**
 * Generate an AI response via the Echo Claude OAuth gateway (Max OAuth, $0).
 * The `personality` field is preserved as a system prompt prefix for back-compat
 * with the old `echo-chat` worker shape — under the hood, all flows now go
 * through Claude (Anthropic Messages API).
 *
 * For new code, prefer `echoChat` from './echo-llm.ts' directly — it returns
 * extraction telemetry and gives finer control over model/timeout.
 */
export async function generateChatResponse(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  personality: string = 'echo_prime'
): Promise<ChatResponse> {
  const systemPrefix = personality && personality !== 'echo_prime'
    ? `[Personality profile: ${personality}]\n\n`
    : '';

  const result = await echoChat(messages, {
    system: systemPrefix || undefined,
    maxTokens: 1024,
    timeoutMs: 30000,
  });

  return {
    text: result.text,
    model: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
    tokens_used: 0, // gate doesn't surface this today; left at 0 for API stability
  };
}
