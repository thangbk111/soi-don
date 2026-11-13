'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/orders', label: 'Đơn hàng' },
  { href: '/onboarding', label: 'Kết nối Gmail' },
];

export function AppHeader({ email }: { email?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex items-center gap-4">
        <span className="font-semibold text-orange-600">Soi Đơn</span>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`text-sm ${
              pathname === n.href
                ? 'font-semibold'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3 text-sm text-stone-500">
        {email && <span className="hidden sm:inline">{email}</span>}
        <button onClick={logout} className="underline">
          Đăng xuất
        </button>
      </div>
    </header>
  );
}