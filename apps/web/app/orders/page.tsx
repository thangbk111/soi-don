'use client';

import {
  type DateRange,
  formatVnd,
  presetRange,
  UNCATEGORIZED,
  validateRange,
} from '@soi-don/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { io } from 'next/cache';
import { Suspense, use, useEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import {
  CategoryFilter,
  categoryLabel,
  CategorySelect,
  SOURCE_LABEL,
} from '@/components/category-select';
import { formatRange, RangePicker } from '@/components/range-picker';
import {
  api,
  API_URL,
  ApiError,
  type Category,
  type Me,
  type ScanJob,
  type SetCategoryResult,
  type TransactionsResponse,
  type Tx,
  type TxItem,
} from '@/lib/api';

const STATUS_LABEL: Record<Tx['status'], string> = {
  PENDING: 'Đã thanh toán, chưa giao',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
  PARTIALLY_REFUNDED: 'Hoàn một phần',
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Trang đọc ngày hôm nay (khoảng ngày mặc định) → render sau `io()` trong Suspense (Next 16).
export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="p-8">Đang tải…</main>}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  use(io());
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  // Trang chỉ hiển thị sau khi tải /me ở client, nên ngày "hôm nay" lúc prerender không lộ ra.
  // ?from&to&category: mở từ trang Tổng quan.
  const [range, setRange] = useState<DateRange>(() => {
    const r = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
    return validateRange(r) ? presetRange('1m') : r;
  });
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [scan, setScan] = useState<ScanJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tăng lên để tải lại danh sách đơn (sau khi quét xong).
  const [reloadKey, setReloadKey] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(() => params.get('category'));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Sau khi đổi danh mục một dòng: hỏi có ghi nhớ cho các lần nhập sau không.
  const [lastEdit, setLastEdit] = useState<{
    item: TxItem;
    categoryId: string;
    remembered?: SetCategoryResult;
  } | null>(null);

  useEffect(() => {
    Promise.all([api<Me>('/me'), api<ScanJob | null>('/scans/latest')])
      .then(([m, s]) => {
        if (m.gmail?.status !== 'ACTIVE') router.push('/onboarding');
        setMe(m);
        setScan(s);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) router.push('/');
        else setError((e as Error).message);
      });
  }, [router]);

  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch((e: unknown) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ from: range.from, to: range.to });
    if (categoryFilter) q.set('category', categoryFilter);
    api<TransactionsResponse>(`/transactions?${q}`)
      .then(setData)
      .catch((e: unknown) => setError((e as Error).message));
  }, [range, categoryFilter, reloadKey]);

  async function setCategory(itemIds: string[], categoryId: string, remember: boolean) {
    setError(null);
    setSaving(true);
    try {
      const res = await api<SetCategoryResult>('/items/category', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, categoryId, remember }),
      });
      setReloadKey((k) => k + 1);
      return res;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function editOne(item: TxItem, categoryId: string) {
    if (await setCategory([item.id], categoryId, false)) setLastEdit({ item, categoryId });
  }

  async function rememberLastEdit() {
    if (!lastEdit) return;
    const res = await setCategory([lastEdit.item.id], lastEdit.categoryId, true);
    if (res) setLastEdit({ ...lastEdit, remembered: res });
  }

  function toggle(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  // Hỏi tiến độ mỗi 2s khi đang quét; tải lại đơn mỗi lần có thêm tiến độ.
  const running = scan?.status === 'RUNNING' || scan?.status === 'QUEUED';
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      api<ScanJob | null>('/scans/latest')
        .then((s) => {
          setScan(s);
          if (s && s.processed !== scan?.processed) setReloadKey((k) => k + 1);
        })
        .catch((e: unknown) => setError((e as Error).message));
    }, 2000);
    return () => clearTimeout(t);
  }, [running, scan]);

  async function startScan() {
    setError(null);
    try {
      setScan(
        await api<ScanJob>('/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(range),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!me) {
    return (
      <main className="p-8">
        {error ? <span className="text-red-600">{error}</span> : 'Đang tải…'}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <AppHeader email={me?.email} />

      <section className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">Đơn hàng Shopee</h1>
        <div className="flex flex-wrap items-start gap-3">
          <RangePicker value={range} onChange={setRange} disabled={running} />
          <button
            onClick={startScan}
            disabled={running}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {running ? 'Đang quét…' : 'Quét Gmail'}
          </button>
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {scan && <ScanStatus scan={scan} />}
      {data && <Summary data={data} categoryName={categoryFilter ? categoryLabel(categories, categoryFilter === UNCATEGORIZED ? null : categoryFilter) : null} />}

      <section className="flex flex-wrap items-center gap-3 text-sm">
        <CategoryFilter
          categories={categories}
          value={categoryFilter}
          onChange={(v) => {
            setCategoryFilter(v);
            setSelected(new Set());
          }}
        />
        <Link href="/settings/categories" className="text-stone-500 underline">
          Quy tắc danh mục đã ghi nhớ
        </Link>
      </section>

      {lastEdit && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-stone-100 p-3 text-sm dark:bg-stone-900">
          <span>
            Đã chuyển “<span className="font-medium">{lastEdit.item.productName}</span>” sang{' '}
            {categoryLabel(categories, lastEdit.categoryId)}.
          </span>
          {lastEdit.remembered ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              Đã ghi nhớ cho những lần nhập sau
              {lastEdit.remembered.appliedToOthers > 0 &&
                ` và áp dụng cho ${lastEdit.remembered.appliedToOthers} dòng cùng tên chưa chỉnh tay`}
              .
            </span>
          ) : (
            <button onClick={rememberLastEdit} disabled={saving} className="font-semibold underline">
              Áp dụng cho sản phẩm này trong những lần nhập sau
            </button>
          )}
          <button onClick={() => setLastEdit(null)} className="ml-auto text-stone-500" aria-label="Đóng">
            ✕
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          categories={categories}
          saving={saving}
          onClear={() => setSelected(new Set())}
          onApply={async (categoryId, remember) => {
            if (await setCategory([...selected], categoryId, remember)) setSelected(new Set());
          }}
        />
      )}

      {data && (
        <OrdersTable
          txs={data.transactions}
          categories={categories}
          filtered={!!categoryFilter}
          selected={selected}
          saving={saving}
          onToggle={toggle}
          onEdit={editOne}
          onResetFilter={categoryFilter ? () => setCategoryFilter(null) : undefined}
        />
      )}
    </main>
  );
}

function ScanStatus({ scan }: { scan: ScanJob }) {
  const pct = scan.totalMessages ? Math.round((scan.processed / scan.totalMessages) * 100) : 0;
  // rangeTo là mốc loại trừ (00:00 ngày sau ngày cuối) → lùi 1ms để ra ngày cuối.
  const vnDay = (d: Date) => d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const span = `${vnDay(new Date(scan.rangeFrom))} – ${vnDay(new Date(new Date(scan.rangeTo).getTime() - 1))}`;

  if (scan.status === 'FAILED') {
    return (
      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {scan.error === 'GMAIL_REVOKED' ? (
          <>
            Quyền Gmail đã hết hạn.{' '}
            <a href={`${API_URL}/gmail/connect`} className="font-semibold underline">
              Kết nối lại
            </a>
          </>
        ) : (
          (scan.error ?? 'Quét thất bại')
        )}
      </div>
    );
  }
  if (scan.status === 'DONE') {
    return (
      <p className="text-sm text-stone-500">
        Lần quét gần nhất (đơn đặt {span}): {scan.totalMessages} email, đọc được {scan.parsedOk}
        {scan.failed > 0 && (
          <>
            , <span className="text-amber-600">{scan.failed} email không đọc được</span>
          </>
        )}
        .
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        {scan.totalMessages === 0
          ? `Đang tìm email đơn hàng (${span})…`
          : `Đang đọc ${scan.processed}/${scan.totalMessages} email…`}
      </p>
      <div className="h-2 overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
        <div className="h-full bg-orange-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Summary({ data, categoryName }: { data: TransactionsResponse; categoryName: string | null }) {
  const s = data.summary;
  const cards = [
    { label: 'Số đơn', value: String(s.orders) },
    { label: 'Tổng thực trả', value: formatVnd(s.net), strong: true },
    { label: 'Tiền hàng', value: formatVnd(s.gross) },
    { label: 'Đã được giảm', value: formatVnd(s.discount) },
    { label: 'Phí vận chuyển', value: formatVnd(s.shipping) },
  ];
  return (
    <section className="space-y-3">
      <p className="text-sm text-stone-500">
        Đơn đặt trong khoảng {formatRange(data.range)}
        {categoryName && (
          <>
            {' '}
            có sản phẩm thuộc <span className="font-medium">{categoryName}</span>. Các số dưới đây là
            tổng <strong>toàn đơn</strong>
          </>
        )}
        .
      </p>
      {s.category && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/40">
          <div className="text-xs text-stone-600 dark:text-stone-400">
            Phần thuộc {categoryName} (tiền hàng sau giảm giá được phân bổ, không gồm phí ship)
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-orange-700 dark:text-orange-400">
            {formatVnd(s.category.amount)}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {s.category.lines} dòng sản phẩm (không phải số lượng đơn vị)
            {s.category.linesWithoutValue > 0 &&
              ` · ${s.category.linesWithoutValue} dòng chưa có giá trị tiền, không được cộng`}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-stone-200 p-4 dark:border-stone-800"
          >
            <div className="text-xs text-stone-500">{c.label}</div>
            <div
              className={`mt-1 tabular-nums ${c.strong ? 'text-xl font-bold text-orange-600' : 'text-lg font-semibold'}`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
      <ul className="space-y-1 text-sm text-stone-600 dark:text-stone-400">
        {s.deliveredOnly > 0 && (
          <li>
            {s.deliveredOnly} đơn chỉ có email giao hàng (thường là đơn thanh toán khi nhận hàng).
          </li>
        )}
        {s.paymentOnly > 0 && (
          <li>{s.paymentOnly} đơn đã thanh toán nhưng chưa có email giao hàng.</li>
        )}
        {s.needsReview > 0 && (
          <li className="text-amber-600">{s.needsReview} đơn cần kiểm tra lại (đánh dấu ⚠).</li>
        )}
        {s.returnEmails > 0 && (
          <li>
            {s.returnEmails} email trả hàng/hoàn tiền chưa được trừ vào tổng: email Shopee không ghi
            số tiền hoàn và không nêu mã đơn.
          </li>
        )}
      </ul>
    </section>
  );
}

function Sources({ events }: { events: Tx['events'] }) {
  const has = (t: string) => events.some((e) => e.type === t);
  return (
    <div className="flex flex-wrap gap-1">
      {has('ORDER_PLACED') && (
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          Thanh toán
        </span>
      )}
      {has('ORDER_DELIVERED') && (
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Giao hàng
        </span>
      )}
    </div>
  );
}

function BulkBar({
  count,
  categories,
  saving,
  onClear,
  onApply,
}: {
  count: number;
  categories: Category[];
  saving: boolean;
  onClear: () => void;
  onApply: (categoryId: string, remember: boolean) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-orange-300 bg-white p-3 text-sm shadow-sm dark:border-orange-900 dark:bg-stone-950">
      <span className="font-semibold">Đã chọn {count} sản phẩm</span>
      <CategorySelect
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        ariaLabel="Danh mục cho các sản phẩm đã chọn"
      />
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Áp dụng cho sản phẩm này trong những lần nhập sau
      </label>
      <button
        onClick={() => categoryId && onApply(categoryId, remember)}
        disabled={!categoryId || saving}
        className="rounded-lg bg-orange-600 px-3 py-1.5 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        Đổi danh mục
      </button>
      <button onClick={onClear} className="text-stone-500 underline">
        Bỏ chọn
      </button>
    </div>
  );
}

function ItemLine({
  item,
  categories,
  filtered,
  checked,
  saving,
  onToggle,
  onEdit,
}: {
  item: TxItem;
  categories: Category[];
  filtered: boolean;
  checked: boolean;
  saving: boolean;
  onToggle: (ids: string[], on: boolean) => void;
  onEdit: (item: TxItem, categoryId: string) => void;
}) {
  const highlight = filtered && item.matchesFilter;
  return (
    <div
      className={`flex gap-2 rounded-md p-1 ${highlight ? 'bg-orange-50 ring-1 ring-orange-300 dark:bg-orange-950/40 dark:ring-orange-900' : ''} ${filtered && !item.matchesFilter ? 'opacity-60' : ''}`}
    >
      <input
        type="checkbox"
        className="mt-1"
        aria-label={`Chọn ${item.productName}`}
        checked={checked}
        onChange={(e) => onToggle([item.id], e.target.checked)}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div>
          <span className="tabular-nums text-stone-500">{item.quantity}×</span> {item.productName}
          {item.variant && <span className="text-stone-500"> · {item.variant}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <CategorySelect
            categories={categories}
            value={item.categoryId}
            disabled={saving}
            onChange={(id) => onEdit(item, id)}
            className="max-w-[14rem] text-xs"
          />
          {item.categorySource && <span>{SOURCE_LABEL[item.categorySource]}</span>}
          <span
            className="tabular-nums"
            title="Tiền hàng sau giảm giá của đơn được chia cho sản phẩm theo tỷ trọng giá, không gồm phí ship"
          >
            {item.allocatedAmount === null
              ? 'Chưa phân bổ được'
              : `Phân bổ ${formatVnd(item.allocatedAmount)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function OrdersTable({
  txs,
  categories,
  filtered,
  selected,
  saving,
  onToggle,
  onEdit,
  onResetFilter,
}: {
  txs: Tx[];
  categories: Category[];
  filtered: boolean;
  selected: Set<string>;
  saving: boolean;
  onToggle: (ids: string[], on: boolean) => void;
  onEdit: (item: TxItem, categoryId: string) => void;
  onResetFilter?: () => void;
}) {
  if (!txs.length) {
    if (onResetFilter) {
      return (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500 dark:border-stone-700">
          Không có đơn nào có sản phẩm thuộc danh mục này trong khoảng ngày đã chọn.{' '}
          <button onClick={onResetFilter} className="underline">
            Bỏ lọc danh mục
          </button>
        </p>
      );
    }
    return (
      <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500 dark:border-stone-700">
        Chưa có đơn nào trong khoảng này. Bấm <strong>Quét Gmail</strong> để bắt đầu, hoặc{' '}
        <Link href="/onboarding" className="underline">
          kiểm tra kết nối Gmail
        </Link>
        .
      </p>
    );
  }
  const visibleIds = txs.flatMap((t) =>
    t.items.filter((i) => !filtered || i.matchesFilter).map((i) => i.id),
  );
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-stone-100 text-xs uppercase text-stone-500 dark:bg-stone-900">
          <tr>
            <th className="px-3 py-2">Ngày đặt</th>
            <th className="px-3 py-2">Mã đơn · Shop</th>
            <th className="px-3 py-2">
              <label className="flex items-center gap-2 normal-case">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => onToggle(visibleIds, e.target.checked)}
                  aria-label={filtered ? 'Chọn mọi sản phẩm khớp bộ lọc' : 'Chọn mọi sản phẩm'}
                />
                <span className="uppercase">Sản phẩm · Danh mục</span>
              </label>
            </th>
            <th className="px-3 py-2 text-right">Tiền hàng</th>
            <th className="px-3 py-2 text-right">Giảm</th>
            <th className="px-3 py-2 text-right">Ship</th>
            <th className="px-3 py-2 text-right">Thực trả</th>
            <th className="px-3 py-2">Nguồn · Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => {
            const inCategory = t.items
              .filter((i) => i.matchesFilter)
              .reduce((s, i) => s + (i.allocatedAmount ?? 0), 0);
            return (
              <tr key={t.id} className="border-t border-stone-200 align-top dark:border-stone-800">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtDate(t.orderDate)}</td>
                <td className="px-3 py-2">
                  <div className="font-mono text-xs">{t.orderId}</div>
                  <div className="text-stone-500">{t.shopName}</div>
                </td>
                <td className="space-y-1 px-3 py-2">
                  {t.items.map((it) => (
                    <ItemLine
                      key={it.id}
                      item={it}
                      categories={categories}
                      filtered={filtered}
                      checked={selected.has(it.id)}
                      saving={saving}
                      onToggle={onToggle}
                      onEdit={onEdit}
                    />
                  ))}
                  {t.unallocatedAmount !== 0 && (
                    <div
                      className="text-xs text-amber-700 dark:text-amber-400"
                      title="Phần tiền đã biết của đơn nhưng không gán được cho sản phẩm nào (vd thiếu giá sản phẩm)"
                    >
                      Chưa phân bổ: {formatVnd(t.unallocatedAmount)}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {formatVnd(t.grossAmount)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                  {t.discountAmount ? `−${formatVnd(t.discountAmount)}` : '–'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {t.shippingFee ? formatVnd(t.shippingFee) : '–'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  <div className="font-semibold">{formatVnd(t.netAmount)}</div>
                  {filtered && (
                    <div className="text-xs text-orange-700 dark:text-orange-400" title="Phần tiền hàng sau giảm thuộc danh mục đang lọc">
                      Thuộc danh mục: {formatVnd(inCategory)}
                    </div>
                  )}
                </td>
                <td className="space-y-1 px-3 py-2">
                  <Sources events={t.events} />
                  <div className="text-xs text-stone-500">{STATUS_LABEL[t.status]}</div>
                  {t.needsReview && (
                    <div className="text-xs text-amber-600" title={t.reviewReason ?? undefined}>
                      ⚠ {t.reviewReason}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
