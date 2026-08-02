import { describe, expect, it } from 'vitest';

import { safeCallbackPath } from '../safe-redirect';

describe('safeCallbackPath', () => {
  it.each([
    ['https://evil.example/steal', '/dashboard'],
    ['//evil.example/steal', '/dashboard'],
    ['%2F%2Fevil.example/steal', '/dashboard'],
    ['%252F%252Fevil.example/steal', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['/owner\u0000', '/dashboard'],
  ])('rejects an unsafe callback %s', (value, expected) => {
    expect(safeCallbackPath(value)).toBe(expected);
  });

  it('keeps a same-origin path, query and fragment', () => {
    expect(safeCallbackPath('/owner?tab=bookings#today')).toBe('/owner?tab=bookings#today');
  });
});
