import { describe, expect, it } from 'vitest';
import { redactPii, stripQuery } from './redact';

describe('redactPii', () => {
  it('cắt tham số truy vấn trong lỗi Prisma', () => {
    const msg = [
      '',
      'Invalid `prisma.transactionItem.create()` invocation in',
      '/repo/apps/api/dist/ingestion/scan.service.js:120:9',
      '',
      '  data: { productName: "Kem chống nắng", lineTotal: 159000 }',
      'Argument `unitPrice` is missing.',
    ].join('\n');
    const out = redactPii(msg);
    expect(out).not.toContain('Kem');
    expect(out).not.toContain('159000');
    expect(out).toContain('prisma.transactionItem.create()');
  });

  it('che email, chuỗi trong ngoặc, token và số dài', () => {
    expect(redactPii('user an.nguyen+1@gmail.com failed')).toBe('user [email] failed');
    expect(redactPii('Không tìm thấy shop "Nhà Sách ABC"')).toBe('Không tìm thấy shop "…"');
    expect(redactPii('token ya29.a0AfB_byC1234567890abcdefghijklmnopqrstuv')).toBe(
      'token [secret]',
    );
    expect(redactPii('order 2411130ABCDEF total 1.234.567 đ')).toBe(
      'order [số]ABCDEF total [số] đ',
    );
  });

  it('giữ nguyên thông tin kỹ thuật vô hại', () => {
    expect(redactPii('Request failed with status code 429')).toBe(
      'Request failed with status code 429',
    );
    expect(redactPii('Cannot read properties of undefined (reading map)')).toBe(
      'Cannot read properties of undefined (reading map)',
    );
  });
});

describe('stripQuery', () => {
  it('bỏ query và fragment', () => {
    expect(stripQuery('https://x.vn/api/gmail/callback?code=abc&state=1')).toBe(
      'https://x.vn/api/gmail/callback',
    );
    expect(stripQuery('/orders?from=2026-01-01#top')).toBe('/orders');
    expect(stripQuery('/dashboard')).toBe('/dashboard');
  });
});
