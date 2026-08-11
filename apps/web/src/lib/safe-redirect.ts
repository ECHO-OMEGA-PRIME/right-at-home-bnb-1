/** Return a same-origin application path, or a safe fallback. */
export function safeCallbackPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;

  let candidate = value.trim();
  try {
    // URLSearchParams decodes once; a second encoded layer must not be able to
    // turn into a protocol-relative URL after navigation.
    for (let i = 0; i < 2 && /%[0-9a-f]{2}/i.test(candidate); i += 1) {
      candidate = decodeURIComponent(candidate);
    }
  } catch {
    return fallback;
  }

  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  const base = new URL('https://rah.invalid');
  const parsed = new URL(candidate, base);
  if (parsed.origin !== base.origin) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
