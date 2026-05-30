'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, addDoc, collection, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

const COLORS = ['#7c3aed', '#db2777', '#0891b2', '#059669', '#d97706', '#dc2626'];
const TEAM_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706'];
const TEAM_NAMES = ['Tým Alfa', 'Tým Beta', 'Tým Gama', 'Tým Delta'];

interface Answer { nickname: string; answer: string; answeredAt: number; teamId?: string; }
interface Team { id: string; name: string; color: string; score: number; memberIds: string[]; }

function ModuleContent() {
  const { id, moduleId } = useParams();
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || '';
  const { user } = useAuth();
  const router = useRouter();

  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [timeLimit, setTimeLimit] = useState(30);
  const [started, setStarted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<{id: string; nickname: string; score: number}[]>([]);

  useEffect(() => {
    if (!id || !moduleId) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string, 'modules', moduleId as string), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setModuleData(data);
      if (data.started) setStarted(true);
      if (data.showResults) setShowResults(true);
      if (data.teams) setTeams(data.teams as Team[]);
      if (data.question && !started) setQuestion(data.question as string);
      if (data.options && !started) setOptions(data.options as string[]);
      if (data.timeLimit && !started) setTimeLimit(data.timeLimit as number);
    });
    return unsub;
  }, [id, moduleId]);

  useEffect(() => {
    if (!id || !moduleId) return;
    const unsub = onSnapshot(collection(db, 'sessions', id as string, 'modules', moduleId as string, 'answers'), snap => {
      setAnswers(snap.docs.map(d => d.data() as Answer));
    });
    return unsub;
  }, [id, moduleId]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(collection(db, 'sessions', id as string, 'participants'), snap => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as {id: string; nickname: string; score: number})));
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (started && timeLeft > 0) {
      const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
      return () => clearTimeout(t);
    }
    if (started && timeLeft === 0 && (moduleData.timeLimit as number) > 0) {
      // auto reveal
    }
  }, [started, timeLeft, moduleData.timeLimit]);

  const startModule = async () => {
    const filteredOptions = type === 'reflection' ? [] : options.filter(o => o.trim());
    await updateDoc(doc(db, 'sessions', id as string, 'modules', moduleId as string), {
      question, options: filteredOptions, timeLimit,
      started: true, startedAt: Date.now(), showResults: false,
    });
    setTimeLeft(timeLimit);
    toast.success('Modul spuštěn!');
  };

  const setupTeams = async () => {
    const newTeams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
      id: `team_${i}`, name: TEAM_NAMES[i], color: TEAM_COLORS[i], score: 0, memberIds: [],
    }));
    // Assign participants to teams randomly
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, i) => {
      newTeams[i % teamCount].memberIds.push(p.id);
    });
    setTeams(newTeams);
    await updateDoc(doc(db, 'sessions', id as string, 'modules', moduleId as string), {
      teams: newTeams, started: true, question: question || 'Týmová soutěž',
      options: options.filter(o => o.trim()), timeLimit,
    });
    // Update participant teamIds
    for (const team of newTeams) {
      for (const pId of team.memberIds) {
        await updateDoc(doc(db, 'sessions', id as string, 'participants', pId), { teamId: team.id });
      }
    }
    toast.success('Týmy vytvořeny!');
  };

  const revealResults = async () => {
    await updateDoc(doc(db, 'sessions', id as string, 'modules', moduleId as string), {
      showResults: true, status: 'finished',
    });
    await updateDoc(doc(db, 'sessions', id as string), { currentModule: null });
  };

  const getChartData = useCallback(() => {
    const opts = (moduleData.options as string[]) || [];
    return opts.map(opt => ({
      name: opt.length > 20 ? opt.substring(0, 20) + '...' : opt,
      fullName: opt,
      count: answers.filter(a => a.answer === opt).length,
    }));
  }, [moduleData.options, answers]);

  const getWordCloudData = useCallback(() => {
    const words: Record<string, number> = {};
    answers.forEach(a => {
      const ans = String(a.answer);
      ans.split(/\s+/).forEach(w => {
        if (w.length > 2) words[w.toLowerCase()] = (words[w.toLowerCase()] || 0) + 1;
      });
    });
    return Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [answers]);

  const moduleTitle = { quiz: '❓ Kvíz', vote: '🗳️ Hlasování', scenario: '🎭 Scénář', gamification: '🏆 Gamifikace', reflection: '💭 Reflexe' }[type] || '📋 Modul';

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <button onClick={() => router.push(`/session/${id}`)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>← Session</button>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '24px', margin: '4px 0 0' }}>{moduleTitle}</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {started && !showResults && (
              <div style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: '10px', padding: '8px 16px', color: '#a78bfa', fontWeight: 700 }}>
                👥 {answers.length} odpovědí
              </div>
            )}
            {started && !showResults && (
              <button onClick={revealResults} className="btn-success" style={{ padding: '10px 20px' }}>
                📊 Zobrazit výsledky
              </button>
            )}
          </div>
        </div>

        {/* Setup form (before start) */}
        {!started && type !== 'gamification' && (
          <div className="glass card" style={{ marginBottom: '16px' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 20px', fontSize: '18px' }}>
              Nastavení {moduleTitle}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  {type === 'reflection' ? 'Otázka pro reflexi' : 'Otázka / Situace'}
                </label>
                <textarea
                  value={question} onChange={e => setQuestion(e.target.value)}
                  placeholder={type === 'reflection' ? 'Co si odnášíš z dnešního školení?' : type === 'scenario' ? 'Popiš situaci/scénář...' : 'Zadej otázku...'}
                  rows={3} className="input-field"
                />
              </div>

              {type !== 'reflection' && (
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                    Možnosti odpovědí {type === 'scenario' ? '(reakce na scénář)' : ''}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {options.map((opt, i) => (
                      <input
                        key={i} value={opt}
                        onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                        placeholder={`Možnost ${String.fromCharCode(65 + i)}`}
                        className="input-field"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Časový limit</label>
                <select value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}>
                  <option value={10}>10 sekund</option>
                  <option value={20}>20 sekund</option>
                  <option value={30}>30 sekund</option>
                  <option value={60}>60 sekund</option>
                  <option value={0}>Bez limitu</option>
                </select>
              </div>

              <button onClick={startModule} disabled={!question.trim()} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                ▶ Spustit modul
              </button>
            </div>
          </div>
        )}

        {/* Gamification setup */}
        {!started && type === 'gamification' && (
          <div className="glass card">
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 20px', fontSize: '18px' }}>🏆 Nastavení Gamifikace</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Otázka/výzva</label>
                <textarea value={question} onChange={e => setQuestion(e.target.value)}
                  placeholder="Zadej otázku pro týmovou soutěž..." rows={3} className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {options.map((opt, i) => (
                  <input key={i} value={opt}
                    onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                    placeholder={`Možnost ${String.fromCharCode(65 + i)}`} className="input-field" />
                ))}
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Počet týmů</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[2, 3, 4].map(n => (
                    <button key={n} onClick={() => setTeamCount(n)} style={{
                      padding: '10px 20px', borderRadius: '10px', border: '2px solid',
                      borderColor: teamCount === n ? '#7c3aed' : 'rgba(255,255,255,0.15)',
                      background: teamCount === n ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                      color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '16px',
                    }}>{n} týmy</button>
                  ))}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 8px', fontSize: '13px' }}>Předběžné rozdělení ({participants.length} účastníků):</p>
                {Array.from({ length: teamCount }, (_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: TEAM_COLORS[i] }} />
                    <span style={{ color: '#fff', fontSize: '14px' }}>{TEAM_NAMES[i]}: ~{Math.ceil(participants.length / teamCount)} hráčů</span>
                  </div>
                ))}
              </div>
              <button onClick={setupTeams} disabled={!question.trim() || participants.length === 0} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
                🎲 Rozdělit do týmů a spustit
              </button>
              {participants.length === 0 && <p style={{ color: '#f87171', fontSize: '13px', textAlign: 'center', margin: 0 }}>Čekám na účastníky...</p>}
            </div>
          </div>
        )}

        {/* Active module view */}
        {started && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass card">
              <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 8px', fontSize: '20px' }}>{moduleData.question as string}</h2>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                  {answers.length} / {participants.length} odpovědí
                </span>
                {timeLeft > 0 && (
                  <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '4px 12px', borderRadius: '999px', fontSize: '14px', fontWeight: 700 }}>
                    ⏱ {timeLeft}s
                  </span>
                )}
                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', minWidth: '100px' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    background: 'linear-gradient(90deg, #7c3aed, #db2777)',
                    width: participants.length > 0 ? `${(answers.length / participants.length) * 100}%` : '0%',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            </div>

            {/* Live answers */}
            {type === 'reflection' && answers.length > 0 && (
              <div className="glass card">
                <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px' }}>💬 Odpovědi účastníků</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {answers.map((a, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
                      <p style={{ color: '#a78bfa', fontSize: '12px', margin: '0 0 4px' }}>{a.nickname}</p>
                      <p style={{ color: '#fff', margin: 0, fontSize: '14px' }}>{String(a.answer)}</p>
                    </div>
                  ))}
                </div>
                {/* Word cloud */}
                {showResults && getWordCloudData().length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {getWordCloudData().map(([word, count], i) => (
                      <span key={i} style={{
                        background: `${COLORS[i % COLORS.length]}33`,
                        color: COLORS[i % COLORS.length],
                        padding: '4px 12px', borderRadius: '999px',
                        fontSize: `${Math.min(12 + count * 4, 24)}px`,
                        fontWeight: 700,
                      }}>{word}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chart */}
            {showResults && type !== 'reflection' && getChartData().length > 0 && (
              <div className="glass card">
                <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 20px' }}>📊 Výsledky hlasování</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={getChartData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#1a0533', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }}
                      formatter={(val, _, props) => [val, props.payload.fullName]}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {getChartData().map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Pie chart */}
                <div style={{ marginTop: '16px' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={getChartData()} dataKey="count" nameKey="fullName" cx="50%" cy="50%" outerRadius={80} label>
                        {getChartData().map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend formatter={val => <span style={{ color: '#94a3b8' }}>{val}</span>} />
                      <Tooltip contentStyle={{ background: '#1a0533', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Winner */}
                {getChartData().length > 0 && (() => {
                  const winner = getChartData().reduce((a, b) => a.count > b.count ? a : b);
                  return winner.count > 0 ? (
                    <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginTop: '16px' }}>
                      <p style={{ color: '#fbbf24', fontWeight: 700, margin: 0, fontSize: '18px' }}>
                        🏆 Nejčastější odpověď: "{winner.fullName}" ({winner.count} ×)
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Teams leaderboard */}
            {type === 'gamification' && teams.length > 0 && (
              <div className="glass card">
                <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 16px' }}>🏆 Žebříček týmů</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[...teams].sort((a, b) => b.score - a.score).map((team, i) => (
                    <div key={team.id} style={{
                      background: `${team.color}22`, border: `1px solid ${team.color}44`,
                      borderRadius: '12px', padding: '14px 20px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>{['🥇', '🥈', '🥉', '4️⃣'][i]}</span>
                        <div>
                          <p style={{ color: '#fff', fontWeight: 700, margin: 0 }}>{team.name}</p>
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{team.memberIds.length} hráčů</p>
                        </div>
                      </div>
                      <span style={{ color: team.color, fontWeight: 900, fontSize: '24px' }}>{team.score}</span>
                    </div>
                  ))}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
                  Odpovědi: {answers.length} / {participants.length}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ModulePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>}>
      <ModuleContent />
    </Suspense>
  );
}
