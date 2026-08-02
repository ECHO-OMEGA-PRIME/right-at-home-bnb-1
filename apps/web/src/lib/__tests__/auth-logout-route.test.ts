import { describe, expect, it } from 'vitest';

import { POST } from '../../../app/api/auth/logout/route';

describe('POST /api/auth/logout', () => {
  it('expires the HttpOnly session cookie without caching', async () => {
    const response = await POST();
    const cookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(cookie).toContain('rah-auth-token=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Max-Age=0');
  });
});
