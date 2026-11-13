import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseViDateTime } from './datetime';
import { htmlToLines } from './lines';
import { parseOrderSection } from './order-blocks';
import { parseEmail } from './registry';
import { shopeePaymentParser } from './shopee.parsers';

const DIR = join(__dirname, '../../../../packages/parser-fixtures/shopee');
const fixtures = readdirSync(DIR)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''));

describe('Shopee fixtures', () => {
  it('has fixtures', () => expect(fixtures.length).toBeGreaterThanOrEqual(7));

  it.each(fixtures)('%s', (name) => {
    const meta = JSON.parse(readFileSync(join(DIR, `${name}.meta.json`), 'utf8'));
    const expected = JSON.parse(readFileSync(join(DIR, `${name}.expected.json`), 'utf8'));
    const res = parseEmail({
      messageId: name,
      from: meta.from,
      subject: meta.subject,
      receivedAt: new Date(meta.receivedAt),
      html: readFileSync(join(DIR, `${name}.html`), 'utf8'),
    });
    // JSON round-trip để so Date dưới dạng ISO string.
    expect(
      JSON.parse(JSON.stringify({ parser: res?.parser.id ?? null, events: res?.events ?? [] })),
    ).toEqual(expected);
  });
});

describe('parseViDateTime (giờ VN)', () => {
  it.each([
    ['20/10/2026 09:24:02', '2026-10-20T02:24:02.000Z'],
    ['10 Th10 2026 10:57:07', '2026-10-10T03:57:07.000Z'],
    ['10 Th 11 2026 21:10:11', '2026-11-10T14:10:11.000Z'],
    ['Đơn hàng đã được giao thành công ngày 06/11/2026.', '2026-11-05T17:00:00.000Z'],
  ])('%s', (input, iso) => expect(parseViDateTime(input)?.toISOString()).toBe(iso));

  it('rejects garbage', () => expect(parseViDateTime('32/13/2026')).toBeUndefined());
});

/** Email tổng hợp tối giản theo đúng cấu trúc dòng của template thật. */
function syntheticHtml(lines: string[]) {
  return `<html><body><table>${lines.map((l) => `<tr><td>${l}</td></tr>`).join('')}</table></body></html>`;
}

describe('edge cases', () => {
  it('flags payment total mismatch', () => {
    const html = syntheticHtml([
      'THÔNG TIN ĐƠN HÀNG - DÀNH CHO NGƯỜI MUA',
      'Mã đơn hàng:',
      '#261110AAAAAAAA',
      'Ngày đặt hàng:',
      '10 Th11 2026 21:00:00',
      'Người bán:',
      'shop_a',
      '1. Áo thun',
      'Số lượng:',
      '1',
      'Giá:',
      '₫100,000',
      'Tổng tiền:',
      '₫100,000',
      'Phí vận chuyển:',
      '₫15,000',
      'Tổng thanh toán:',
      '₫115,000',
      'THÔNG TIN NHẬN HÀNG',
      'Tên người nhận:',
      'X',
      'THÔNG TIN THANH TOÁN',
      'Số tiền thanh toán:',
      '₫200,000',
    ]);
    const [e] = shopeePaymentParser.parse({
      messageId: 'x',
      from: 'info@mail.shopee.vn',
      subject: 'Xác nhận thanh toán thành công',
      receivedAt: new Date(),
      html,
    });
    expect(e.warnings).toContain('payment_total_mismatch');
    expect(e.confidence).toBeLessThan(0.8);
    expect(e.shippingFee).toBe(15_000);
    expect(e.discountAmount).toBe(0);
  });

  it('never reads the recipient section', () => {
    const lines = htmlToLines(
      syntheticHtml([
        'THÔNG TIN ĐƠN HÀNG',
        'Mã đơn hàng:',
        '#261110AAAAAAAA',
        'Tổng thanh toán:',
        '₫1,000',
        'THÔNG TIN NHẬN HÀNG',
        'Người bán:',
        'should_not_be_read',
        'Tổng thanh toán:',
        '₫999,999',
      ]),
    );
    const { blocks } = parseOrderSection(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].netAmount).toBe(1000);
    expect(blocks[0].shopName).toBeUndefined();
  });

  it('flags missing net amount and unknown money labels', () => {
    const lines = htmlToLines(
      syntheticHtml([
        'THÔNG TIN ĐƠN HÀNG',
        'Mã đơn hàng:',
        '#261110AAAAAAAA',
        '1. Áo',
        'Số lượng:',
        '1',
        'Giá:',
        '₫50,000',
        'Tổng tiền:',
        '₫50,000',
        'Phí bảo hiểm:',
        '₫2,000',
        'BƯỚC TIẾP THEO',
      ]),
    );
    const { blocks } = parseOrderSection(lines);
    expect(blocks[0].unknownMoneyLabels).toEqual(['phi bao hiem']);
    expect(blocks[0].netAmount).toBeUndefined();
  });

  it('ignores non-Shopee senders even with an order subject', () => {
    expect(
      parseEmail({
        messageId: 'x',
        from: 'Shopee <info@shopee-vn.evil.com>',
        subject: 'Đơn hàng #261110AAAAAAAA đã giao hàng thành công',
        receivedAt: new Date(),
        html: '',
      }),
    ).toBeNull();
  });
});
