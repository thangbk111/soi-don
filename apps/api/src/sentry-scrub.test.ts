import type { ErrorEvent } from '@sentry/nestjs';
import { describe, expect, it } from 'vitest';
import { scrubSentryEvent } from '@soi-don/shared';

describe('scrubSentryEvent với event Sentry thật', () => {
  it('chỉ giữ method + path của request, bỏ user/extra, che message và breadcrumb', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'scan failed for an@gmail.com',
      request: {
        method: 'GET',
        url: 'https://soidon.vercel.app/api/gmail/callback?code=4/0Abc&state=xyz',
        headers: { cookie: 'sd_session=secret' },
        cookies: { sd_session: 'secret' },
        data: { productName: 'Kem chống nắng' },
        query_string: 'code=4/0Abc',
      },
      user: { email: 'an@gmail.com', ip_address: '1.2.3.4' },
      extra: { amount: 159000 },
      exception: { values: [{ type: 'Error', value: 'Shop "Nhà Sách ABC" total 1.234.567' }] },
      breadcrumbs: [{ message: 'GET /orders?from=2026-01-01', data: { url: '/orders?x=1' } }],
    };
    const out = scrubSentryEvent(event);
    expect(out.request).toEqual({
      method: 'GET',
      url: 'https://soidon.vercel.app/api/gmail/callback',
    });
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.message).toBe('scan failed for [email]');
    expect(out.exception?.values?.[0].value).toBe('Shop "…" total [số]');
    expect(out.breadcrumbs?.[0].data).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(/secret|Kem|159000|an@gmail|4\/0Abc/);
  });
});
