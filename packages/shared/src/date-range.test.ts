import { describe, expect, it } from 'vitest';
import {
  addMonthsYmd,
  formatYmd,
  presetRange,
  rangeDays,
  rangeInstants,
  todayVn,
  validateRange,
} from './date-range';

// 12/11/2026 19:00 giờ VN
const NOW = new Date('2026-11-12T12:00:00Z');

describe('date-range', () => {
  it('uses VN calendar day', () => {
    expect(todayVn(new Date('2026-11-12T16:59:59Z'))).toBe('2026-11-12');
    expect(todayVn(new Date('2026-11-12T17:00:00Z'))).toBe('2026-11-13');
  });

  it('converts a range to [start, endExclusive) in VN time', () => {
    const { start, endExclusive } = rangeInstants({ from: '2026-10-01', to: '2026-10-31' });
    expect(start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('clamps month arithmetic', () => {
    expect(addMonthsYmd('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsYmd('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonthsYmd('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonthsYmd('2026-11-12', -12)).toBe('2025-11-12');
  });

  it('builds presets', () => {
    expect(presetRange('thisMonth', NOW)).toEqual({ from: '2026-11-01', to: '2026-11-12' });
    expect(presetRange('1m', NOW)).toEqual({ from: '2026-10-12', to: '2026-11-12' });
    expect(presetRange('lastMonth', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('lastMonth', new Date('2026-03-05T05:00:00Z'))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(presetRange('lastMonth', new Date('2026-01-10T05:00:00Z'))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(presetRange('12m', NOW)).toEqual({ from: '2025-11-12', to: '2026-11-12' });
  });

  it('validates ranges', () => {
    expect(validateRange({ from: '2026-10-01', to: '2026-10-31' }, NOW)).toBeNull();
    expect(validateRange({ from: '2026-11-12', to: '2026-11-12' }, NOW)).toBeNull();
    expect(validateRange({ from: '2026-10-31', to: '2026-10-01' }, NOW)).toMatch(/trước/);
    expect(validateRange({ from: '2026-10-01', to: '2026-11-13' }, NOW)).toMatch(/hôm nay/);
    expect(validateRange({ from: '2024-01-01', to: '2026-10-01' }, NOW)).toMatch(/24 tháng/);
    expect(validateRange({ from: '2026-02-30', to: '2026-10-01' }, NOW)).toMatch(/không hợp lệ/);
    expect(validateRange({ from: '2026-10-01' }, NOW)).toMatch(/không hợp lệ/);
  });

  it('formats dates', () => expect(formatYmd('2026-10-01')).toBe('01/10/2026'));

  it('counts days inclusively', () => {
    expect(rangeDays({ from: '2026-10-01', to: '2026-10-31' })).toBe(31);
    expect(rangeDays({ from: '2026-10-20', to: '2026-10-20' })).toBe(1);
    expect(rangeDays({ from: '2025-11-12', to: '2026-11-12' })).toBe(366);
  });
});
