'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Session, Participant } from '@/types';
import { TrainingSet, LibraryItem } from '@/types/library';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MODULES = [
  { type: 'quiz', icon: '❓', label: 'Kvíz', color: '#7c3aed' },
  { type: 'vote', icon: '🗳️', label: 'Hlasování', color: '#0891b2' },
  { type: 'scenario', icon: '🎭', label: 'Scénář', color: '#db2777' },
  { type: 'gamification', icon: '🏆', label: 'Gamifikace', color: '#d97706' },
  { type: 'reflection', icon: '💭', label: 'Reflexe', color: '#059669' },
];
const COLORS = ['#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706', '#dc2626'];

interface ModuleResult {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
  answers: { nickname: string; answer: string; answeredAt: number }[];
}

export default function SessionPage() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sets, setSets] = useState<TrainingSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<TrainingSet | null>(null);
  const [tab, setTab] = useState<'manual' | 'set'>('set');
  const [results, setResults] = useState<ModuleResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

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

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'sets'), where('lektorId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setSets(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingSet)));
    });
    return unsub;
  }, [user]);

  // Load results when finished
  useEffect(() => {
    if (!id || session?.status !== 'finished') return;
    setLoadingResults(true);
    const load = async () => {
      const modulesSnap = await getDocs(collection(db, 'sessions', id as string, 'modules'));
      const res: ModuleResult[] = [];
      for (const modDoc of modulesSnap.docs) {
        const modData = modDoc.data();
        if (!modData.question) continue;
        const answersSnap = await getDocs(collection(db, 'sessions', id as string, 'modules', modDoc.id, 'answers'));
        res.push({
          id: modDoc.id,
          type: modData.type,
          question: modData.question,
          options: modData.options || [],
          correctAnswer: modData.correctAnswer || '',
          points: Number(modData.points) || 0,
          answers: answersSnap.docs.map(a => a.data() as { nickname: string; answer: string; answeredAt: number }),
        });
      }
      setResults(res);
      setLoadingResults(false);
    };
    load();
  }, [id, session?.status]);

  const startSession = async () => {
    await updateDoc(doc(db, 'sessions', id as string), { status: 'active' });
    toast.success('Session spuštěna!');
  };

  const endSession = async () => {
    if (!confirm('Ukončit session?')) return;
    await updateDoc(doc(db, 'sessions', id as string), { status: 'finished', currentModule: null });
    toast.success('Session ukončena');
  };

  const shuffleOptions = (options: string[], correctAnswer: string) => {
    const shuffled = [...options].sort(() => Math.random() - 0.5);
    return { options: shuffled, correctAnswer };
  };

  const launchSet = async (set: TrainingSet) => {
    if (!set.items || set.items.length === 0) { toast.error('Sada je prázdná'); return; }
    toast.loading('Připravuji sadu...');
    const moduleIds: string[] = [];
    for (const item of set.items) {
      const moduleRef = await addDoc(collection(db, 'sessions', id as string, 'modules'), {
        ...(() => {
          const rawOptions = (item.options || []).filter((o: string) => o);
          const correctAns = (item as {correctAnswer?: string}).correctAnswer || '';
          const shuffled = [...rawOptions].sort(() => Math.random() - 0.5);
          return { options: shuffled, correctAnswer: correctAns };
        })(),
        type: item.type, question: item.question,
        timeLimit: item.timeLimit || 30, title: item.title || '',
        points: Number((item as {points?: number}).points) || 5,
        status: 'pending', started: false, showResults: false, preloaded: true,
        createdAt: Date.now(),
      });
      moduleIds.push(moduleRef.id);
    }
    await updateDoc(doc(db, 'sessions', id as string), {
      setFlow: moduleIds, setFlowIndex: 0, setFlowFinished: false,
      currentModule: moduleIds[0],
    });
    await updateDoc(doc(db, 'sessions', id as string, 'modules', moduleIds[0]), {
      started: true, startedAt: Date.now(),
    });
    toast.dismiss();
    toast.success('Sada spuštěna!');
    router.push(`/session/${id}/module/${moduleIds[0]}?type=${set.items[0].type}&setflow=1`);
  };

  const launchModule = async (type: string, item?: LibraryItem) => {
    const moduleRef = await addDoc(collection(db, 'sessions', id as string, 'modules'), {
      type, status: 'active', started: false, showResults: false, createdAt: Date.now(),
      ...(item ? (() => {
        const rawOptions = (item.options || []).filter((o: string) => o);
        const shuffled = [...rawOptions].sort(() => Math.random() - 0.5);
        return { question: item.question, options: shuffled, correctAnswer: (item as {correctAnswer?: string}).correctAnswer || '', timeLimit: item.timeLimit, preloaded: true };
      })() : {}),
    });
    await updateDoc(doc(db, 'sessions', id as string), { currentModule: moduleRef.id });
    router.push(`/session/${id}/module/${moduleRef.id}?type=${type}${item ? '&preloaded=1' : ''}`);
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
            'Školení': session.title, 'Modul typ': modData.type,
            'Otázka': modData.question || '', 'Přezdívka': ans.data().nickname,
            'Odpověď': Array.isArray(ans.data().answer) ? ans.data().answer.join(', ') : ans.data().answer,
            'Čas odpovědi': new Date(ans.data().answeredAt).toLocaleString('cs'),
          });
        });
      }
      const ws = XLSX.utils.json_to_sheet(reportData.length > 0 ? reportData : [{ Info: 'Žádné odpovědi' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const ws2 = XLSX.utils.json_to_sheet(participants.map(p => ({
        'Přezdívka': p.nickname, 'Tým': p.teamId || '-',
        'Připojil se': new Date(p.joinedAt).toLocaleString('cs'),
      })));
      XLSX.utils.book_append_sheet(wb, ws2, 'Účastníci');
      XLSX.writeFile(wb, `training-arena-${session.code}.xlsx`);
      toast.success('Report exportován!');
    } catch { toast.error('Chyba při exportu'); } finally { setExporting(false); }
  }, [session, id, participants]);

  if (!session) return <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>;

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

  // Results dashboard for finished session
  if (session.status === 'finished') {
    return (
      <main className='app-bg' style={{ minHeight: '100vh', padding: '24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', marginBottom: '4px', padding: 0 }}>← Dashboard</button>
              <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '26px', margin: '0 0 4px' }}>📊 {session.title} — Výsledky</h1>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Session ukončena · {participants.length} účastníků</span>
            </div>
            <button onClick={exportReport} disabled={exporting} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              📥 {exporting ? 'Exportuji...' : 'Export XLSX'}
            </button>
          </div>

          {/* Leaderboard */}
          <div className="glass card" style={{ marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '18px', margin: '0 0 16px' }}>🏆 Žebříček</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedParticipants.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: i === 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', padding: '12px 16px' }}>
                  <span style={{ fontSize: '20px', width: '28px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                  <span style={{ color: '#fff', fontWeight: 700, flex: 1 }}>{p.nickname}</span>
                  <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: '18px' }}></span>
                  <div style={{ display: "none" }}>
                    <div style={{ width: `${Math.min(100, (p.score / (sortedParticipants[0]?.score || 1)) * 100)}%`, background: '#fbbf24', borderRadius: '4px', height: '6px' }} />
                  </div>
                </div>
              ))}
              {sortedParticipants.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>Žádní účastníci</p>}
            </div>
          </div>

          {/* Per-question results */}
          {loadingResults ? (
            <div className="glass card" style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0 }}>Načítám výsledky...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {results.map((mod, qi) => {
                const modInfo = MODULES.find(m => m.type === mod.type) || MODULES[0];
                // Count answers per option
                const counts: Record<string, number> = {};
                mod.options.forEach(o => counts[o] = 0);
                mod.answers.forEach(a => {
                  if (counts[a.answer] !== undefined) counts[a.answer]++;
                  else counts[a.answer] = (counts[a.answer] || 0) + 1;
                });
                const chartData = mod.type === 'reflection'
                  ? []
                  : mod.options.map(o => ({ name: o.length > 30 ? o.slice(0, 30) + '…' : o, fullName: o, count: counts[o] || 0 }));
                const maxCount = Math.max(...chartData.map(d => d.count), 1);

                return (
                  <div key={mod.id} className="glass card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '20px' }}>{modInfo.icon}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Otázka {qi + 1} · {modInfo.label}
                        </span>
                        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '16px', margin: '4px 0 0' }}>{mod.question}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        {mod.correctAnswer && (
                          <span style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', color: '#34d399', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                            ✅ {mod.correctAnswer.length > 25 ? mod.correctAnswer.slice(0,25)+'…' : mod.correctAnswer}
                          </span>
                        )}
                        {false && (
                          <span style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                            🏆 {mod.points} b
                          </span>
                        )}
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{mod.answers.length} odpovědí</span>
                      </div>
                    </div>

                    {mod.type === 'reflection' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {mod.answers.map((a, i) => (
                          <div key={i} style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{a.nickname}: </span>
                            <span style={{ color: '#fff', fontSize: '14px' }}>{a.answer}</span>
                          </div>
                        ))}
                        {mod.answers.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0, fontSize: '14px' }}>Zadne odpovedi</p>}
                        {mod.answers.filter(a => String(a.answer).startsWith('[Vlastni]')).length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Vlastni odpovedi</p>
                            {mod.answers.filter(a => String(a.answer).startsWith('[Vlastni]')).map((a, i) => (
                              <div key={i} style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{a.nickname}: </span>
                                <span style={{ color: '#fff', fontSize: '14px' }}>{String(a.answer).replace('[Vlastni] ', '')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {mod.answers.filter(a => String(a.answer).startsWith('[Vlastni]')).length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Vlastni odpovedi</p>
                            {mod.answers.filter(a => String(a.answer).startsWith('[Vlastni]')).map((a, idx) => (
                              <div key={idx} style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{a.nickname}: </span>
                                <span style={{ color: '#fff', fontSize: '14px' }}>{String(a.answer).replace('[Vlastni] ', '')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Bar chart */}
                        <div style={{ height: '160px', marginBottom: '12px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} allowDecimals={false} />
                              <Tooltip
                                contentStyle={{ background: '#1a0533', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                formatter={(value, _name, props) => [value, props.payload.fullName]}
                              />
                              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Option rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {chartData.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ width: '20px', height: '20px', borderRadius: '4px', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <div style={{ flex: 1, background: d.fullName === mod.correctAnswer ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.06)', borderRadius: '6px', height: '24px', overflow: 'hidden', position: 'relative', border: d.fullName === mod.correctAnswer ? '1px solid rgba(5,150,105,0.4)' : 'none' }}>
                                <div style={{ width: `${(d.count / maxCount) * 100}%`, background: d.fullName === mod.correctAnswer ? 'rgba(5,150,105,0.5)' : `${COLORS[i % COLORS.length]}66`, height: '100%', transition: 'width 0.5s' }} />
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#fff', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                                  {d.fullName} {d.fullName === mod.correctAnswer ? '✅' : ''}
                                </span>
                              </div>
                              <span style={{ color: COLORS[i % COLORS.length], fontWeight: 700, fontSize: '14px', width: '24px', textAlign: 'right' }}>{d.count}</span>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', width: '36px', textAlign: 'right' }}>
                                {mod.answers.length > 0 ? Math.round((d.count / mod.answers.length) * 100) : 0}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {results.length === 0 && !loadingResults && (
                <div className="glass card" style={{ textAlign: 'center', padding: '32px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.3)', margin: 0 }}>Žádné výsledky k zobrazení</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className='app-bg' style={{ minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
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
            <button onClick={exportReport} disabled={exporting} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              📊 {exporting ? 'Exportuji...' : 'Export XLSX'}
            </button>
            {session.status === 'waiting' && <button onClick={startSession} className="btn-success" style={{ padding: '10px 20px' }}>▶ Spustit session</button>}
            {session.status === 'active' && <button onClick={endSession} className="btn-danger" style={{ padding: '10px 20px' }}>⏹ Ukončit</button>}
            {session.status === 'active' && session.currentModule && (
              <button onClick={() => router.push(`/session/${id}/module/${session.currentModule}`)} style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                ↩ Zpět do modulu
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div className="glass card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px', fontSize: '16px' }}>📱 QR Kód</h2>
            {qrUrl ? <img src={qrUrl} alt="QR" style={{ borderRadius: '12px', width: '180px' }} /> : <div style={{ width: '180px', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }} />}
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/join?code=${session.code}` : ''}
            </p>
          </div>
          <div className="glass card">
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px', fontSize: '16px' }}>👥 Účastníci ({participants.length})</h2>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {participants.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', margin: 0 }}>Čeká se na účastníky...</p>}
              {sortedParticipants.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)', fontSize: '12px', width: '16px' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span style={{ color: '#fff', fontSize: '14px' }}>{p.nickname}</span>
                  </div>
                  
                </div>
              ))}
            </div>
          </div>
          <div className="glass card">
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px', fontSize: '16px' }}>📊 Status</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Status:</span>
                <span style={{ fontWeight: 700, color: session.status === 'active' ? '#34d399' : '#fbbf24' }}>
                  {session.status === 'active' ? '🟢 Aktivní' : '🟡 Čeká'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Účastníků:</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>{participants.length}</span>
              </div>
              {session.status === 'waiting' && (
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '10px', marginTop: '4px' }}>
                  <p style={{ color: '#fbbf24', fontSize: '13px', margin: 0, textAlign: 'center' }}>⚡ Spusťte session aby se účastníci mohli připojit</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {session.status === 'active' && (
          <div className="glass card">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[{ key: 'set', label: '🗂️ Ze sady' }, { key: 'manual', label: '⚡ Manuálně' }].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as 'set' | 'manual')}
                  style={{ padding: '8px 18px', borderRadius: '10px', border: '2px solid', borderColor: tab === t.key ? '#7c3aed' : 'rgba(255,255,255,0.15)', background: tab === t.key ? 'rgba(124,58,237,0.2)' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'set' && (
              <div>
                {sets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 12px' }}>Nemáš žádné připravené sady.</p>
                    <button onClick={() => router.push('/sets')} className="btn-primary" style={{ padding: '10px 20px' }}>🗂️ Vytvořit sadu</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {sets.map(set => (
                        <button key={set.id} onClick={() => setSelectedSet(selectedSet?.id === set.id ? null : set)}
                          style={{ padding: '8px 16px', borderRadius: '10px', border: '2px solid', borderColor: selectedSet?.id === set.id ? '#0891b2' : 'rgba(255,255,255,0.15)', background: selectedSet?.id === set.id ? 'rgba(8,145,178,0.2)' : 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                          🗂️ {set.title} <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>({set.items?.length || 0})</span>
                        </button>
                      ))}
                    </div>
                    {selectedSet && selectedSet.items?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>Klikni na modul pro spuštění:</p>
                          <button onClick={() => launchSet(selectedSet)}
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', border: 'none', borderRadius: '10px', padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                            ▶ Spustit celou sadu ({selectedSet.items.length})
                          </button>
                        </div>
                        {selectedSet.items.map((item, i) => {
                          const m = MODULES.find(mod => mod.type === item.type) || MODULES[0];
                          return (
                            <button key={i} onClick={() => launchModule(item.type, item)}
                              style={{ display: 'flex', alignItems: 'center', gap: '12px', background: `${m.color}15`, border: `1px solid ${m.color}44`, borderRadius: '12px', padding: '14px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = `${m.color}30`}
                              onMouseLeave={e => e.currentTarget.style.background = `${m.color}15`}>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', width: '20px' }}>{i + 1}.</span>
                              <span style={{ fontSize: '20px' }}>{m.icon}</span>
                              <div style={{ flex: 1 }}>
                                <p style={{ color: '#fff', fontWeight: 700, margin: 0, fontSize: '14px' }}>{item.title}</p>
                                <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question}</p>
                              </div>
                              <span style={{ color: m.color, fontSize: '13px', fontWeight: 600 }}>Spustit →</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {tab === 'manual' && (
              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px' }}>Spustit prázdný modul (otázku zadáš při spuštění):</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  {MODULES.map(m => (
                    <button key={m.type} onClick={() => launchModule(m.type)}
                      style={{ background: `${m.color}22`, border: `1px solid ${m.color}44`, borderRadius: '16px', padding: '20px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${m.color}44`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${m.color}22`; e.currentTarget.style.transform = 'none'; }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{m.icon}</div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
