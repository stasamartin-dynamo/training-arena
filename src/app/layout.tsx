import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Training Arena',
  description: 'Interaktivní platforma pro lektory a školitele',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-center" toastOptions={{
            style: { background: '#1a1035', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
          }} />
        </AuthProvider>
      </body>
    </html>
  );
}
