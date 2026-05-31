'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

function JoinContent() {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [step, setStep] = useState<'code' | 'nickname'>('code');
  const [sessionId, setSessionId] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const c = searchParams.get('code');
    if (c) setCode(c.toUpperCase());
  }, [searchParams]);

  const findSession = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'sessions'),
        where('code', '==', code.toUpperCase()),
        where('status', 'in', ['waiting', 'active'])
      );
      const snap = await getDocs(q);
      if (snap.empty) { toast.error('Session nenalezena nebo již skončila'); return; }
      setSessionId(snap.docs[0].id);
      setSessionTitle(snap.docs[0].data().title);
      setStep('nickname');
    } catch { toast.error('Chyba při hledání'); } finally { setLoading(false); }
  };

  const joinSession = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      const participantRef = await addDoc(collection(db, 'sessions', sessionId, 'participants'), {
        nickname: nickname.trim(), sessionId, score: 0, joinedAt: Date.now(),
      });
      localStorage.setItem('nickname', nickname.trim());
      localStorage.setItem('sessionId', sessionId);
      localStorage.setItem('participantId', participantRef.id);
      router.push(`/play/${sessionId}`);
    } catch { toast.error('Chyba při připojování'); } finally { setLoading(false); }
  };

  return (
    <main className='app-bg' style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(8,145,178,0.15) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '64px', marginBottom: '8px' }}>🏟️</div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#fff', margin: 0 }}>Training Arena</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>Připojit se ke školení</p>
        </div>

        <div className="glass card">
          {step === 'code' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ color: '#fff', fontWeight: 700, textAlign: 'center', margin: 0 }}>Zadej kód školení</h2>
              <input
                type="text" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="např. AB12"
                maxLength={6}
                className="input-field"
                style={{ textAlign: 'center', fontSize: '32px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '8px', padding: '16px' }}
                onKeyDown={e => e.key === 'Enter' && findSession()}
              />
              <button onClick={findSession} disabled={loading || !code.trim()} className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                {loading ? 'Hledám...' : '🔍 Najít školení'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(124,58,237,0.15)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', fontSize: '13px' }}>Připojuješ se k</p>
                <p style={{ color: '#fff', fontWeight: 700, margin: 0, fontSize: '18px' }}>{sessionTitle}</p>
              </div>
              <h2 style={{ color: '#fff', fontWeight: 700, textAlign: 'center', margin: 0 }}>Jak se jmenuješ?</h2>
              <input
                type="text" value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="Tvoje přezdívka"
                maxLength={20}
                className="input-field"
                style={{ textAlign: 'center', fontSize: '22px', fontWeight: 700, padding: '16px' }}
                onKeyDown={e => e.key === 'Enter' && joinSession()}
              />
              <button onClick={joinSession} disabled={loading || !nickname.trim()} className="btn-success"
                style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                {loading ? 'Připojuji...' : '🚀 Vstoupit do arény!'}
              </button>
              <button onClick={() => setStep('code')} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', fontSize: '14px', padding: '8px',
              }}>← Zpět</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>}>
    <JoinContent />
  </Suspense>;
}
