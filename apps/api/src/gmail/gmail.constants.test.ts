import { describe, expect, it } from 'vitest';
import { isShopeeSender, shopeeQuery, subjectTemplate } from './gmail.constants';

describe('gmail helpers', () => {
  it('builds query with epoch seconds', () => {
    expect(
      shopeeQuery({
        after: new Date('2026-09-30T17:00:00Z'),
        before: new Date('2026-10-31T17:00:00Z'),
      }),
    ).toBe(
      'from:(shopee.vn OR shopee.com) subject:("giao hàng thành công" OR "thanh toán thành công" OR "trả hàng" OR "hoàn tiền") after:1790787600 before:1793466000 -in:spam -in:trash',
    );
    expect(shopeeQuery({ after: new Date('2026-09-30T17:00:00Z') })).not.toContain('before:');
  });

  it('checks sender domain strictly', () => {
    expect(isShopeeSender('Shopee <info@mail.shopee.vn>')).toBe(true);
    expect(isShopeeSender('no-reply@shopee.com')).toBe(true);
    expect(isShopeeSender('Fake <shopee.vn@evil.com>')).toBe(false);
    expect(isShopeeSender('x@notshopee.vn')).toBe(false);
  });

  it('groups subjects', () => {
    expect(subjectTemplate('Đơn hàng #240512ABCD1234 đã giao thành công')).toBe(
      'Đơn hàng # đã giao thành công',
    );
  });
});
