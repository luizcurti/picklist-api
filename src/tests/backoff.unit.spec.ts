import { computeRetryDelayMs } from '@shared/infra/messaging/rabbitmq/backoff';

describe('computeRetryDelayMs', () => {
  const options = { baseDelayMs: 1000, maxDelayMs: 60_000 };

  it('grows exponentially with the attempt number', () => {
    const random = () => 0; // isolates the exponential term from jitter

    expect(computeRetryDelayMs(0, { ...options, random })).toBe(500);
    expect(computeRetryDelayMs(1, { ...options, random })).toBe(1000);
    expect(computeRetryDelayMs(2, { ...options, random })).toBe(2000);
  });

  it('caps the exponential growth at maxDelayMs', () => {
    const delay = computeRetryDelayMs(10, { ...options, random: () => 0 });

    // exponential would be 1000*2^10 without the cap; capped at 60000,
    // equal jitter with random()=0 -> 60000/2 = 30000.
    expect(delay).toBe(30_000);
  });

  it('applies equal jitter between half and the full (capped) exponential delay', () => {
    const low = computeRetryDelayMs(1, { ...options, random: () => 0 });
    const high = computeRetryDelayMs(1, { ...options, random: () => 1 });

    // exponential for attempt=1 is 2000: half-fixed floor is 1000,
    // full ceiling (all jitter) is 2000.
    expect(low).toBe(1000);
    expect(high).toBe(2000);
  });

  it('defaults to Math.random when no random function is injected', () => {
    const delay = computeRetryDelayMs(0, options);

    // exponential for attempt=0 is 1000; jitter range is [500, 1000].
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1000);
  });
});
