import { describe, expect, it } from 'vitest';
import { isRateLimited, TokenBucket, withBackoff } from './rate-limit';

describe('rate limit', () => {
  it('detects quota errors', () => {
    expect(isRateLimited({ code: 429 })).toBe(true);
    expect(isRateLimited({ response: { status: 429 } })).toBe(true);
    expect(isRateLimited({ code: 403, message: 'Quota exceeded for quota metric' })).toBe(true);
    expect(isRateLimited({ code: 403, message: 'Insufficient Permission' })).toBe(false);
    expect(isRateLimited({ code: 500 })).toBe(false);
  });

  it('retries rate-limited calls then succeeds', async () => {
    let calls = 0;
    const result = await withBackoff(
      async () => {
        if (++calls < 3)
          throw { code: 429, response: { status: 429, headers: { 'retry-after': '0.01' } } };
        return 'ok';
      },
      { maxDelayMs: 20 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry other errors', async () => {
    let calls = 0;
    await expect(
      withBackoff(async () => {
        calls++;
        throw { code: 404 };
      }),
    ).rejects.toEqual({ code: 404 });
    expect(calls).toBe(1);
  });

  it('paces requests', async () => {
    const bucket = new TokenBucket(100, 10); // 100 units/s, burst 10
    const start = Date.now();
    for (let i = 0; i < 4; i++) await bucket.take(5); // 20 units: 10 burst + 10 waited
    expect(Date.now() - start).toBeGreaterThanOrEqual(90);
  });
});
