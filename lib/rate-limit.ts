import "server-only";

// In-memory sliding-window rate limiter. Proportionate for ~280 pilots on a
// single Vercel instance; resets on redeploy, which is acceptable here.

const windows = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    windows.set(key, hits);
    return false;
  }

  hits.push(now);
  windows.set(key, hits);

  // Housekeeping so the map cannot grow unbounded.
  if (windows.size > 1000) {
    for (const [k, v] of windows) {
      if (v.every((t) => now - t >= windowMs)) windows.delete(k);
    }
  }

  return true;
}
