/**
 * Che dữ liệu nhạy cảm trong chuỗi trước khi gửi ra ngoài (Sentry). Lớp cuối cùng: cấu hình
 * SDK đã tắt body/header/cookie/biến cục bộ, hàm này lo phần còn lọt vào message lỗi.
 *
 * - Lỗi Prisma in nguyên tham số truy vấn (có thể có tên sản phẩm, số tiền) sau dòng
 *   "Invalid `prisma.x.y()` invocation" → cắt bỏ.
 * - Chuỗi trong ngoặc kép/đơn → nội dung thường là dữ liệu người dùng. Backtick giữ lại:
 *   Prisma dùng nó cho tên model/trường, có ích khi đọc lỗi.
 * - Email, chuỗi dài giống token/khóa, số có từ 4 chữ số trở lên (tiền, mã đơn, số điện thoại).
 */
export function redactPii(text: string): string {
  const invocation = text.search(/invocation(?: in)?[^\n]*\n/);
  let out =
    invocation >= 0 ? `${text.slice(0, text.indexOf('\n', invocation))}\n[đã ẩn tham số]` : text;
  out = out
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/"[^"\n]*"|'[^'\n]*'|“[^”\n]*”/g, '"…"')
    .replace(/[A-Za-z0-9_\-+/=.]{32,}/g, '[secret]')
    .replace(/\d[\d.,\s]{2,}\d/g, (m) => (m.replace(/\D/g, '').length >= 4 ? '[số]' : m))
    .replace(/\d{4,}/g, '[số]');
  return out;
}

/** Bỏ query string và fragment khỏi URL (có thể chứa mã OAuth, khoảng ngày, bộ lọc). */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

/** Phần của event Sentry có thể mang dữ liệu người dùng (khai báo cấu trúc để shared không phụ thuộc SDK). */
export interface ScrubbableEvent {
  message?: string;
  request?: {
    url?: string;
    headers?: unknown;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
    env?: unknown;
  };
  user?: unknown;
  extra?: unknown;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: { message?: string; data?: unknown }[];
}

/**
 * `beforeSend` cho mọi app: request chỉ còn method + đường dẫn, bỏ user/extra, che mọi message.
 * Dùng cùng `dataCollection` tắt hết ở SDK; đây là lớp cuối nếu SDK vẫn gắn thêm gì.
 */
export function scrubSentryEvent<E extends ScrubbableEvent>(event: E): E {
  const r = event.request;
  if (r) {
    delete r.headers;
    delete r.cookies;
    delete r.data;
    delete r.query_string;
    delete r.env;
    if (r.url) r.url = stripQuery(r.url);
  }
  delete event.user;
  delete event.extra;
  if (event.message) event.message = redactPii(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redactPii(ex.value);
  }
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = redactPii(b.message);
    delete b.data;
  }
  return event;
}
