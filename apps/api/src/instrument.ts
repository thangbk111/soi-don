// Phải được import trước mọi module khác (Sentry cần instrument trước khi Nest/HTTP được nạp).
import * as Sentry from '@sentry/nestjs';
import { scrubSentryEvent } from '@soi-don/shared';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Chỉ bắt lỗi, không tracing: span có thể mang tham số truy vấn.
    tracesSampleRate: 0,
    // SDK v11 mặc định thu body, header, dữ liệu truy vấn DB và biến cục bộ → tắt hết.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
    },
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (b) => (b.category === 'console' ? null : b),
  });
}
