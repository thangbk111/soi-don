/**
 * Gmail tính quota theo "units": messages.list = 5, messages.get = 5.
 * Token bucket giữ tốc độ dưới trần quota per-user.
 */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly ratePerSec: number,
    private readonly capacity: number = ratePerSec,
  ) {
    this.tokens = capacity;
  }

  async take(cost: number): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(
        this.capacity,
        this.tokens + ((now - this.last) / 1000) * this.ratePerSec,
      );
      this.last = now;
      if (this.tokens >= cost) {
        this.tokens -= cost;
        return;
      }
      await sleep(((cost - this.tokens) / this.ratePerSec) * 1000);
    }
  }
}

interface GaxiosLikeError {
  code?: number | string;
  status?: number;
  message?: string;
  response?: {
    status?: number;
    headers?: Record<string, string> | { get?(k: string): string | null };
  };
}

function statusOf(e: GaxiosLikeError): number | undefined {
  const s = e.response?.status ?? e.status ?? e.code;
  return typeof s === 'number' ? s : Number(s) || undefined;
}

export function isRateLimited(e: unknown): boolean {
  const err = e as GaxiosLikeError;
  const status = statusOf(err);
  if (status === 429) return true;
  return status === 403 && /rate|quota/i.test(err.message ?? '');
}

function retryAfterMs(e: unknown): number | undefined {
  const h = (e as GaxiosLikeError).response?.headers;
  if (!h) return undefined;
  const raw =
    typeof (h as { get?: unknown }).get === 'function'
      ? (h as { get(k: string): string | null }).get('retry-after')
      : (h as Record<string, string>)['retry-after'];
  const secs = Number(raw);
  return Number.isFinite(secs) && secs > 0 ? secs * 1000 : undefined;
}

/** Backoff cho 429/403 quota. Quota tính theo phút nên tổng thời gian chờ phải vượt 60s. */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; maxDelayMs?: number; onRetry?: (delayMs: number) => void } = {},
): Promise<T> {
  const { retries = 7, maxDelayMs = 65_000, onRetry } = opts;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRateLimited(e) || attempt >= retries) throw e;
      const delay = Math.min(
        maxDelayMs,
        retryAfterMs(e) ?? 2 ** attempt * 1000 + Math.random() * 500,
      );
      onRetry?.(delay);
      await sleep(delay);
    }
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
