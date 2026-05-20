import { NextRequest, NextResponse } from 'next/server';

// ── Types ────────────────────────────────────────────────────────────────────
interface ServiceCost {
  id: string;
  service: string;
  category: string;
  description: string;
  monthlyCost: number;
  billingCycle: string;
  status: string;
  usageMetric?: string;
  currentUsage?: number;
  usageLimit?: number;
  notes?: string;
  lastBilled?: string;
}

// ── In-memory store (replace with DB later) ──────────────────────────────────
const serviceCosts: ServiceCost[] = [
  {
    id: 'svc-twilio',
    service: 'Twilio',
    category: 'communications',
    description: 'Voice calls, SMS, and phone numbers for guest communication and AI concierge',
    monthlyCost: 50.00,
    billingCycle: 'usage-based',
    status: 'active',
    usageMetric: 'calls/month',
    currentUsage: 320,
    usageLimit: 1000,
    notes: 'Includes 2 phone numbers ($2/mo each) + per-minute charges',
    lastBilled: '2026-03-01',
  },
  {
    id: 'svc-vercel',
    service: 'Vercel',
    category: 'hosting',
    description: 'Next.js hosting for Right at Home BnB web application',
    monthlyCost: 0,
    billingCycle: 'free',
    status: 'free-tier',
    usageMetric: 'deployments',
    currentUsage: 47,
    usageLimit: 6000,
    notes: 'Hobby plan - free for personal projects. Auto-deploys from GitHub.',
    lastBilled: undefined,
  },
  {
    id: 'svc-cloudflare',
    service: 'Cloudflare Workers',
    category: 'hosting',
    description: 'Serverless workers for AI orchestration, vault API, shared brain, and more',
    monthlyCost: 0,
    billingCycle: 'free',
    status: 'free-tier',
    usageMetric: 'requests/day',
    currentUsage: 12400,
    usageLimit: 100000,
    notes: 'Free tier: 100K requests/day. Running 9+ workers.',
    lastBilled: undefined,
  },
  {
    id: 'svc-supabase',
    service: 'Supabase',
    category: 'database',
    description: 'PostgreSQL database and auth for property management data',
    monthlyCost: 0,
    billingCycle: 'free',
    status: 'free-tier',
    usageMetric: 'rows',
    currentUsage: 18500,
    usageLimit: 500000,
    notes: 'Free tier: 500MB database, 1GB file storage, 50K monthly active users',
    lastBilled: undefined,
  },
  {
    id: 'svc-elevenlabs',
    service: 'ElevenLabs',
    category: 'ai',
    description: 'Text-to-speech for AI concierge voice responses',
    monthlyCost: 5.00,
    billingCycle: 'monthly',
    status: 'active',
    usageMetric: 'characters/month',
    currentUsage: 45000,
    usageLimit: 100000,
    notes: 'Starter plan at $5/mo. Used for Steven AI voice output.',
    lastBilled: '2026-03-15',
  },
  {
    id: 'svc-groq',
    service: 'Groq',
    category: 'ai',
    description: 'Ultra-fast LLM inference for guest chat and AI concierge',
    monthlyCost: 0,
    billingCycle: 'free',
    status: 'free-tier',
    usageMetric: 'requests/day',
    currentUsage: 85,
    usageLimit: 14400,
    notes: 'Free tier with generous rate limits. Llama 3 and Mixtral models.',
    lastBilled: undefined,
  },
  {
    id: 'svc-github',
    service: 'GitHub',
    category: 'hosting',
    description: 'Source code repository and CI/CD for all Right at Home projects',
    monthlyCost: 0,
    billingCycle: 'free',
    status: 'free-tier',
    usageMetric: 'repos',
    currentUsage: 27,
    usageLimit: undefined,
    notes: 'Free plan with unlimited private repos. Actions minutes: 2000/mo.',
    lastBilled: undefined,
  },
  {
    id: 'svc-zoho',
    service: 'Zoho Mail',
    category: 'email',
    description: 'Professional email hosting for rah-midland.com domain',
    monthlyCost: 0,
    billingCycle: 'free',
    status: 'free-tier',
    usageMetric: 'mailboxes',
    currentUsage: 2,
    usageLimit: 5,
    notes: 'Free plan: up to 5 users, 5GB/user. Custom domain email.',
    lastBilled: undefined,
  },
  {
    id: 'svc-domain-rah',
    service: 'Domain (rah-midland.com)',
    category: 'other',
    description: 'Primary domain for Right at Home BnB website',
    monthlyCost: 1.00,
    billingCycle: 'annual',
    status: 'active',
    notes: 'Registered via Cloudflare Registrar. ~$12/year.',
    lastBilled: '2026-01-15',
  },
  {
    id: 'svc-domain-echo',
    service: 'Domain (echo-op.com)',
    category: 'other',
    description: 'Domain for Echo Prime Tech platform',
    monthlyCost: 1.00,
    billingCycle: 'annual',
    status: 'active',
    notes: 'Registered via Cloudflare Registrar. ~$12/year.',
    lastBilled: '2026-02-01',
  },
  {
    id: 'svc-resend',
    service: 'Resend',
    category: 'email',
    description: 'Transactional email API for booking confirmations and notifications',
    monthlyCost: 0,
    billingCycle: 'free',
    status: 'free-tier',
    usageMetric: 'emails/day',
    currentUsage: 12,
    usageLimit: 100,
    notes: 'Free tier: 100 emails/day, 3000/month. Used for guest notifications.',
    lastBilled: undefined,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildSummary(costs: ServiceCost[]) {
  const totalMonthly = costs.reduce((sum, c) => sum + c.monthlyCost, 0);
  const totalAnnual = totalMonthly * 12;
  const activeServices = costs.filter((c) => c.status === 'active' || c.status === 'trial').length;
  const freeServices = costs.filter((c) => c.status === 'free-tier').length;

  const byCategory: Record<string, { count: number; monthly: number; services: string[] }> = {};
  for (const c of costs) {
    if (!byCategory[c.category]) {
      byCategory[c.category] = { count: 0, monthly: 0, services: [] };
    }
    byCategory[c.category].count += 1;
    byCategory[c.category].monthly += c.monthlyCost;
    byCategory[c.category].services.push(c.service);
  }

  return {
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalAnnual * 100) / 100,
    activeServices,
    freeServices,
    totalServices: costs.length,
    byCategory,
  };
}

// ── GET /api/service-costs ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get('category');
    const status = params.get('status');

    let filtered = [...serviceCosts];

    if (category && category !== 'all') {
      filtered = filtered.filter((c) => c.category === category);
    }
    if (status) {
      filtered = filtered.filter((c) => c.status === status);
    }

    const summary = buildSummary(filtered);

    return NextResponse.json({
      services: filtered,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch service costs', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/service-costs ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.service || !body.category || !body.description || typeof body.monthlyCost !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: service, category, description, monthlyCost' },
        { status: 400 },
      );
    }

    const validCategories = ['communications', 'hosting', 'database', 'ai', 'email', 'other'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    const validStatuses = ['active', 'trial', 'free-tier', 'cancelled'];
    const validCycles = ['monthly', 'annual', 'usage-based', 'free'];

    const existingIdx = serviceCosts.findIndex(
      (s) => s.id === body.id || s.service.toLowerCase() === body.service.toLowerCase(),
    );

    const entry: ServiceCost = {
      id: body.id || `svc-${Date.now().toString(36)}`,
      service: body.service,
      category: body.category,
      description: body.description,
      monthlyCost: body.monthlyCost,
      billingCycle: validCycles.includes(body.billingCycle) ? body.billingCycle : 'monthly',
      status: validStatuses.includes(body.status) ? body.status : 'active',
      usageMetric: body.usageMetric,
      currentUsage: body.currentUsage,
      usageLimit: body.usageLimit,
      notes: body.notes,
      lastBilled: body.lastBilled,
    };

    if (existingIdx >= 0) {
      serviceCosts[existingIdx] = entry;
    } else {
      serviceCosts.push(entry);
    }

    const summary = buildSummary(serviceCosts);

    return NextResponse.json({ service: entry, summary }, { status: existingIdx >= 0 ? 200 : 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to save service cost', detail: error.message },
      { status: 500 },
    );
  }
}
