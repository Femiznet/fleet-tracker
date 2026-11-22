import { Inter } from 'next/font/google';
import './global.css';
import { ToastProvider } from '@/frontend/components/toast-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
