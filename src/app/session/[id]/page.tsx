'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, getDocs } from 'firebase/firestore';
import { Session, Participant } from '@/types';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';

const MODULES = [
  { type: 'quiz', icon: '❓', label: 'Kvíz', color: '#7c3aed' },
  { type: 'vote', icon: '🗳️', label: 'Hlasování', color: '#0891b2' },
  { type: 'scenario', icon: '🎭', label: 'Scénář', color: '#db2777' },
  { type: 'gamification', icon: '🏆', label: 'Gamifikace', color: '#d97706' },
  { type: 'reflection', icon: '💭', label: 'Reflexe', color: '#059669' },
];

export default function SessionPage() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string), snap => {
      if (snap.exists()) setSession({ id: snap.id, ...snap.data() } as Session);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(collection(db, 'sessions', id as string, 'participants'), snap => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id || !session?.code) return;
    const joinUrl = `${window.location.origin}/join?code=${session.code}`;
    QRCode.toDataURL(joinUrl, { width: 220, margin: 2, color: { dark: '#1a0533', light: '#ffffff' } })
      .then(setQrUrl).catch(console.error);
  }, [id, session?.code]);

  const startSession = async () => {
    await updateDoc(doc(db, 'sessions', id as string), { status: 'active' });
    toast.success('Session spuštěna!');
  };

  const endSession = async () => {
    if (!confirm('Ukončit session?')) return;
    await updateDoc(doc(db, 'sessions', id as string), { status: 'finished', currentModule: null });
    toast.success('Session ukončena');
  };

  const launchModule = async (type: string) => {
    const moduleRef = await addDoc(collection(db, 'sessions', id as string, 'modules'), {
      type, status: 'active', started: false, showResults: false, createdAt: Date.now(), data: {},
    });
    await updateDoc(doc(db, 'sessions', id as string), { currentModule: moduleRef.id });
    router.push(`/session/${id}/module/${moduleRef.id}?type=${type}`);
  };

  const exportReport = useCallback(async () => {
    if (!session) return;
    setExporting(true);
    try {
      const modulesSnap = await getDocs(collection(db, 'sessions', id as string, 'modules'));
      const reportData: Record<string, unknown>[] = [];

      for (const modDoc of modulesSnap.docs) {
        const modData = modDoc.data();
        const answersSnap = await getDocs(collection(db, 'sessions', id as string, 'modules', modDoc.id, 'answers'));
        answersSnap.docs.forEach(ans => {
          reportData.push({
            'Školení': session.title,
            'Modul typ': modData.type,
            'Otázka': modData.question || '',
            'Přezdívka': ans.data().nickname,
            'Odpověď': Array.isArray(ans.data().answer) ? ans.data().answer.join(', ') : ans.data().answer,
            'Čas odpovědi': new Date(ans.data().answeredAt).toLocaleString('cs'),
          });
        });
      }

      const ws = XLSX.utils.json_to_sheet(reportData.length > 0 ? reportData : [{ 'Školení': session.title, 'Info': 'Žádné odpovědi' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');

      // Participants sheet
      const partData = participants.map(p => ({
        'Přezdívka': p.nickname,
        'Body': p.score,
        'Tým': p.teamId || '-',
        'Připojil se': new Date(p.joinedAt).toLocaleString('cs'),
      }));
      const ws2 = XLSX.utils.json_to_sheet(partData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Účastníci');

      XLSX.writeFile(wb, `training-arena-${session.code}-${Date.now()}.xlsx`);
      toast.success('Report exportován!');
    } catch { toast.error('Chyba při exportu'); } finally { setExporting(false); }
  }, [session, id, participants]);

  if (!session) return (
    <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>
  );

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', marginBottom: '4px', padding: 0 }}>← Dashboard</button>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '26px', margin: '0 0 4px' }}>{session.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Kód:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '28px', color: '#a78bfa', letterSpacing: '4px' }}>{session.code}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={exportReport} disabled={exporting} style={{
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}>📊 {exporting ? 'Exportuji...' : 'Export XLSX'}</button>
            {session.status === 'waiting' && (
              <button onClick={startSession} className="btn-success" style={{ padding: '10px 20px' }}>▶ Spustit session</button>
            )}
            {session.status === 'active' && (
              <button onClick={endSession} className="btn-danger" style={{ padding: '10px 20px' }}>⏹ Ukončit</button>
            )}
            {session.status === 'active' && session.currentModule && (
              <button onClick={() => router.push(`/session/${id}/module/${session.currentModule}`)} style={{
                background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
                color: '#a78bfa', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              }}>↩ Zpět do modulu</button>
            )}
          </div>
        </div>

        {/* Top grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {/* QR */}
          <div className="glass card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px', fontSize: '16px' }}>📱 QR Kód pro účastníky</h2>
            {qrUrl ? (
              <img src={qrUrl} alt="QR" style={{ borderRadius: '12px', width: '180px' }} />
            ) : (
              <div style={{ width: '180px', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }} />
            )}
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/join?code=${session.code}` : ''}
            </p>
          </div>

          {/* Participants */}
          <div className="glass card">
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px', fontSize: '16px' }}>
              👥 Účastníci ({participants.length})
            </h2>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {participants.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', margin: 0 }}>Čeká se na účastníky...</p>
              )}
              {sortedParticipants.map((p, i) => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)', fontSize: '12px', width: '16px' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span style={{ color: '#fff', fontSize: '14px' }}>{p.nickname}</span>
                  </div>
                  <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '14px' }}>{p.score} b</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="glass card">
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px', fontSize: '16px' }}>📊 Status session</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Status:</span>
                <span style={{ fontWeight: 700, color: session.status === 'active' ? '#34d399' : session.status === 'finished' ? '#94a3b8' : '#fbbf24' }}>
                  {session.status === 'active' ? '🟢 Aktivní' : session.status === 'finished' ? '⚫ Ukončená' : '🟡 Čeká na spuštění'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Účastníků:</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>{participants.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Aktivní modul:</span>
                <span style={{ fontWeight: 700, color: session.currentModule ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>
                  {session.currentModule ? '✅ Běží' : '—'}
                </span>
              </div>
              {session.status === 'waiting' && (
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '10px', marginTop: '4px' }}>
                  <p style={{ color: '#fbbf24', fontSize: '13px', margin: 0, textAlign: 'center' }}>
                    ⚡ Spusťte session, aby se účastníci mohli připojit
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module launcher */}
        {session.status === 'active' && (
          <div className="glass card">
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 20px', fontSize: '18px' }}>🎯 Spustit modul</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              {MODULES.map(m => (
                <button
                  key={m.type}
                  onClick={() => launchModule(m.type)}
                  style={{
                    background: `${m.color}22`,
                    border: `1px solid ${m.color}44`,
                    borderRadius: '16px', padding: '20px 12px',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${m.color}44`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${m.color}22`; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>{m.icon}</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {session.status === 'finished' && (
          <div className="glass card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ color: '#fff', fontWeight: 900, fontSize: '24px', margin: '0 0 8px' }}>Session ukončena!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>Celkem {participants.length} účastníků</p>
            <button onClick={exportReport} disabled={exporting} className="btn-success" style={{ padding: '14px 32px', fontSize: '16px' }}>
              📊 Stáhnout report XLSX
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
