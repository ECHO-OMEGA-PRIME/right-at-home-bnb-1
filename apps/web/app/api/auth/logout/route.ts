/** Clear the server-owned RAH session cookie. */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AUTH_COOKIE = 'rah-auth-token';

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
