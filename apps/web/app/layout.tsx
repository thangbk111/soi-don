import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { LegalFooter } from '@/components/legal-page';
import './globals.css';

const font = Be_Vietnam_Pro({
  variable: '--font-sans-vi',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Soi Đơn',
  description: 'Xem bạn đã chi bao nhiêu trên Shopee trong 12 tháng qua',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <LegalFooter />
      </body>
    </html>
  );
}
