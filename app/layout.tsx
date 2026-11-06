import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Eventsfeed · Tu evento, en juego',
  applicationName: 'Eventsfeed',
  description: 'Centro de control de eventos de fútbol: check-in, equipos, valoraciones y speaker.',
  manifest: '/site.webmanifest',
  appleWebApp: { capable: true, title: 'Eventsfeed', statusBarStyle: 'default' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/icons/eventsfeed-mark-v3.svg', type: 'image/svg+xml' },
      { url: '/icons/eventsfeed-32-v3.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/icons/eventsfeed-180-v3.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/icons/eventsfeed-32-v3.png',
  },
};
export const viewport: Viewport = { themeColor: '#1d3d2e' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
