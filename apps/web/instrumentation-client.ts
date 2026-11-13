// Next nạp file này trên trình duyệt trước khi app chạy.
import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@soi-don/shared';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Chỉ bắt lỗi: không tracing, không session replay (replay ghi lại màn hình có đơn hàng).
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (b) =>
      // Breadcrumb console/ui.click có thể chứa text trên màn hình (tên sản phẩm, số tiền).
      b.category === 'console' || b.category?.startsWith('ui.') ? null : b,
  });
}
