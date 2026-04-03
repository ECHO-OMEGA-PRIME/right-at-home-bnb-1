/**
 * VRBO CDP Client — Browser automation via Chrome DevTools Protocol.
 * Connects to an Edge/Chrome instance with remote debugging enabled on port 9222.
 * Used to scrape the VRBO Partner Portal for messages, reviews, and pricing.
 *
 * Requires: Edge running with --remote-debugging-port=9222
 * Launch: msedge --remote-debugging-port=9222 --user-data-dir="C:/vrbo-cdp-profile"
 */

const CDP_PORT = process.env.VRBO_CDP_PORT || '9222';
const CDP_HOST = process.env.VRBO_CDP_HOST || 'localhost';
const VRBO_EMAIL = process.env.VRBO_EMAIL || '';
const VRBO_PASSWORD = process.env.VRBO_PASSWORD || '';

interface CDPResponse {
  id: number;
  result?: any;
  error?: { message: string };
}

/**
 * Lightweight CDP client that works in Node.js serverless (no websocket library needed).
 * Uses the CDP HTTP API for simple operations, and falls back to fetch-based JSON endpoints.
 */
export class VrboCDPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `http://${CDP_HOST}:${CDP_PORT}`;
  }

  /** Check if CDP is available */
  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/json/version`, { signal: AbortSignal.timeout(3000) });
      return resp.ok;
    } catch {
      return false;
    }
  }

  /** Get list of open browser tabs */
  async getTabs(): Promise<any[]> {
    const resp = await fetch(`${this.baseUrl}/json`);
    return resp.json();
  }

  /** Find the VRBO Partner Portal tab or open one */
  async getVrboTab(): Promise<string | null> {
    const tabs = await this.getTabs();
    const vrboTab = tabs.find((t: any) =>
      t.type === 'page' && (t.url?.includes('vrbo.com/p/') || t.url?.includes('partner.vrbo.com'))
    );
    if (vrboTab) return vrboTab.webSocketDebuggerUrl;

    // Use first available page tab
    const page = tabs.find((t: any) => t.type === 'page');
    return page?.webSocketDebuggerUrl || null;
  }
}

/**
 * VRBO Portal Scraper — Uses HTTP endpoints to trigger Python CDP scripts.
 * Since Vercel serverless can't maintain websocket connections to local CDP,
 * the scrapers run as local Python scripts triggered via a local relay.
 *
 * Architecture:
 *   Vercel cron -> /api/cron/vrbo-messages -> HTTP POST to local relay -> Python CDP script
 *   OR
 *   Vercel cron -> /api/cron/vrbo-messages -> Direct Supabase write (if scraper runs on ALPHA)
 *
 * For now, the scrapers write directly to the database via Prisma when run locally.
 */

export interface VrboPortalMessage {
  threadId: string;
  reservationId: string;
  propertyName: string;
  vrboId: string;
  guestName: string;
  content: string;
  sender: 'guest' | 'host';
  timestamp: Date;
  isRead: boolean;
}

export interface VrboPortalReview {
  reviewId: string;
  propertyName: string;
  vrboId: string;
  guestName: string;
  rating: number;
  title: string;
  content: string;
  response?: string;
  createdAt: Date;
}

export interface VrboPortalPricing {
  vrboId: string;
  propertyName: string;
  nightlyRate: number;
  weekendRate: number;
  weeklyDiscount: number;
  monthlyDiscount: number;
  cleaningFee: number;
  currency: string;
}
