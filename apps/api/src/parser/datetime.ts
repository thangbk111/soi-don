/** Giờ trong email Shopee là giờ Việt Nam (UTC+7). */
const VN_OFFSET_HOURS = 7;

function vnDate(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return undefined;
  return new Date(Date.UTC(y, mo - 1, d, h - VN_OFFSET_HOURS, mi, s));
}

/**
 * Hỗ trợ:
 *  - "20/10/2026 09:24:02", "20/10/2026", "20-10-2026 09:24"
 *  - "10 Th10 2026 10:57:07", "10 Th 10 2026 10:57:12"
 */
export function parseViDateTime(input: string): Date | undefined {
  const s = input.trim();
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  const [h, mi, sec] = time ? [Number(time[1]), Number(time[2]), Number(time[3] ?? 0)] : [0, 0, 0];

  const numeric = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (numeric)
    return vnDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]), h, mi, sec);

  const thang = /(\d{1,2})\s+Th\s?(\d{1,2})\s+(\d{4})/i.exec(s);
  if (thang) return vnDate(Number(thang[3]), Number(thang[2]), Number(thang[1]), h, mi, sec);

  return undefined;
}
