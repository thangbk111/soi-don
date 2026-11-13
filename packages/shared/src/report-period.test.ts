import { describe, expect, it } from 'vitest';
import { presetRange } from './date-range';
import {
  addDaysYmd,
  buckets,
  granularityOf,
  isCovered,
  mergeRanges,
  previousPeriod,
} from './report-period';

// 12/11/2026 19:00 giờ VN
const NOW = new Date('2026-11-12T12:00:00Z');

describe('previousPeriod', () => {
  it('tháng trọn → tháng liền trước, kể cả khi số ngày khác nhau', () => {
    expect(previousPeriod({ from: '2026-03-01', to: '2026-03-31' }, NOW)).toEqual({
      range: { from: '2026-02-01', to: '2026-02-28' },
      kind: 'months',
    });
    expect(previousPeriod(presetRange('lastMonth', NOW), NOW).range).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('quý / năm trọn → kỳ liền trước cùng số tháng', () => {
    expect(previousPeriod({ from: '2026-04-01', to: '2026-06-30' }, NOW).range).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    });
    expect(previousPeriod({ from: '2025-01-01', to: '2025-12-31' }, NOW).range).toEqual({
      from: '2024-01-01',
      to: '2024-12-31',
    });
  });

  it('tháng này chưa hết → cùng số ngày đã trôi qua của tháng trước', () => {
    expect(previousPeriod(presetRange('thisMonth', NOW), NOW)).toEqual({
      range: { from: '2026-10-01', to: '2026-10-12' },
      kind: 'partial',
    });
  });

  it('tháng trước ngắn hơn → giới hạn ở cuối tháng trước', () => {
    const now = new Date('2026-03-30T05:00:00Z');
    expect(previousPeriod({ from: '2026-03-01', to: '2026-03-30' }, now)).toEqual({
      range: { from: '2026-02-01', to: '2026-02-28' },
      kind: 'partial',
    });
  });

  it('khoảng tùy chọn / cuộn → khoảng liền trước cùng số ngày', () => {
    expect(previousPeriod({ from: '2026-10-05', to: '2026-10-14' }, NOW)).toEqual({
      range: { from: '2026-09-25', to: '2026-10-04' },
      kind: 'days',
    });
    const r3 = presetRange('3m', NOW); // 12/08 – 12/11, 93 ngày
    expect(previousPeriod(r3, NOW).range).toEqual({ from: '2026-05-11', to: '2026-08-11' });
  });
});

describe('buckets', () => {
  it('≤ 62 ngày theo ngày, dài hơn theo tháng', () => {
    expect(granularityOf({ from: '2026-09-12', to: '2026-11-12' })).toBe('day');
    expect(granularityOf(presetRange('3m', NOW))).toBe('month');
  });

  it('theo ngày: mọi ngày, kể cả qua năm', () => {
    expect(buckets({ from: '2025-12-30', to: '2026-01-02' }, 'day').map((b) => b.key)).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
  });

  it('theo tháng: tháng đầu và cuối bị cắt theo khoảng báo cáo', () => {
    expect(buckets({ from: '2026-08-12', to: '2026-10-05' }, 'month')).toEqual([
      { key: '2026-08', range: { from: '2026-08-12', to: '2026-08-31' } },
      { key: '2026-09', range: { from: '2026-09-01', to: '2026-09-30' } },
      { key: '2026-10', range: { from: '2026-10-01', to: '2026-10-05' } },
    ]);
  });
});

describe('isCovered', () => {
  it('hợp các lần quét liền nhau phủ trọn khoảng', () => {
    const scans = [
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-11-12' },
    ];
    expect(isCovered({ from: '2026-09-15', to: '2026-10-15' }, scans)).toBe(true);
    expect(isCovered({ from: '2026-08-31', to: '2026-09-10' }, scans)).toBe(false);
  });

  it('có khoảng trống ở giữa → chưa phủ', () => {
    const scans = [
      { from: '2026-09-01', to: '2026-09-10' },
      { from: '2026-09-12', to: '2026-09-30' },
    ];
    expect(isCovered({ from: '2026-09-01', to: '2026-09-30' }, scans)).toBe(false);
    expect(isCovered({ from: '2026-09-12', to: '2026-09-20' }, scans)).toBe(true);
    expect(isCovered({ from: '2026-09-01', to: '2026-09-30' }, [])).toBe(false);
  });

  it('mergeRanges gộp khoảng chồng / liền nhau', () => {
    expect(
      mergeRanges([
        { from: '2026-10-01', to: '2026-11-12' },
        { from: '2026-09-01', to: '2026-09-30' },
        { from: '2026-11-01', to: '2026-11-05' },
        { from: '2026-12-01', to: '2026-12-02' },
      ]),
    ).toEqual([
      { from: '2026-09-01', to: '2026-11-12' },
      { from: '2026-12-01', to: '2026-12-02' },
    ]);
  });

  it('addDaysYmd qua tháng / năm nhuận', () => {
    expect(addDaysYmd('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysYmd('2026-01-01', -1)).toBe('2025-12-31');
  });
});
