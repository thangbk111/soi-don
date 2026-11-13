import { describe, expect, it } from 'vitest';
import { allocateOrder } from './allocation';

const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

describe('allocateOrder', () => {
  it('chia tiền hàng sau giảm (net − ship) theo tỷ trọng tiền hàng', () => {
    // Fixture payment-multi-order, đơn CeraVe: 1 sản phẩm + 2 quà tặng 0đ.
    const r = allocateOrder({
      grossAmount: 501_000,
      shippingFee: 0,
      netAmount: 371_569,
      lineTotals: [501_000, 0, 0],
    });
    expect(r).toEqual({ lines: [371_569, 0, 0], unallocated: 0 });
  });

  it('không trừ giảm giá hai lần: tổng phân bổ + ship = thực trả', () => {
    const r = allocateOrder({
      grossAmount: 300_000,
      shippingFee: 15_000,
      netAmount: 255_000, // giảm 60.000
      lineTotals: [200_000, 100_000],
    });
    expect(r.lines).toEqual([160_000, 80_000]);
    expect(sum(r.lines) + r.unallocated + 15_000).toBe(255_000);
  });

  it('phần dư làm tròn theo phần dư lớn nhất, hòa thì dòng đứng trước', () => {
    const r = allocateOrder({
      grossAmount: 3,
      shippingFee: 0,
      netAmount: 100,
      lineTotals: [1, 1, 1],
    });
    expect(r.lines).toEqual([34, 33, 33]);
    expect(r.unallocated).toBe(0);
  });

  it('tổng luôn khớp với số lẻ bất kỳ', () => {
    const lineTotals = [123_457, 98_761, 1_001, 77_777];
    const gross = lineTotals.reduce((s, x) => s + x, 0);
    for (const net of [1, 99_999, 187_653, 300_996, gross]) {
      const r = allocateOrder({ grossAmount: gross, shippingFee: 0, netAmount: net, lineTotals });
      expect(sum(r.lines) + r.unallocated).toBe(net);
      expect(r.unallocated).toBe(0);
    }
  });

  it('thiếu giá một sản phẩm: không chia đều, phần không gán được vào "Chưa phân bổ"', () => {
    // Tổng tiền hàng 300k nhưng chỉ đọc được giá 1 sản phẩm (200k); sản phẩm kia giá 0 (không rõ).
    const r = allocateOrder({
      grossAmount: 300_000,
      shippingFee: 0,
      netAmount: 270_000,
      lineTotals: [200_000, 0],
    });
    expect(r.lines).toEqual([180_000, 0]);
    expect(r.unallocated).toBe(90_000);
  });

  it('không có sản phẩm nào có giá: toàn bộ vào "Chưa phân bổ", dòng = null', () => {
    const r = allocateOrder({
      grossAmount: 0,
      shippingFee: 0,
      netAmount: 50_000,
      lineTotals: [0, 0],
    });
    expect(r).toEqual({ lines: [null, null], unallocated: 50_000 });
  });

  it('đơn không có dòng sản phẩm: giá trị đã biết vào "Chưa phân bổ"', () => {
    const r = allocateOrder({ grossAmount: 0, shippingFee: 10_000, netAmount: 60_000, lineTotals: [] });
    expect(r).toEqual({ lines: [], unallocated: 50_000 });
  });

  it('đơn miễn phí: tất cả bằng 0, không có "Chưa phân bổ"', () => {
    const r = allocateOrder({ grossAmount: 0, shippingFee: 0, netAmount: 0, lineTotals: [0] });
    expect(r).toEqual({ lines: [0], unallocated: 0 });
  });

  it('thực trả nhỏ hơn phí ship: không phân bổ số âm vào sản phẩm', () => {
    const r = allocateOrder({ grossAmount: 10_000, shippingFee: 20_000, netAmount: 5_000, lineTotals: [10_000] });
    expect(r).toEqual({ lines: [null], unallocated: -15_000 });
  });

  it('số lớn không tràn số', () => {
    const r = allocateOrder({
      grossAmount: 2_000_000_000,
      shippingFee: 0,
      netAmount: 1_999_999_999,
      lineTotals: [1_000_000_001, 999_999_999],
    });
    expect(sum(r.lines)).toBe(1_999_999_999);
    expect(r.unallocated).toBe(0);
  });
});
