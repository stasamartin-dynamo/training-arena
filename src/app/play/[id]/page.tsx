'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import { Session } from '@/types';

export default function PlayPage() {
  const { id } = useParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNickname] = useState('');
  const [score, setScore] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('nickname');
    if (!saved) { router.push('/join'); return; }
    setNickname(saved);
  }, [router]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(collection(db, 'sessions', id as string, 'participants'), snap => {
      setParticipantCount(snap.size);
      const participantId = localStorage.getItem('participantId');
      if (participantId) {
        const me = snap.docs.find(d => d.id === participantId);
        if (me) setScore(me.data().score || 0);
      }
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string), async snap => {
      if (!snap.exists()) return;
      const s = { id: snap.id, ...snap.data() } as Session;
      setSession(s);

      if (s.currentModule) {
        const { getDoc } = await import('firebase/firestore');
        const modSnap = await getDoc(doc(db, 'sessions', id as string, 'modules', s.currentModule));
        if (modSnap.exists()) {
          const modData = modSnap.data();
          router.push(`/play/${id}/module/${s.currentModule}?type=${modData.type}`);
        }
      }
    });
    return unsub;
  }, [id, router]);

  if (!session) return (
    <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      Načítání...
    </div>
  );

  return (
    <main style={{
      minHeight: '100vh',
      className='app-bg',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(8,145,178,0.1) 0%, transparent 70%)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div className="glass card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>🏟️</div>
          <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '26px', margin: '0 0 4px' }}>Training Arena</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>{session.title}</p>

          {/* Player info */}
          <div style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', fontSize: '13px' }}>Přihlášen jako</p>
            <p style={{ color: '#fff', fontWeight: 900, fontSize: '24px', margin: '0 0 8px' }}>{nickname}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
              <div>
                <p style={{ color: '#fbbf24', fontWeight: 700, fontSize: '20px', margin: 0 }}>{score}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>bodů</p>
              </div>
              <div>
                <p style={{ color: '#34d399', fontWeight: 700, fontSize: '20px', margin: 0 }}>{participantCount}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>účastníků</p>
              </div>
            </div>
          </div>

          {session.status === 'waiting' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '12px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24',
                    animation: 'bounce-dot 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.16}s`,
                  }} />
                ))}
              </div>
              <p style={{ color: '#fbbf24', fontWeight: 600, margin: '0 0 4px' }}>Čekáme na lektora...</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>Session brzy začne</p>
            </div>
          )}

          {session.status === 'active' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34d399', animation: 'pulse 2s ease-in-out infinite' }} />
              </div>
              <p style={{ color: '#34d399', fontWeight: 600, margin: '0 0 4px' }}>Školení probíhá</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>Čekej na další aktivitu...</p>
            </div>
          )}

          {session.status === 'finished' && (
            <div>
              <p style={{ fontSize: '48px', margin: '0 0 12px' }}>🎉</p>
              <p style={{ color: '#fff', fontWeight: 900, fontSize: '22px', margin: '0 0 8px' }}>Školení skončilo!</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>Tvé celkové skóre:</p>
              <p style={{ color: '#fbbf24', fontWeight: 900, fontSize: '48px', margin: 0 }}>{score} b</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', fontSize: '14px' }}>Děkujeme za účast!</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
      `}</style>
    </main>
  );
}
