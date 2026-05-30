'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, addDoc, collection } from 'firebase/firestore';
import toast from 'react-hot-toast';

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

export default function PlayModulePage() {
  const { id, moduleId } = useParams();
  const searchParams = useSearchParams();
  const type = searchParams.get('type');
  const router = useRouter();

  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [openAnswer, setOpenAnswer] = useState('');

  useEffect(() => {
    if (!id || !moduleId) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string, 'modules', moduleId as string), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setModuleData(data);
        if (data.showResults) setShowResults(true);
        if (data.status === 'finished' && !data.showResults) {
          router.push(`/play/${id}`);
        }
      }
    });
    return unsub;
  }, [id, moduleId, router]);

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

  const submitOpen = async () => {
    if (!openAnswer.trim()) return;
    await submitAnswer(openAnswer.trim());
  };

  if (!moduleData.started) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="text-5xl mb-4">⏳</div>
          <p className="text-white font-bold text-xl">Lektor připravuje aktivitu...</p>
        </div>
      </main>
    );
  }

  if (showResults) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 w-full max-w-md">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-white font-bold text-xl mb-2">Výsledky jsou na plátně!</p>
          {userAnswer && <p className="text-purple-300">Tvá odpověď: <span className="text-white font-bold">{userAnswer}</span></p>}
          <button onClick={() => router.push(`/play/${id}`)} className="mt-4 bg-purple-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-purple-600">
            Zpět do čekárny
          </button>
        </div>
      </main>
    );
  }

  if (answered) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-white font-bold text-xl">Odpověď odeslána!</p>
          <p className="text-purple-300 mt-2">Čekáme na ostatní...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 space-y-4">
          <div className="text-center">
            <span className="text-purple-300 text-sm uppercase tracking-wider">
              {type === 'quiz' ? '❓ Kvíz' : type === 'vote' ? '🗳️ Hlasování' : type === 'scenario' ? '🎭 Scénář' : '💭 Reflexe'}
            </span>
          </div>
          <h2 className="text-white font-bold text-xl">{moduleData.question as string}</h2>

          {type === 'reflection' ? (
            <div className="space-y-3">
              <textarea
                value={openAnswer}
                onChange={(e) => setOpenAnswer(e.target.value)}
                placeholder="Napiš svou odpověď..."
                rows={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400 resize-none"
              />
              <button
                onClick={submitOpen}
                disabled={!openAnswer.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
              >
                Odeslat
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </main>
  );
}
