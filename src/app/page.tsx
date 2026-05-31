'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('Vítej zpět!');
      } else {
        await signUp(email, password);
        toast.success('Účet vytvořen!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Chyba přihlášení';
      if (msg.includes('invalid-credential')) toast.error('Špatný email nebo heslo');
      else if (msg.includes('email-already')) toast.error('Email již existuje');
      else toast.error('Něco se pokazilo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className='app-bg' style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Background decorations */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0
      }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(219,39,119,0.12) 0%, transparent 70%)',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '64px', marginBottom: '8px' }}>🏟️</div>
          <h1 style={{ fontSize: '36px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-1px' }}>
            Training Arena
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '8px', fontSize: '15px' }}>
            Bridge of skills - Martin Staša
          </p>
        </div>

        <div className="glass card" style={{ marginBottom: '16px' }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '12px',
            padding: '4px', marginBottom: '24px',
          }}>
            {['Přihlásit se', 'Registrovat'].map((label, i) => (
              <button
                key={label}
                onClick={() => setIsLogin(i === 0)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: (i === 0) === isLogin ? 'linear-gradient(135deg, #7c3aed, #db2777)' : 'transparent',
                  color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
                  transition: 'all 0.2s',
                }}
              >{label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="lektor@example.com" required className="input-field"
              />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                Heslo
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required className="input-field"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px', marginTop: '8px' }}>
              {loading ? 'Načítání...' : isLogin ? 'Přihlásit se' : 'Vytvořit účet'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          Účastník školení?{' '}
          <a href="/join" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>
            Připojit se přes kód →
          </a>
        </p>
      </div>
    </main>
  );
}
