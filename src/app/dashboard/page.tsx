'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { Session } from '@/types';
import toast from 'react-hot-toast';

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default function Dashboard() {
  const { user, logOut, loading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const q = query(
      collection(db, 'sessions'),
      where('lektorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
    });
  }, [user]);

  const createSession = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const code = generateCode();
      const docRef = await addDoc(collection(db, 'sessions'), {
        code, lektorId: user.uid, lektorName: user.email,
        title: title.trim(), status: 'waiting', currentModule: null, createdAt: Date.now(),
      });
      toast.success(`Session vytvořena! Kód: ${code}`);
      setTitle('');
      router.push(`/session/${docRef.id}`);
    } catch { toast.error('Chyba při vytváření'); } finally { setCreating(false); }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Smazat tuto session?')) return;
    setSessions(prev => prev.filter(s => s.id !== id));
    try {
      await deleteDoc(doc(db, 'sessions', id));
      toast.success('Session smazána');
    } catch { toast.error('Chyba při mazání'); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0a1e' }}>
      <div style={{ color: 'white', fontSize: '18px' }}>Načítání...</div>
    </div>
  );

  const statusColor: Record<string, string> = { waiting: '#fbbf24', active: '#34d399', finished: '#94a3b8' };
  const statusBg: Record<string, string> = { waiting: 'rgba(234,179,8,0.15)', active: 'rgba(16,185,129,0.15)', finished: 'rgba(100,116,139,0.15)' };
  const statusLabel: Record<string, string> = { waiting: '🟡 Čeká', active: '🟢 Aktivní', finished: '⚫ Ukončená' };

  return (
    <main className='app-bg' style={{ minHeight: '100vh', padding: '24px' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)' }} />
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <span style={{ fontSize: '32px' }}>🏟️</span>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#fff', margin: 0 }}>Training Arena</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '14px' }}>www.inspiracezivotem.eu</p>
          </div>
          <button onClick={logOut} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.7)', padding: '8px 16px', borderRadius: '10px',
            cursor: 'pointer', fontSize: '14px',
          }}>Odhlásit</button>
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { icon: '📚', label: 'Knihovna obsahu', sub: 'Otázky a scénáře', path: '/library', color: '#7c3aed' },
            { icon: '🗂️', label: 'Sady školení', sub: 'Připravené playlisty', path: '/sets', color: '#0891b2' },
          ].map(link => (
            <div key={link.path} onClick={() => router.push(link.path)}
              className="glass" style={{ borderRadius: '16px', padding: '18px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '14px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}>
              <div style={{ fontSize: '28px', width: '48px', height: '48px', borderRadius: '12px', background: `${link.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{link.icon}</div>
              <div>
                <p style={{ color: '#fff', fontWeight: 700, margin: 0, fontSize: '14px' }}>{link.label}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '12px' }}>{link.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Create session */}
        <div className="glass card" style={{ marginBottom: '24px' }}>
          <h2 style={{ color: '#fff', fontWeight: 700, marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>➕ Nová session</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Název školení (např. Obchodní dovednosti)"
              className="input-field" onKeyDown={e => e.key === 'Enter' && createSession()} style={{ flex: 1 }} />
            <button onClick={createSession} disabled={creating || !title.trim()} className="btn-primary" style={{ whiteSpace: 'nowrap', padding: '12px 24px' }}>
              {creating ? '...' : 'Vytvořit'}
            </button>
          </div>
        </div>

        {/* Sessions list */}
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: '16px', fontSize: '18px' }}>📋 Moje sessions ({sessions.length})</h2>
          {sessions.length === 0 && (
            <div className="glass card" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
              <p>Zatím žádné sessions. Vytvořte první!</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map(session => (
              <div key={session.id} onClick={() => router.push(`/session/${session.id}`)}
                className="glass" style={{ borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}>
                <div>
                  <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 4px', fontSize: '16px' }}>{session.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '13px' }}>
                    Kód: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#a78bfa', fontSize: '16px' }}>{session.code}</span>
                    <span style={{ marginLeft: '12px' }}>{new Date(session.createdAt).toLocaleDateString('cs')}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ background: statusBg[session.status], color: statusColor[session.status], padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 600 }}>
                    {statusLabel[session.status]}
                  </span>
                  <button onClick={e => deleteSession(e, session.id)}
                    style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
