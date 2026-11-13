'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Lỗi render không bắt được ở trang nào → báo Sentry và hiện màn hình thay thế toàn bộ layout.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Có lỗi xảy ra</h1>
        <p style={{ marginTop: 8 }}>Soi Đơn đã ghi nhận lỗi này. Bạn thử tải lại trang nhé.</p>
        <button onClick={reset} style={{ marginTop: 16, textDecoration: 'underline' }}>
          Thử lại
        </button>
      </body>
    </html>
  );
}
