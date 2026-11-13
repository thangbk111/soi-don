'use client';

import {
  type DateRange,
  formatVnd,
  formatVndCompact,
  formatYmd,
  lastDayOfMonth,
  presetRange,
  type RangePresetKey,
  rangeDays,
  UNCATEGORIZED,
  validateRange,
} from '@soi-don/shared';
import { io } from 'next/cache';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { UNCATEGORIZED_LABEL } from '@/components/category-select';
import { formatRange, RangePicker } from '@/components/range-picker';
import { api, ApiError, type CategoryAmount, type DashboardResponse, type Me } from '@/lib/api';

const PRESETS: RangePresetKey[] = ['thisMonth', 'lastMonth', '3m', '12m'];
const DEFAULT_PRESET: RangePresetKey = 'thisMonth';

const fmtPct = (n: number) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(n)}%`;
const signedVnd = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatVnd(Math.abs(n))}`;
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Danh sách đơn tương ứng ở trang Đơn hàng, giữ nguyên khoảng ngày. */
function ordersHref(range: DateRange, category?: string | null) {
  const q = new URLSearchParams({ from: range.from, to: range.to });
  if (category !== undefined) q.set('category', category ?? UNCATEGORIZED);
  return `/orders?${q}`;
}

const CARD = 'rounded-xl border border-stone-200 p-4 dark:border-stone-800';

// Trang đọc ngày hôm nay (khoảng ngày mặc định) → render sau `io()` trong Suspense (Next 16).
export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="p-8">Đang tải…</main>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  use(io());
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [range, setRangeState] = useState<DateRange>(() => {
    const r = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
    return validateRange(r) ? presetRange(DEFAULT_PRESET) : r;
  });
  const [reloadKey, setReloadKey] = useState(0);
  // Kết quả gắn với khoảng ngày đã yêu cầu → đổi khoảng thì tự về trạng thái đang tải.
  const requestKey = `${range.from}|${range.to}|${reloadKey}`;
  const [result, setResult] = useState<{
    key: string;
    data?: DashboardResponse;
    error?: string;
  } | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const current = result?.key === requestKey ? result : null;
  const data = current?.data ?? null;
  const error = meError ?? current?.error ?? null;

  // Giữ khoảng ngày trên URL để quay lại từ trang Đơn hàng không bị mất.
  function setRange(r: DateRange) {
    setRangeState(r);
    router.replace(`/dashboard?${new URLSearchParams({ from: r.from, to: r.to })}`, {
      scroll: false,
    });
  }

  useEffect(() => {
    api<Me>('/me')
      .then((m) => {
        if (m.gmail?.status !== 'ACTIVE') router.push('/onboarding');
        setMe(m);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) router.push('/');
        else setMeError((e as Error).message);
      });
  }, [router, reloadKey]);

  useEffect(() => {
    api<DashboardResponse>(`/dashboard?${new URLSearchParams({ from: range.from, to: range.to })}`)
      .then((d) => setResult({ key: requestKey, data: d }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) router.push('/');
        else setResult({ key: requestKey, error: (e as Error).message });
      });
  }, [range, requestKey, router]);

  const defaultRange = presetRange(DEFAULT_PRESET);
  const isDefault = range.from === defaultRange.from && range.to === defaultRange.to;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <AppHeader email={me?.email} />

      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Tổng quan</h1>
          <p className="text-sm text-stone-500">
            Báo cáo <span className="tabular-nums">{formatRange(range)}</span> · {rangeDays(range)}{' '}
            ngày · theo ngày đặt hàng
            {me?.gmail?.lastSyncedAt && (
              <> · Đồng bộ Gmail lần cuối {fmtDateTime(me.gmail.lastSyncedAt)}</>
            )}
          </p>
        </div>
        <RangePicker value={range} onChange={setRange} presetKeys={PRESETS} />
      </section>

      {error ? (
        <div className="space-y-3 rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">
          <p>Không tải được báo cáo: {error}</p>
          <button
            onClick={() => {
              setMeError(null);
              setReloadKey((k) => k + 1);
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      ) : !data ? (
        <Skeleton />
      ) : !data.hasAnyOrders ? (
        <EmptyState
          title="Chưa có dữ liệu"
          text="Soi Đơn chưa nhập được đơn Shopee nào từ Gmail của bạn. Quét Gmail để bắt đầu."
          action={
            <Link href="/orders" className={PRIMARY}>
              Đến trang quét Gmail
            </Link>
          }
        />
      ) : data.summary.orders === 0 ? (
        <EmptyState
          title="Không có đơn nào trong khoảng này"
          text={`Không có đơn được tính vào chi tiêu trong ${formatRange(range)}.`}
          action={
            isDefault ? (
              <button onClick={() => setRange(presetRange('12m'))} className={PRIMARY}>
                Xem 12 tháng gần nhất
              </button>
            ) : (
              <button onClick={() => setRange(defaultRange)} className={PRIMARY}>
                Đặt lại bộ lọc
              </button>
            )
          }
        />
      ) : (
        <Report data={data} />
      )}
    </main>
  );
}

const PRIMARY =
  'inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700';

function Report({ data }: { data: DashboardResponse }) {
  const { summary, range } = data;
  return (
    <>
      {!data.covered && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Một phần khoảng ngày này chưa được quét Gmail nên số liệu có thể thiếu.{' '}
          {data.scanned.length > 0 && (
            <>Đã quét: {data.scanned.map(formatRange).join(', ')}. </>
          )}
          <Link href="/orders" className="underline">
            Quét Gmail
          </Link>
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tổng thực trả"
          value={formatVnd(summary.net)}
          href={ordersHref(range)}
          tip="Tổng số tiền thực trả của các đơn trong khoảng, giống trang Đơn hàng. Không tính đơn đã hủy."
        />
        <StatCard
          label="Số đơn"
          value={new Intl.NumberFormat('vi-VN').format(summary.orders)}
          href={ordersHref(range)}
          tip="Số đơn đặt trong khoảng ngày (theo ngày đặt hàng), không tính đơn đã hủy."
        />
        <StatCard
          label="Trung bình mỗi đơn"
          value={summary.orders > 0 ? formatVnd(Math.round(summary.net / summary.orders)) : 'Không có dữ liệu'}
          href={ordersHref(range)}
          tip="Tổng thực trả chia cho số đơn, làm tròn đến đồng."
          tipAlign="right"
        />
        <ComparisonCard data={data} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TimeChart data={data} />
        <CategoryChart data={data} />
      </section>

      <SecondaryRow data={data} />

      <p className="text-sm">
        <Link href={ordersHref(range)} className="font-semibold text-orange-700 underline dark:text-orange-400">
          Xem tất cả đơn hàng trong khoảng này →
        </Link>
      </p>
      <p className="text-xs text-stone-500">
        Báo cáo dựa trên dữ liệu đã nhập từ email đơn hàng Shopee, có thể chưa phản ánh toàn bộ chi
        tiêu thực tế của bạn.
      </p>
    </>
  );
}

function InfoTip({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) {
  return (
    <span className="group relative z-10 inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-stone-300 text-[10px] leading-none text-stone-500 dark:border-stone-600"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full mt-1 hidden w-60 max-w-[70vw] rounded-md bg-stone-900 p-2 text-xs font-normal leading-snug text-white shadow-lg group-focus-within:block group-hover:block dark:bg-stone-700 ${
          align === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        {text}
      </span>
    </span>
  );
}

/** Thẻ bấm được: liên kết phủ cả thẻ, nút tooltip nằm trên liên kết. */
function StatCard({
  label,
  value,
  sub,
  href,
  tip,
  tipAlign,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  href: string;
  tip: string;
  tipAlign?: 'left' | 'right';
}) {
  return (
    <div className={`${CARD} relative hover:border-orange-400 dark:hover:border-orange-700`}>
      <div className="flex items-center gap-1.5 text-sm text-stone-500">
        {label}
        <InfoTip text={tip} align={tipAlign} />
      </div>
      <Link
        href={href}
        className="mt-1 block text-lg font-bold tabular-nums after:absolute after:inset-0 after:content-[''] sm:text-2xl"
      >
        {value}
      </Link>
      {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

function ComparisonCard({ data }: { data: DashboardResponse }) {
  const prev = data.previous;
  const diff = data.summary.net - prev.summary.net;
  const tip =
    prev.kind === 'months'
      ? 'So với kỳ liền trước có cùng số tháng. Dựa trên dữ liệu đã nhập.'
      : prev.kind === 'partial'
        ? 'Kỳ hiện tại chưa kết thúc: so với cùng số ngày đầu kỳ trước (không vượt quá cuối kỳ trước). Dựa trên dữ liệu đã nhập.'
        : 'So với khoảng liền trước có cùng số ngày. Dựa trên dữ liệu đã nhập.';
  const prevLine = (
    <>
      Kỳ trước <span className="tabular-nums">{formatRange(prev.range)}</span>:{' '}
      <span className="tabular-nums">{formatVnd(prev.summary.net)}</span> · {prev.summary.orders} đơn
    </>
  );

  if (!prev.covered)
    return (
      <StatCard
        label="So với kỳ trước"
        value="Chưa đủ dữ liệu để so sánh"
        href={ordersHref(prev.range)}
        tip={`${tip} Kỳ trước chưa được quét Gmail đầy đủ.`}
        tipAlign="right"
        sub={prevLine}
      />
    );

  return (
    <StatCard
      label="So với kỳ trước"
      value={signedVnd(diff)}
      href={ordersHref(prev.range)}
      tip={tip}
      tipAlign="right"
      sub={
        <>
          <span className="block">
            {prev.summary.net > 0
              ? `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmtPct((Math.abs(diff) / prev.summary.net) * 100)} so với kỳ trước`
              : 'Không có giá trị kỳ trước để tính tỷ lệ'}
          </span>
          {prevLine}
        </>
      }
    />
  );
}

/* ───────── Biểu đồ theo thời gian ───────── */

/** Mốc trục tròn: 1, 2, 2.5, 5 × 10^k, tối thiểu để chứa max. */
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

function periodLabel(b: DashboardResponse['timeline'][number], granularity: 'day' | 'month') {
  if (granularity === 'day') return formatYmd(b.key);
  const [y, m] = b.key.split('-');
  const label = `Tháng ${Number(m)}/${y}`;
  // Tháng đầu/cuối bị cắt theo khoảng báo cáo → ghi rõ phần ngày.
  const full = b.range.from === `${b.key}-01` && b.range.to === lastDayOfMonth(b.range.from);
  return full ? label : `${label} (${formatRange(b.range)})`;
}

function axisLabel(key: string, granularity: 'day' | 'month') {
  return granularity === 'day' ? `${key.slice(8)}/${key.slice(5, 7)}` : `T${Number(key.slice(5))}/${key.slice(2, 4)}`;
}

function TimeChart({ data }: { data: DashboardResponse }) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const { timeline, granularity } = data;
  const top = niceMax(Math.max(...timeline.map((b) => b.net)));
  const n = timeline.length;
  const labelEvery = Math.ceil(n / 6);
  const h = hover !== null ? timeline[hover] : null;

  return (
    <div className={CARD}>
      <h2 className="font-semibold">Chi tiêu theo {granularity === 'day' ? 'ngày' : 'tháng'}</h2>
      <p className="text-xs text-stone-500">Tổng thực trả theo ngày đặt hàng. Bấm một cột để xem đơn.</p>

      <div className="mt-4 flex gap-2">
        {/* Trục Y */}
        <div className="relative h-48 w-12 shrink-0 text-right text-[11px] tabular-nums text-stone-500">
          {[1, 0.5, 0].map((f) => (
            <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
              {f === 0 ? '0' : formatVndCompact(top * f).replace('đ', '')}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* Lưới */}
          {[0, 0.5, 1].map((f) => (
            <div
              key={f}
              className="absolute inset-x-0 border-t border-stone-200 dark:border-stone-800"
              style={{ top: `${f * 192}px` }}
            />
          ))}
          <div className="relative flex h-48 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {timeline.map((b, i) => (
              <button
                key={b.key}
                type="button"
                aria-label={`${periodLabel(b, granularity)}: ${formatVnd(b.net)}, ${b.orders} đơn`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => router.push(ordersHref(b.range))}
                className="flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
              >
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] ${
                    hover === i ? 'bg-orange-700 dark:bg-orange-400' : 'bg-orange-500'
                  }`}
                  style={{ height: `${(b.net / top) * 100}%` }}
                />
              </button>
            ))}
          </div>
          {h && hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-20 w-max max-w-56 rounded-md bg-stone-900 px-2 py-1.5 text-xs text-white shadow-lg dark:bg-stone-700"
              style={
                hover / n < 0.5
                  ? { left: `${((hover + 0.5) / n) * 100}%` }
                  : { right: `${((n - hover - 0.5) / n) * 100}%` }
              }
            >
              <div className="font-semibold">{periodLabel(h, granularity)}</div>
              <div className="tabular-nums">{formatVnd(h.net)}</div>
              <div>{h.orders} đơn</div>
            </div>
          )}
          {/* Trục X */}
          <div className="relative mt-1 h-4 text-[11px] tabular-nums text-stone-500">
            {timeline.map((b, i) =>
              i % labelEvery === 0 ? (
                <span
                  key={b.key}
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${((i + 0.5) / n) * 100}%` }}
                >
                  {axisLabel(b.key, granularity)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-stone-500">Xem dạng bảng</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-xs text-stone-500">
            <tr>
              <th className="py-1 font-normal">Kỳ</th>
              <th className="py-1 text-right font-normal">Tổng thực trả</th>
              <th className="py-1 text-right font-normal">Số đơn</th>
            </tr>
          </thead>
          <tbody>
            {timeline
              .filter((b) => b.orders > 0)
              .map((b) => (
                <tr key={b.key} className="border-t border-stone-100 dark:border-stone-900">
                  <td className="py-1">
                    <Link href={ordersHref(b.range)} className="underline">
                      {periodLabel(b, granularity)}
                    </Link>
                  </td>
                  <td className="py-1 text-right">{formatVnd(b.net)}</td>
                  <td className="py-1 text-right">{b.orders}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-stone-500">Các kỳ không có đơn được bỏ qua trong bảng.</p>
      </details>
    </div>
  );
}

/* ───────── Biểu đồ danh mục ───────── */

const TIP_UNCATEGORIZED =
  'Sản phẩm chưa xác định được danh mục. Bấm để xem và gán danh mục ở trang Đơn hàng.';
const TIP_UNALLOCATED =
  'Tiền đã trả nhưng không gán được cho sản phẩm cụ thể (thường do email thiếu giá một số sản phẩm). Khác với “Chưa phân loại”: đây không phải sản phẩm, mà là phần tiền chưa chia được.';

function CategoryChart({ data }: { data: DashboardResponse }) {
  const c = data.categories;
  const max = Math.max(1, c.unallocated, ...c.groups.map((g) => g.amount));
  const pct = (amount: number) => (c.allocatedBase > 0 ? fmtPct((amount / c.allocatedBase) * 100) : null);

  return (
    <div className={CARD}>
      <h2 className="font-semibold">Chi tiêu theo danh mục</h2>
      <p className="text-xs text-stone-500">
        Tiền hàng sau giảm giá, chia theo sản phẩm. Không gồm phí vận chuyển. Bấm danh mục để xem đơn.
      </p>

      <ul className="mt-4 space-y-3">
        {c.groups.map((g) => (
          <CategoryRow
            key={g.id ?? UNCATEGORIZED}
            row={g}
            max={max}
            pct={pct(g.amount)}
            range={data.range}
            muted={g.id === null}
            tip={g.id === null ? TIP_UNCATEGORIZED : undefined}
          >
            {g.children.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-stone-500">
                  {g.children.length} danh mục con
                </summary>
                <ul className="mt-2 space-y-2 border-l border-stone-200 pl-3 dark:border-stone-800">
                  {g.children.map((ch) => (
                    <CategoryRow key={ch.id} row={ch} max={max} pct={pct(ch.amount)} range={data.range} small />
                  ))}
                </ul>
              </details>
            )}
          </CategoryRow>
        ))}
        {c.unallocated > 0 && (
          <li>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                Chưa phân bổ <InfoTip text={TIP_UNALLOCATED} />
              </span>
              <span className="shrink-0 tabular-nums">
                {formatVnd(c.unallocated)}
                {pct(c.unallocated) && <span className="text-stone-500"> · {pct(c.unallocated)}</span>}
              </span>
            </div>
            <Bar value={c.unallocated} max={max} variant="hatched" />
          </li>
        )}
      </ul>

      <div className="mt-4 space-y-1 border-t border-stone-200 pt-3 text-xs text-stone-500 dark:border-stone-800">
        <p>
          Tỷ trọng tính trên <span className="tabular-nums">{formatVnd(c.allocatedBase)}</span> tiền hàng
          sau giảm (gồm cả Chưa phân bổ), không phải trên Tổng thực trả.
        </p>
        <p className="tabular-nums">
          {formatVnd(c.allocatedBase)} + phí vận chuyển {formatVnd(c.shipping)}
          {c.adjustment !== 0 && <> − điều chỉnh cấp đơn {formatVnd(-c.adjustment)}</>} ={' '}
          {formatVnd(c.allocatedBase + c.shipping + c.adjustment)} Tổng thực trả.
        </p>
        <p>“Dòng” là số dòng sản phẩm trong đơn, không phải số lượng sản phẩm đã mua.</p>
        {c.linesWithoutValue > 0 && (
          <p>
            {c.linesWithoutValue} dòng sản phẩm không có giá trị tiền (email thiếu giá) được đếm vào số dòng
            nhưng không cộng tiền.
          </p>
        )}
      </div>
    </div>
  );
}

function Bar({ value, max, variant }: { value: number; max: number; variant: 'accent' | 'muted' | 'hatched' }) {
  const fill =
    variant === 'accent'
      ? 'bg-orange-500 group-hover:bg-orange-700 dark:group-hover:bg-orange-400'
      : variant === 'muted'
        ? 'bg-stone-400 group-hover:bg-stone-500 dark:bg-stone-500 dark:group-hover:bg-stone-400'
        : 'bg-[repeating-linear-gradient(135deg,var(--color-stone-400)_0_4px,transparent_4px_7px)]';
  return (
    <div className="mt-1 h-3 w-full">
      <div
        className={`h-full rounded-r-[4px] ${fill}`}
        style={{ width: `${value > 0 ? Math.max(0.5, (value / max) * 100) : 0}%` }}
      />
    </div>
  );
}

function CategoryRow({
  row,
  max,
  pct,
  range,
  muted,
  tip,
  small,
  children,
}: {
  row: CategoryAmount;
  max: number;
  pct: string | null;
  range: DateRange;
  muted?: boolean;
  tip?: string;
  small?: boolean;
  children?: React.ReactNode;
}) {
  const name = row.id === null ? UNCATEGORIZED_LABEL : row.name;
  return (
    <li>
      <div className="group relative">
        <div className={`flex items-baseline justify-between gap-2 ${small ? 'text-xs' : 'text-sm'}`}>
          <span className="flex min-w-0 items-center gap-1.5">
            <Link
              href={ordersHref(range, row.id)}
              className="truncate after:absolute after:inset-0 after:content-[''] group-hover:underline"
            >
              {name}
            </Link>
            {tip && <InfoTip text={tip} />}
          </span>
          <span className="shrink-0 tabular-nums">
            {formatVnd(row.amount)}
            {pct && <span className="text-stone-500"> · {pct}</span>}
          </span>
        </div>
        <Bar value={row.amount} max={max} variant={muted ? 'muted' : 'accent'} />
        <div className="mt-0.5 text-xs text-stone-500">
          {row.lines} dòng sản phẩm
          {row.linesWithoutValue > 0 && ` · ${row.linesWithoutValue} dòng không có giá trị tiền`}
        </div>
      </div>
      {children}
    </li>
  );
}

/* ───────── Hàng phụ ───────── */

function SecondaryRow({ data }: { data: DashboardResponse }) {
  const s = data.summary;
  const items: { label: string; value: number; tip: string }[] = [
    { label: 'Tiền hàng', value: s.gross, tip: 'Tổng giá sản phẩm trước giảm giá, theo email đơn hàng.' },
    {
      label: 'Giảm giá ghi nhận',
      value: s.discount,
      tip: 'Voucher, Xu và các khoản giảm khác: Tiền hàng + Phí vận chuyển − Tổng thực trả. Chỉ là số ghi nhận, không cho biết bạn đã tiết kiệm được bao nhiêu.',
    },
    { label: 'Phí vận chuyển', value: s.shipping, tip: 'Phí ship ghi trên email, hiển thị riêng, không chia vào danh mục.' },
    {
      label: 'Hoàn tiền ghi nhận',
      value: s.refund,
      tip: 'Hoàn tiền cấp đơn đã nhập. Hiển thị riêng, không trừ vào Tổng thực trả hay danh mục nào (giống trang Đơn hàng).',
    },
  ];
  return (
    <section className={CARD}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.label}>
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              {it.label}
              <InfoTip text={it.tip} align={i % 2 === 1 ? 'right' : 'left'} />
            </div>
            <div className="font-semibold tabular-nums">{formatVnd(it.value)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Tổng thực trả = Tiền hàng − Giảm giá ghi nhận + Phí vận chuyển.
      </p>
    </section>
  );
}

/* ───────── Trạng thái ───────── */

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải báo cáo" className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-stone-100 dark:bg-stone-900" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-stone-100 dark:bg-stone-900" />
        <div className="h-72 rounded-xl bg-stone-100 dark:bg-stone-900" />
      </div>
    </div>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-stone-600 dark:text-stone-400">{text}</p>
      <div className="flex justify-center">{action}</div>
    </div>
  );
}
