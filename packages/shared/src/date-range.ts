/**
 * Khoảng ngày theo lịch Việt Nam (UTC+7), dạng "YYYY-MM-DD", hai đầu đều tính.
 * Dùng chung cho web (bộ chọn ngày) và API (lọc đơn, truy vấn Gmail).
 */
export interface DateRange {
  from: string;
  to: string;
}

const VN_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Giới hạn quét lùi tối đa (plan: 12 tháng, tùy chọn 24). */
export const MAX_RANGE_MONTHS = 24;

function parts(ymd: string): [number, number, number] | null {
  const m = YMD_RE.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d)
    return null;
  return [y, mo, d];
}

function ymdOf(y: number, mo: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isValidYmd(ymd: string): boolean {
  return parts(ymd) !== null;
}

/** 00:00 giờ VN của ngày đó. */
export function vnDayStart(ymd: string): Date {
  const p = parts(ymd);
  if (!p) throw new Error(`Invalid date: ${ymd}`);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]) - VN_OFFSET_MS);
}

/** Ngày hôm nay theo giờ VN. */
export function todayVn(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Cộng/trừ tháng, kẹp ngày vào cuối tháng (31/03 − 1 tháng → 28/02 hoặc 29/02). */
export function addMonthsYmd(ymd: string, months: number): string {
  const p = parts(ymd);
  if (!p) throw new Error(`Invalid date: ${ymd}`);
  const total = p[0] * 12 + (p[1] - 1) + months;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return ymdOf(y, mo, Math.min(p[2], lastDay));
}

/** [start, endExclusive) dạng Date để query DB / Gmail. */
export function rangeInstants(range: DateRange): { start: Date; endExclusive: Date } {
  return {
    start: vnDayStart(range.from),
    endExclusive: new Date(vnDayStart(range.to).getTime() + DAY_MS),
  };
}

/** Trả về thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ. */
export function validateRange(range: Partial<DateRange>, now: Date = new Date()): string | null {
  const { from, to } = range;
  if (!from || !to || !isValidYmd(from) || !isValidYmd(to))
    return 'Ngày không hợp lệ (định dạng YYYY-MM-DD)';
  if (from > to) return 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc';
  const today = todayVn(now);
  if (to > today) return 'Ngày kết thúc không được sau hôm nay';
  if (from < addMonthsYmd(today, -MAX_RANGE_MONTHS))
    return `Chỉ hỗ trợ tối đa ${MAX_RANGE_MONTHS} tháng gần nhất`;
  return null;
}

export type RangePresetKey = 'thisMonth' | 'lastMonth' | '1m' | '3m' | '12m';

export const RANGE_PRESETS: { key: RangePresetKey; label: string }[] = [
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
  { key: '1m', label: '1 tháng' },
  { key: '3m', label: '3 tháng' },
  { key: '12m', label: '1 năm' },
];

export function presetRange(key: RangePresetKey, now: Date = new Date()): DateRange {
  const today = todayVn(now);
  switch (key) {
    case 'thisMonth':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case '1m':
      return { from: addMonthsYmd(today, -1), to: today };
    case '3m':
      return { from: addMonthsYmd(today, -3), to: today };
    case '12m':
      return { from: addMonthsYmd(today, -12), to: today };
    case 'lastMonth': {
      const firstThisMonth = `${today.slice(0, 8)}01`;
      const firstLast = addMonthsYmd(firstThisMonth, -1);
      const lastDay = new Date(vnDayStart(firstThisMonth).getTime() + VN_OFFSET_MS - DAY_MS)
        .toISOString()
        .slice(0, 10);
      return { from: firstLast, to: lastDay };
    }
  }
}

/** Số ngày của khoảng, tính cả hai đầu. */
export function rangeDays(range: DateRange): number {
  return Math.round((vnDayStart(range.to).getTime() - vnDayStart(range.from).getTime()) / DAY_MS) + 1;
}

/** "2026-10-01" → "01/10/2026" */
export function formatYmd(ymd: string): string {
  const p = parts(ymd);
  return p ? `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}` : ymd;
}
