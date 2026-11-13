import { addMonthsYmd, type DateRange, rangeDays, todayVn } from './date-range';

/**
 * Kỳ so sánh và nhóm thời gian cho trang Tổng quan. Làm trên chuỗi "YYYY-MM-DD" theo lịch VN
 * như phần còn lại của date-range, nên web và API ra cùng một kết quả.
 */

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = [Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)), Number(ymd.slice(8, 10))];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function lastDayOfMonth(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  return `${ymd.slice(0, 8)}${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

const monthIndex = (ymd: string) => Number(ymd.slice(0, 4)) * 12 + Number(ymd.slice(5, 7)) - 1;

/**
 * - `months`: kỳ gồm trọn tháng (tháng, quý, năm…) → kỳ liền trước cùng số tháng.
 * - `partial`: kỳ tính theo tháng nhưng chưa kết thúc (đến hôm nay) → cùng số ngày đã trôi qua
 *   tính từ đầu kỳ trước, không vượt quá cuối kỳ trước (tháng trước có thể ngắn hơn).
 * - `days`: khoảng tùy chọn → khoảng liền trước có cùng số ngày.
 */
export type ComparisonKind = 'months' | 'partial' | 'days';

export function previousPeriod(
  range: DateRange,
  now: Date = new Date(),
): { range: DateRange; kind: ComparisonKind } {
  const today = todayVn(now);
  if (range.from.endsWith('-01')) {
    const months = monthIndex(range.to) - monthIndex(range.from) + 1;
    const prevFrom = addMonthsYmd(range.from, -months);
    const prevEnd = addDaysYmd(range.from, -1);
    if (range.to === lastDayOfMonth(range.to))
      return { range: { from: prevFrom, to: prevEnd }, kind: 'months' };
    if (range.to === today) {
      const elapsedEnd = addDaysYmd(prevFrom, rangeDays(range) - 1);
      return {
        range: { from: prevFrom, to: elapsedEnd < prevEnd ? elapsedEnd : prevEnd },
        kind: 'partial',
      };
    }
  }
  const days = rangeDays(range);
  return {
    range: { from: addDaysYmd(range.from, -days), to: addDaysYmd(range.from, -1) },
    kind: 'days',
  };
}

export type Granularity = 'day' | 'month';

/** Khoảng tối đa 62 ngày vẽ theo ngày, dài hơn vẽ theo tháng. */
export function granularityOf(range: DateRange): Granularity {
  return rangeDays(range) <= 62 ? 'day' : 'month';
}

export interface Bucket {
  /** "YYYY-MM-DD" hoặc "YYYY-MM" */
  key: string;
  /** Phần của kỳ nằm trong khoảng báo cáo (tháng đầu/cuối có thể bị cắt). */
  range: DateRange;
}

export function bucketKey(ymd: string, g: Granularity): string {
  return g === 'day' ? ymd : ymd.slice(0, 7);
}

/** Mọi kỳ trong khoảng, theo thứ tự thời gian. */
export function buckets(range: DateRange, g: Granularity): Bucket[] {
  const out: Bucket[] = [];
  let cur = range.from;
  while (cur <= range.to) {
    const end = g === 'day' ? cur : lastDayOfMonth(cur);
    const to = end < range.to ? end : range.to;
    out.push({ key: bucketKey(cur, g), range: { from: cur, to } });
    cur = addDaysYmd(to, 1);
  }
  return out;
}

/** Gộp các khoảng chồng nhau hoặc liền nhau, theo thứ tự thời gian. */
export function mergeRanges(ranges: DateRange[]): DateRange[] {
  const out: DateRange[] = [];
  for (const r of [...ranges].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))) {
    const last = out[out.length - 1];
    if (last && r.from <= addDaysYmd(last.to, 1)) {
      if (r.to > last.to) last.to = r.to;
    } else out.push({ ...r });
  }
  return out;
}

/** Khoảng `range` có nằm trọn trong hợp các khoảng đã quét không. */
export function isCovered(range: DateRange, scanned: DateRange[]): boolean {
  return mergeRanges(scanned).some((s) => s.from <= range.from && s.to >= range.to);
}
