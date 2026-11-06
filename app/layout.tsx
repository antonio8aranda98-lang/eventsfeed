import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Eventsfeed · Tu evento, en juego', description: 'Centro de control de eventos de fútbol: check-in, equipos, valoraciones y speaker.', icons: { icon: '/favicon.svg' } };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="es"><body>{children}</body></html>; }
