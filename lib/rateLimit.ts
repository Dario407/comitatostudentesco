type Bucket = {
  failures: number[];
  blockedUntil?: number;
};

const globalForRateLimit = globalThis as unknown as {
  loginBuckets?: Map<string, Bucket>;
};

const buckets = globalForRateLimit.loginBuckets ?? new Map<string, Bucket>();

if (!globalForRateLimit.loginBuckets) {
  globalForRateLimit.loginBuckets = buckets;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const BLOCK_MS = 15 * 60 * 1000;

function clean(bucket: Bucket, now: number) {
  bucket.failures = bucket.failures.filter((time) => now - time < WINDOW_MS);
  if (bucket.blockedUntil && bucket.blockedUntil <= now) {
    delete bucket.blockedUntil;
    bucket.failures = [];
  }
}

export function checkLoginRateLimit(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) return { allowed: true as const, retryAfterSeconds: 0 };

  clean(bucket, now);

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000)
    };
  }

  return { allowed: true as const, retryAfterSeconds: 0 };
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { failures: [] };

  clean(bucket, now);
  bucket.failures.push(now);

  if (bucket.failures.length >= MAX_FAILURES) {
    bucket.blockedUntil = now + BLOCK_MS;
  }

  buckets.set(key, bucket);
}

export function resetLoginRateLimit(key: string) {
  buckets.delete(key);
}
