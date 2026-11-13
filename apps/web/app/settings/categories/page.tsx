'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { api, ApiError, type CategoryRule, type Me } from '@/lib/api';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

export default function CategoryRulesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [rules, setRules] = useState<CategoryRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Me>('/me'), api<CategoryRule[]>('/category-rules')])
      .then(([m, r]) => {
        setMe(m);
        setRules(r);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) router.push('/');
        else setError((e as Error).message);
      });
  }, [router]);

  async function remove(rule: CategoryRule) {
    setError(null);
    try {
      await api(`/category-rules/${rule.id}`, { method: 'DELETE' });
      setRules((rs) => rs?.filter((r) => r.id !== rule.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <AppHeader email={me?.email} />
      <div className="space-y-2">
        <Link href="/orders" className="text-sm text-stone-500 underline">
          ← Đơn hàng
        </Link>
        <h1 className="text-2xl font-bold">Quy tắc danh mục đã ghi nhớ</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Khi bạn chọn “Áp dụng cho sản phẩm này trong những lần nhập sau”, sản phẩm có cùng tên trong
          các đơn nhập sau sẽ tự vào danh mục đã chọn. Quy tắc chỉ áp dụng cho tài khoản của bạn.
          Xóa quy tắc không đổi danh mục của các sản phẩm đã lưu.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {rules === null && !error && <p className="text-stone-500">Đang tải…</p>}
      {rules?.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500 dark:border-stone-700">
          Chưa có quy tắc nào. Đổi danh mục một sản phẩm ở trang Đơn hàng rồi chọn ghi nhớ.
        </p>
      )}
      {rules && rules.length > 0 && (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate">{r.label}</div>
                <div className="text-xs text-stone-500">
                  → {r.category.name} · tạo ngày {fmtDate(r.createdAt)}
                </div>
              </div>
              <button onClick={() => remove(r)} className="text-red-600 underline">
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
