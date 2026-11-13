import Link from 'next/link';
import { API_URL } from '@/lib/api';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Soi Đơn</p>
        <h1 className="text-4xl font-bold leading-tight">
          12 tháng qua bạn đã chi bao nhiêu trên Shopee?
        </h1>
        <p className="text-lg text-stone-600 dark:text-stone-400">
          Kết nối Gmail, Soi Đơn đọc <strong>chỉ email đơn hàng Shopee</strong> và cho bạn biết bạn
          đã chi bao nhiêu, cho gì, và nên cắt ở đâu.
        </p>
      </div>
      <a
        href={`${API_URL}/auth/google`}
        className="inline-flex w-fit items-center rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700"
      >
        Đăng nhập với Google
      </a>
      <p className="text-sm text-stone-500">
        Bước này chỉ lấy email và tên của bạn. Quyền đọc Gmail sẽ được hỏi riêng ở bước sau. Khi
        đăng nhập, bạn đồng ý với{' '}
        <Link href="/terms" className="underline">
          Điều khoản sử dụng
        </Link>{' '}
        và{' '}
        <Link href="/privacy" className="underline">
          Chính sách quyền riêng tư
        </Link>
        .
      </p>
    </main>
  );
}
