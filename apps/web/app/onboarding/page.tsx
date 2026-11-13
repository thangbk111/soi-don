'use client';

import { useRouter } from 'next/navigation';
import { io } from 'next/cache';
import { Suspense, use, useCallback, useEffect, useState } from 'react';
import {
  type DateRange,
  ORDER_EMAIL_KIND_LABEL,
  type OrderEmailKind,
  presetRange,
} from '@soi-don/shared';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { formatRange, RangePicker } from '@/components/range-picker';
import { api, API_URL, ApiError, type Me, type SpikeResult, type SpikeState } from '@/lib/api';

const ERRORS: Record<string, string> = {
  access_denied: 'Bạn đã từ chối cấp quyền. Soi Đơn cần quyền đọc Gmail để hoạt động.',
};

function errorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const err = new URLSearchParams(window.location.search).get('error');
  return err ? (ERRORS[err] ?? err) : null;
}

// Trang đọc ngày hôm nay (khoảng ngày mặc định) → render sau `io()` trong Suspense (Next 16).
export default function Onboarding() {
  return (
    <Suspense fallback={<main className="p-8">Đang tải…</main>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  use(io());
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  // Lỗi chỉ hiển thị sau khi tải xong nên không lệch hydration.
  const [error, setError] = useState<string | null>(errorFromUrl);
  const [spike, setSpike] = useState<SpikeState | null>(null);
  const [spikeRange, setSpikeRange] = useState<DateRange>(() => presetRange('1m'));

  /** Tải lại trạng thái kết nối sau một thao tác (ngắt kết nối, token hết hạn). */
  const load = useCallback(async () => {
    try {
      setMe(await api<Me>('/me'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    api<Me>('/me')
      .then(setMe)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) router.push('/');
        else setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Poll tiến độ khi job đang chạy.
  useEffect(() => {
    if (spike?.status !== 'RUNNING') return;
    const t = setTimeout(async () => {
      try {
        const next = await api<SpikeState | null>('/gmail/spike');
        setSpike(next);
        if (next?.status === 'FAILED') {
          setError(next.error ?? 'Quét thất bại');
          if (next.revoked) await load();
        }
      } catch (e) {
        setError((e as Error).message);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [spike, load]);

  async function runSpike() {
    setError(null);
    try {
      setSpike(
        await api<SpikeState>('/gmail/spike', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spikeRange),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function disconnect() {
    await api('/gmail/disconnect', { method: 'POST' });
    setSpike(null);
    await load();
  }

  if (loading) return <main className="p-8">Đang tải…</main>;
  if (!me) return <main className="p-8 text-red-600">{error}</main>;

  const connected = me.gmail?.status === 'ACTIVE';

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12">
      <AppHeader email={me.email} />

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!connected ? (
        <section className="space-y-6">
          <h1 className="text-2xl font-bold">
            {me.gmail?.status === 'REVOKED' ? 'Kết nối lại Gmail' : 'Kết nối Gmail'}
          </h1>
          <ul className="space-y-3 text-stone-700 dark:text-stone-300">
            <li>
              <strong>Mục đích:</strong> tính tổng chi tiêu Shopee của bạn.
            </li>
            <li>
              <strong>Dữ liệu được đọc:</strong> chỉ email từ Shopee (shopee.vn, shopee.com). Soi
              Đơn không đọc email khác.
            </li>
            <li>
              <strong>Dữ liệu được lưu:</strong> mã đơn, ngày, shop, tên sản phẩm, số tiền. Không
              lưu toàn văn email.
            </li>
            <li>
              <strong>Quyền:</strong> chỉ đọc (gmail.readonly). Soi Đơn không gửi, sửa hay xóa
              email.
            </li>
            <li>
              <strong>Quyền của bạn:</strong> xem, sửa và ngắt kết nối bất cứ lúc nào, và yêu cầu
              xóa toàn bộ dữ liệu qua email. Soi Đơn không bán dữ liệu.
            </li>
          </ul>
          <p className="text-sm text-stone-500">
            Chi tiết trong{' '}
            <Link href="/privacy" className="underline">
              Chính sách quyền riêng tư
            </Link>{' '}
            và{' '}
            <Link href="/terms" className="underline">
              Điều khoản sử dụng
            </Link>
            .
          </p>
          <a
            href={`${API_URL}/gmail/connect`}
            className="inline-flex rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700"
          >
            Tôi đồng ý, kết nối Gmail
          </a>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Đã kết nối Gmail ✓</h1>
            <button onClick={disconnect} className="text-sm text-red-600 underline">
              Ngắt kết nối
            </button>
          </div>
          <Link
            href="/orders"
            className="inline-flex rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700"
          >
            Xem đơn hàng →
          </Link>
          <div className="space-y-3 rounded-xl border border-stone-200 p-5 dark:border-stone-800">
            <h2 className="font-semibold">Kiểm tra dữ liệu (Phase 0)</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Đếm email đơn hàng Shopee và gom theo loại. Chỉ đọc tiêu đề, không đọc nội dung, không
              lưu gì.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <RangePicker
                align="left"
                value={spikeRange}
                onChange={setSpikeRange}
                disabled={spike?.status === 'RUNNING'}
              />
              <button
                onClick={runSpike}
                disabled={spike?.status === 'RUNNING'}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
              >
                {spike?.status === 'RUNNING' ? 'Đang quét…' : 'Quét thử'}
              </button>
            </div>
          </div>
          {spike?.status === 'RUNNING' && <SpikeProgress state={spike} />}
          {spike?.result && <SpikeTable data={spike.result} />}
        </section>
      )}
    </main>
  );
}

function SpikeProgress({ state }: { state: SpikeState }) {
  const pct = state.listed ? Math.round((state.processed / state.listed) * 100) : 0;
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        {state.phase === 'listing'
          ? 'Đang tìm email Shopee…'
          : `Đã đọc tiêu đề ${state.processed}/${state.listed} email`}
        {state.waitingMs > 0 &&
          ` · Gmail giới hạn tốc độ, đang chờ ${Math.ceil(state.waitingMs / 1000)}s…`}
      </p>
      <div className="h-2 overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
        <div className="h-full bg-orange-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SpikeTable({ data }: { data: SpikeResult }) {
  const fmt = (s: string) => new Date(s).toLocaleDateString('vi-VN');
  const orderEmails = data.shopeeSender - data.ignored;
  // Gom các biến thể tiêu đề theo loại email; giữ thứ tự loại xuất hiện nhiều nhất trước.
  const byKind = new Map<OrderEmailKind, SpikeResult['templates']>();
  for (const t of data.templates) byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t]);
  const groups = [...byKind.entries()]
    .map(([kind, rows]) => ({
      kind,
      rows,
      count: rows.reduce((n, r) => n + r.count, 0),
      firstAt: rows.map((r) => r.firstAt).sort()[0],
      lastAt:
        rows
          .map((r) => r.lastAt)
          .sort()
          .at(-1) ?? rows[0].lastAt,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-3">
      <p>
        Tìm thấy <strong>{orderEmails}</strong> email đơn hàng Shopee nhận trong khoảng{' '}
        {formatRange(data.range)}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-stone-500">
            <tr>
              <th className="py-2 pr-3">Loại email</th>
              <th className="py-2 pr-3 text-right">Số email</th>
              <th className="py-2">Khoảng thời gian</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.kind}
                className="border-t border-stone-200 align-top dark:border-stone-800"
              >
                <td className="py-2 pr-3">
                  <div className="font-medium">{ORDER_EMAIL_KIND_LABEL[g.kind]}</div>
                  {g.rows.map((r) => (
                    <div key={r.subject} className="text-xs text-stone-500">
                      {r.subject}
                    </div>
                  ))}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{g.count}</td>
                <td className="whitespace-nowrap py-2 text-stone-500">
                  {fmt(g.firstAt)} – {fmt(g.lastAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.ignored > 0 && (
        <p className="text-sm text-stone-500">
          Đã bỏ qua {data.ignored} email Shopee không phải đơn hàng (quảng cáo, khảo sát, cảnh báo
          đăng nhập).
        </p>
      )}
    </div>
  );
}
