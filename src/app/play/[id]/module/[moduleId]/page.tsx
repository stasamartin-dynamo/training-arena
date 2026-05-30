'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, addDoc, collection, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

const COLORS = ['#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706'];

function PlayModuleContent() {
  const { id, moduleId } = useParams();
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || '';
  const router = useRouter();

  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [openAnswer, setOpenAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [myTeam, setMyTeam] = useState<{name: string; color: string} | null>(null);

  useEffect(() => {
    if (!id || !moduleId) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string, 'modules', moduleId as string), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setModuleData(data);

      if (data.showResults) setShowResults(true);
      if (data.status === 'finished' && !data.showResults) {
        setTimeout(() => router.push(`/play/${id}`), 1000);
      }
      if (data.started && data.timeLimit && !answered) {
        const elapsed = (Date.now() - (data.startedAt as number)) / 1000;
        const remaining = Math.max(0, (data.timeLimit as number) - elapsed);
        setTimeLeft(Math.floor(remaining));
      }
      // Find my team
      if (data.teams && type === 'gamification') {
        const participantId = localStorage.getItem('participantId');
        const teams = data.teams as {id: string; name: string; color: string; memberIds: string[]}[];
        const myT = teams.find(t => t.memberIds.includes(participantId || ''));
        if (myT) setMyTeam({ name: myT.name, color: myT.color });
      }
    });
    return unsub;
  }, [id, moduleId, router, answered, type]);

  useEffect(() => {
    if (timeLeft > 0 && !answered) {
      const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timeLeft, answered]);

  const submitAnswer = useCallback(async (ans: string) => {
    if (answered) return;
    const nickname = localStorage.getItem('nickname') || 'Anonym';
    const participantId = localStorage.getItem('participantId');
    setUserAnswer(ans);
    setAnswered(true);
    try {
      await addDoc(collection(db, 'sessions', id as string, 'modules', moduleId as string, 'answers'), {
        nickname, answer: ans, answeredAt: Date.now(),
        participantId: participantId || '',
        timeBonus: timeLeft,
      });
      // Award points based on speed
      if (participantId && type !== 'reflection') {
        const points = 100 + timeLeft * 2;
        await updateDoc(doc(db, 'sessions', id as string, 'participants', participantId), {
          score: (await import('firebase/firestore').then(m => m.increment(points))),
        });
      }
      toast.success('Odpověď odeslána! ✅');
    } catch { toast.error('Chyba při odesílání'); }
  }, [answered, id, moduleId, timeLeft, type]);

  const submitOpen = useCallback(async () => {
    if (!openAnswer.trim()) return;
    await submitAnswer(openAnswer.trim());
  }, [openAnswer, submitAnswer]);

  if (!moduleData.started) {
    return (
      <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '20px', margin: 0 }}>Lektor připravuje aktivitu...</p>
        </div>
      </main>
    );
  }

  const typeLabel: Record<string, string> = { quiz: '❓ Kvíz', vote: '🗳️ Hlasování', scenario: '🎭 Scénář', gamification: '🏆 Gamifikace', reflection: '💭 Reflexe' };

  if (showResults) {
    return (
      <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>Výsledky jsou na plátně!</p>
          {userAnswer && <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 20px' }}>Tvá odpověď: <span style={{ color: '#a78bfa', fontWeight: 700 }}>{userAnswer}</span></p>}
          <button onClick={() => router.push(`/play/${id}`)} className="btn-primary" style={{ padding: '12px 24px' }}>
            Zpět do čekárny
          </button>
        </div>
      </main>
    );
  }

  if (answered) {
    return (
      <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '22px', margin: '0 0 8px' }}>Skvěle!</p>
          <p style={{ color: '#34d399', fontWeight: 700, fontSize: '18px', margin: '0 0 8px' }}>+{100 + timeLeft * 2} bodů</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>Čekáme na ostatní...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        {/* Timer */}
        {timeLeft > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{
              display: 'inline-block', width: '60px', height: '60px', borderRadius: '50%',
              background: timeLeft <= 5 ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.2)',
              border: `3px solid ${timeLeft <= 5 ? '#ef4444' : '#7c3aed'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: timeLeft <= 5 ? '#ef4444' : '#a78bfa', fontWeight: 900, fontSize: '22px',
            } as React.CSSProperties}>{timeLeft}</div>
          </div>
        )}

        {/* My team badge */}
        {myTeam && (
          <div style={{ background: `${myTeam.color}22`, border: `1px solid ${myTeam.color}44`, borderRadius: '12px', padding: '8px 16px', textAlign: 'center', marginBottom: '12px' }}>
            <span style={{ color: myTeam.color, fontWeight: 700 }}>🎯 {myTeam.name}</span>
          </div>
        )}

        <div className="glass card">
          <div style={{ marginBottom: '12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {typeLabel[type] || '📋 Aktivita'}
            </span>
          </div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '20px', margin: '0 0 20px', lineHeight: 1.4 }}>
            {moduleData.question as string}
          </h2>

          {type === 'reflection' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea
                value={openAnswer}
                onChange={e => setOpenAnswer(e.target.value)}
                placeholder="Napiš svou odpověď..."
                rows={5} className="input-field"
              />
              <button onClick={submitOpen} disabled={!openAnswer.trim()} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                Odeslat odpověď
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {((moduleData.options as string[]) || []).map((opt, i) => (
                <button
                  key={i}
                  onClick={() => submitAnswer(opt)}
                  style={{
                    background: `${COLORS[i % COLORS.length]}18`,
                    border: `2px solid ${COLORS[i % COLORS.length]}55`,
                    borderRadius: '14px', padding: '16px 20px',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${COLORS[i % COLORS.length]}33`; e.currentTarget.style.transform = 'translateX(4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${COLORS[i % COLORS.length]}18`; e.currentTarget.style.transform = 'none'; }}
                >
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: `${COLORS[i % COLORS.length]}33`,
                    color: COLORS[i % COLORS.length], fontWeight: 900, fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ color: '#fff', fontSize: '16px', fontWeight: 500 }}>{opt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PlayModulePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>}>
      <PlayModuleContent />
    </Suspense>
  );
}
