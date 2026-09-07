import { NextResponse } from "next/server";

// Best-effort in-memory sliding window. On serverless hosts each instance
// keeps its own counters, so this is a brake on abuse from a single origin
// rather than a hard global quota — good enough for login/payment/public API
// endpoints that previously had no limit at all. Swap for Upstash/Redis if a
// shared limiter is ever needed.
type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function prune(now: number, windowMs: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  prune(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const retryAfterMs = windowMs - (now - bucket.hits[0]);
    return { ok: false as const, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true as const, remaining: limit - bucket.hits.length };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/** Convenience: limit by scope + client IP. Returns a 429 response or null. */
export function enforceRateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  const result = rateLimit(`${scope}:${getClientIp(req)}`, limit, windowMs);
  if (result.ok) return null;
  return rateLimitResponse(result.retryAfterSeconds);
}
