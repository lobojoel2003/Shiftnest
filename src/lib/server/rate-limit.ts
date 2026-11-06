/**
 * Tiny in-memory fixed-window rate limiter for login, sign-up and link requests.
 * Good enough for a single-process app; resets on restart.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
	if (buckets.size > 10_000) {
		for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
	}
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	bucket.count++;
	return bucket.count <= max;
}

export function resetRateLimits(): void {
	buckets.clear();
}
