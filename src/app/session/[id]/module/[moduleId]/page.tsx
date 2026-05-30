'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, addDoc, collection, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

export default function ModulePage() {
  const { id, moduleId } = useParams();
  const searchParams = useSearchParams();
  const type = searchParams.get('type');
  const { user } = useAuth();
  const router = useRouter();

  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const [answers, setAnswers] = useState<{nickname: string, answer: string}[]>([]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [timeLimit, setTimeLimit] = useState(30);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const isLektor = !!user;

  useEffect(() => {
    if (!id || !moduleId) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string, 'modules', moduleId as string), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setModuleData(data);
        if (data.started) setStarted(true);
        if (data.showResults) setShowResults(true);
      }
    });
    return unsub;
  }, [id, moduleId]);

  useEffect(() => {
    if (!id || !moduleId) return;
    const unsub = onSnapshot(collection(db, 'sessions', id as string, 'modules', moduleId as string, 'answers'), (snap) => {
      setAnswers(snap.docs.map(d => d.data() as {nickname: string, answer: string}));
    });
    return unsub;
  }, [id, moduleId]);

  useEffect(() => {
    if (started && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [started, timeLeft]);

  const startModule = async () => {
    const filteredOptions = options.filter(o => o.trim());
    await updateDoc(doc(db, 'sessions', id as string, 'modules', moduleId as string), {
      question,
      options: filteredOptions,
      timeLimit,
      started: true,
      startedAt: Date.now(),
      showResults: false,
    });
    setTimeLeft(timeLimit);
    toast.success('Modul spuštěn!');
  };

  const revealResults = async () => {
    await updateDoc(doc(db, 'sessions', id as string, 'modules', moduleId as string), {
      showResults: true,
      status: 'finished',
    });
    await updateDoc(doc(db, 'sessions', id as string), { currentModule: null });
  };

  const submitAnswer = async (ans: string) => {
    if (answered) return;
    const nickname = localStorage.getItem('nickname') || 'Anonym';
    setUserAnswer(ans);
    setAnswered(true);
    await addDoc(collection(db, 'sessions', id as string, 'modules', moduleId as string, 'answers'), {
      nickname,
      answer: ans,
      answeredAt: Date.now(),
    });
    toast.success('Odpověď odeslána! ✅');
  };

  const getChartData = () => {
    const opts = (moduleData.options as string[]) || [];
    return opts.map(opt => ({
      name: opt,
      count: answers.filter(a => a.answer === opt).length,
    }));
  };

  const moduleTitle = type === 'quiz' ? '❓ Kvíz' : type === 'vote' ? '🗳️ Hlasování' :
    type === 'scenario' ? '🎭 Scénář' : type === 'reflection' ? '💭 Reflexe' : '🏆 Gamifikace';

  if (isLektor) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <button onClick={() => router.push(`/session/${id}`)} className="text-purple-300 hover:text-white text-sm mb-1">← Session</button>
              <h1 className="text-2xl font-black text-white">{moduleTitle}</h1>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-2 text-white font-bold">
              👥 {answers.length} odpovědí
            </div>
          </div>

          {!started ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 space-y-4">
              <h2 className="text-white font-bold text-lg">Nastavení {moduleTitle}</h2>
              <div>
                <label className="text-purple-300 text-sm block mb-1">Otázka / Situace</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Zadej otázku nebo popis situace..."
                  rows={3}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>
              <div>
                <label className="text-purple-300 text-sm block mb-2">Možnosti odpovědí</label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <input
                      key={i}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                      }}
                      placeholder={`Možnost ${i + 1}`}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-purple-300 text-sm block mb-1">Časový limit (sekund)</label>
                <select
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white focus:outline-none"
                >
                  <option value={10}>10 sekund</option>
                  <option value={20}>20 sekund</option>
                  <option value={30}>30 sekund</option>
                  <option value={60}>60 sekund</option>
                  <option value={0}>Bez limitu</option>
                </select>
              </div>
              <button
                onClick={startModule}
                disabled={!question.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50"
              >
                ▶ Spustit
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <h2 className="text-white font-bold text-xl mb-2">{moduleData.question as string}</h2>
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Odpovědí: {answers.length}</span>
                  {!showResults && (
                    <button onClick={revealResults} className="bg-green-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-green-600">
                      Zobrazit výsledky
                    </button>
                  )}
                </div>
              </div>

              {showResults && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                  <h3 className="text-white font-bold mb-4">📊 Výsledky</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={getChartData()}>
                      <XAxis dataKey="name" tick={{ fill: '#c4b5fd' }} />
                      <YAxis tick={{ fill: '#c4b5fd' }} />
                      <Tooltip contentStyle={{ background: '#1e1b4b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                      <Bar dataKey="count" radius={[8,8,0,0]}>
                        {getChartData().map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Participant view
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {!started ? (
          <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-white font-bold text-xl">Lektor připravuje aktivitu...</p>
          </div>
        ) : showResults ? (
          <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-white font-bold text-xl mb-2">Výsledky jsou na plátně!</p>
            <p className="text-purple-300">Tvá odpověď: <span className="text-white font-bold">{userAnswer}</span></p>
          </div>
        ) : answered ? (
          <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-white font-bold text-xl">Odpověď odeslána!</p>
            <p className="text-purple-300 mt-2">Čekáme na ostatní...</p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 space-y-4">
            <h2 className="text-white font-bold text-xl">{moduleData.question as string}</h2>
            <div className="space-y-3">
              {((moduleData.options as string[]) || []).map((opt, i) => (
                <button
                  key={i}
                  onClick={() => submitAnswer(opt)}
                  style={{ borderColor: COLORS[i % COLORS.length] }}
                  className="w-full bg-white/10 border-2 text-white py-4 rounded-xl font-medium text-left px-4 hover:bg-white/20 transition-all"
                >
                  <span className="font-bold mr-2" style={{ color: COLORS[i % COLORS.length] }}>
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
