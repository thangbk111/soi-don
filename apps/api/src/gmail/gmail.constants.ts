import { SHOPEE_ORDER_SUBJECT_QUERY } from '@soi-don/shared';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const CONSENT_VERSION = '2026-11-12';

export interface EmailWindow {
  after: Date;
  before?: Date;
}

/** Dùng epoch giây: `after:YYYY/MM/DD` của Gmail hiểu theo múi giờ PST, lệch so với giờ VN. */
export function shopeeQuery({ after, before }: EmailWindow): string {
  const secs = (d: Date) => Math.floor(d.getTime() / 1000);
  const range = `after:${secs(after)}${before ? ` before:${secs(before)}` : ''}`;
  return `from:(shopee.vn OR shopee.com) ${SHOPEE_ORDER_SUBJECT_QUERY} ${range} -in:spam -in:trash`;
}

export function isShopeeSender(from: string): boolean {
  return /@([a-z0-9-]+\.)*shopee\.(vn|com)>?\s*$/i.test(from.trim());
}

/** Gom subject cùng template: thay mọi token có chữ số (mã đơn, ngày, số tiền) bằng "#". */
export function subjectTemplate(subject: string): string {
  return subject
    .replace(/\S*\d\S*/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}
