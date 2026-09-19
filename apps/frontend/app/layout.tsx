import type { ReactNode } from 'react';
import './globals.css';
export const metadata = { title: 'Suivi électoral régional', description: 'Plateforme interne de monitoring électoral temps réel' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
