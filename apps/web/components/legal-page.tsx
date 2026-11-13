import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL_UPDATED, SUPPORT_EMAIL } from '@/lib/legal';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-orange-600">
        ← Soi Đơn
      </Link>
      <h1 className="mt-6 text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-stone-500">Cập nhật lần cuối: {LEGAL_UPDATED}</p>
      <div className="mt-8 space-y-8 leading-relaxed text-stone-700 dark:text-stone-300 [&_a]:text-orange-600 [&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-stone-900 dark:[&_h2]:text-stone-100 [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:space-y-1.5">
        {children}
      </div>
    </main>
  );
}

export function SupportEmail() {
  if (!SUPPORT_EMAIL)
    return <span className="font-semibold text-red-600">[chưa cấu hình email liên hệ]</span>;
  return <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
}

export function LegalFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-2xl gap-4 px-4 py-6 text-sm text-stone-500">
      <Link href="/privacy" className="hover:text-stone-900 dark:hover:text-stone-100">
        Quyền riêng tư
      </Link>
      <Link href="/terms" className="hover:text-stone-900 dark:hover:text-stone-100">
        Điều khoản
      </Link>
    </footer>
  );
}
