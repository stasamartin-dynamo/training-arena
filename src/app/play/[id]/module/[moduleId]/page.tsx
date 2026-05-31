'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, addDoc, collection, updateDoc, getDoc, increment } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

const COLORS = ['#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706'];

function PlayModuleContent() {
  const { id, moduleId } = useParams();
  const router = useRouter();

  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const [sessionData, setSessionData] = useState<Record<string, unknown>>({});
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [openAnswer, setOpenAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentModuleId, setCurrentModuleId] = useState(moduleId as string);
  const [waitingNext, setWaitingNext] = useState(false);
  const [finished, setFinished] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Listen to session for set-flow changes
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setSessionData(data);
      const setFlow = data.setFlow as string[] | undefined;
      const setFlowIndex = data.setFlowIndex as number | undefined;
      if (setFlow) {
        setTotalQuestions(setFlow.length);
        if (setFlowIndex !== undefined) setQuestionIndex(setFlowIndex);
      }
      // If session moved to next module in flow
      if (data.currentModule && data.currentModule !== currentModuleId && waitingNext) {
        setCurrentModuleId(data.currentModule);
        setAnswered(false);
        setUserAnswer('');
        setOpenAnswer('');
        setWaitingNext(false);
        router.replace(`/play/${id}/module/${data.currentModule}`);
      }
      // Flow finished
      if (data.setFlowFinished && waitingNext) {
        setFinished(true);
      }
    });
    return unsub;
  }, [id, currentModuleId, waitingNext, router]);

  // Listen to current module
  useEffect(() => {
    if (!id || !currentModuleId) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string, 'modules', currentModuleId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setModuleData(data);
      if (data.started && data.timeLimit && !answered) {
        const elapsed = (Date.now() - (data.startedAt as number)) / 1000;
        const remaining = Math.max(0, (data.timeLimit as number) - elapsed);
        setTimeLeft(Math.floor(remaining));
      }
    });
    return unsub;
  }, [id, currentModuleId, answered]);

  // Timer
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
      await addDoc(collection(db, 'sessions', id as string, 'modules', currentModuleId, 'answers'), {
        nickname, answer: ans, answeredAt: Date.now(),
        participantId: participantId || '',
        timeBonus: timeLeft,
      });
      // Bodování vypnuto
      toast.success('Odpověď odeslána! ✅');
      // Check if set-flow — wait for session to advance
      const sesSnap = await getDoc(doc(db, 'sessions', id as string));
      const sesData = sesSnap.data();
      if (sesData?.setFlow) {
        setWaitingNext(true);
      }
    } catch { toast.error('Chyba při odesílání'); }
  }, [answered, id, currentModuleId, timeLeft, moduleData]);

  const submitOpen = useCallback(async () => {
    if (!openAnswer.trim()) return;
    await submitAnswer(openAnswer.trim());
  }, [openAnswer, submitAnswer]);

  // Finished screen
  if (finished) {
    return (
      <main className='app-bg' style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ color: '#fff', fontWeight: 900, fontSize: '24px', margin: '0 0 8px' }}>Hotovo!</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>Odpověděl/a jsi na všechny otázky.</p>
          <button onClick={() => router.push(`/play/${id}`)} className="btn-primary" style={{ padding: '12px 24px' }}>
            Zpět do čekárny
          </button>
        </div>
      </main>
    );
  }

  // Waiting for next question in flow
  if (waitingNext) {
    return (
      <main className='app-bg' style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏭️</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '20px', margin: '0 0 8px' }}>Skvěle!</p>
          <p style={{ color: '#34d399', fontWeight: 700, fontSize: '16px', margin: '0 0 8px' }}>✅ Odpověď odeslána</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>Načítám další otázku...</p>
          {totalQuestions > 0 && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '12px' }}>
              {questionIndex + 1} / {totalQuestions}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (!moduleData.started) {
    return (
      <main className='app-bg' style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '20px', margin: 0 }}>Lektor připravuje aktivitu...</p>
        </div>
      </main>
    );
  }

  if (answered && !(sessionData as Record<string, unknown>)?.setFlow) {
    return (
      <main className='app-bg' style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '22px', margin: '0 0 8px' }}>Skvěle!</p>
          <p style={{ color: '#34d399', fontWeight: 700, fontSize: '18px', margin: '0 0 8px' }}>✅ Odpověď odeslána</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>Čekáme na ostatní...</p>
        </div>
      </main>
    );
  }

  const modType = moduleData.type as string;
  const typeLabel: Record<string, string> = { quiz: '❓ Kvíz', vote: '🗳️ Hlasování', scenario: '🎭 Scénář', gamification: '🏆 Gamifikace', reflection: '💭 Reflexe' };

  return (
    <main className='app-bg' style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        {totalQuestions > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
              Otázka {questionIndex + 1} z {totalQuestions}
            </span>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '4px', marginTop: '6px' }}>
              <div style={{ background: '#7c3aed', borderRadius: '4px', height: '4px', width: `${((questionIndex + 1) / totalQuestions) * 100}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        {timeLeft > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto',
              background: timeLeft <= 5 ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.2)',
              border: `3px solid ${timeLeft <= 5 ? '#ef4444' : '#7c3aed'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: timeLeft <= 5 ? '#ef4444' : '#a78bfa', fontWeight: 900, fontSize: '22px',
            }}>{timeLeft}</div>
          </div>
        )}
        <div className="glass card">
          <div style={{ marginBottom: '12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {typeLabel[modType] || '📋 Aktivita'}
            </span>
          </div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '20px', margin: '0 0 20px', lineHeight: 1.4 }}>
            {moduleData.question as string}
          </h2>
          {modType === 'reflection' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea value={openAnswer} onChange={e => setOpenAnswer(e.target.value)}
                placeholder="Napiš svou odpověď..." rows={5} className="input-field" />
              <button onClick={submitOpen} disabled={!openAnswer.trim()} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                Odeslat odpověď
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {((moduleData.options as string[]) || []).map((opt, i) => (
                <button key={i} onClick={() => submitAnswer(opt)}
                  style={{
                    background: `${COLORS[i % COLORS.length]}18`,
                    border: `2px solid ${COLORS[i % COLORS.length]}55`,
                    borderRadius: '14px', padding: '16px 20px',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${COLORS[i % COLORS.length]}33`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${COLORS[i % COLORS.length]}18`; }}>
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: `${COLORS[i % COLORS.length]}33`,
                    color: COLORS[i % COLORS.length], fontWeight: 900, fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{String.fromCharCode(65 + i)}</span>
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
