import { safeSmartHomeGet, safeSmartHomePost } from '@/lib/smart-home-handlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = safeSmartHomeGet;
export const POST = safeSmartHomePost;
