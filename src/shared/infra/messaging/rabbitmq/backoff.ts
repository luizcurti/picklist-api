interface BackoffOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  random?: () => number;
}

// Equal jitter (half fixed, half random): avoids both a thundering herd
// (pure exponential, every retry at the same instant) and a near-zero
// delay (pure "full" jitter, where random() close to 0 barely backs off).
function computeRetryDelayMs(
  attempt: number,
  { baseDelayMs, maxDelayMs, random = Math.random }: BackoffOptions
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

export { computeRetryDelayMs };
