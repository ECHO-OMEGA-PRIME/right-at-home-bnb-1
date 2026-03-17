/**
 * Right at Home BnB - ECHO SDK Gateway Client
 * Connects to the ECHO intelligence platform for AI operations,
 * engine queries, knowledge search, and shared brain memory.
 */

const SDK_URL = 'https://echo-sdk-gateway.bmcii1976.workers.dev';
const API_KEY = process.env.ECHO_API_KEY || '';

interface SDKRequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Internal fetch wrapper with auth, timeout, and error handling.
 */
async function sdkFetch<T>(path: string, options: SDKRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, timeoutMs = 15000 } = options;

  const url = new URL(`${SDK_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'X-Echo-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ECHO SDK error ${response.status}: ${errorText}`);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`ECHO SDK request timed out after ${timeoutMs}ms: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// ENGINE QUERIES
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
  return sdkFetch<EngineQueryResult>('/engine/query', {
    params: {
      q: query,
      domain,
      ...(options?.limit ? { limit: String(options.limit) } : {}),
    },
  });
}

// ============================================
// KNOWLEDGE FORGE
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
  return sdkFetch<KnowledgeSearchResult>('/knowledge/search', {
    method: 'POST',
    body: {
      query,
      ...(options?.category ? { category: options.category } : {}),
      limit: options?.limit ?? 5,
    },
  });
}

// ============================================
// SHARED BRAIN
// ============================================

export interface BrainIngestResult {
  id: string;
  stored: boolean;
}

/**
 * Store a memory in the ECHO Shared Brain.
 * Use for persisting decisions, events, and important interactions.
 */
export async function ingestToBrain(
  content: string,
  importance: number,
  tags: string[]
): Promise<BrainIngestResult> {
  return sdkFetch<BrainIngestResult>('/brain/ingest', {
    method: 'POST',
    body: {
      instance_id: 'rah-midland-bnb',
      role: 'assistant',
      content,
      importance: Math.min(10, Math.max(1, importance)),
      tags,
    },
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
  return sdkFetch<BrainSearchResult>('/brain/search', {
    method: 'POST',
    body: {
      query,
      limit,
    },
  });
}

// ============================================
// CHAT / AI GENERATION
// ============================================

export interface ChatResponse {
  text: string;
  model: string;
  tokens_used: number;
}

/**
 * Generate an AI response using ECHO Chat (14 personalities, multi-LLM).
 * Used by the Steven AI concierge and other AI features.
 */
export async function generateChatResponse(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  personality: string = 'echo_prime'
): Promise<ChatResponse> {
  return sdkFetch<ChatResponse>('/worker/call', {
    method: 'POST',
    body: {
      worker: 'echo-chat',
      path: '/chat',
      method: 'POST',
      body: {
        messages,
        personality,
        max_tokens: 1024,
      },
    },
    timeoutMs: 30000,
  });
}
