import type { Metadata, Viewport } from 'next';
import { themeScript } from '@/components/theme-toggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSCX — Escola Instructiva',
  description:
    'Plataforma de Customer Success e Customer Experience da Escola Instructiva: jornada do aluno, Health Score, NPS, CSAT, automações e IA.',
  applicationName: 'CSCX',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111113' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
