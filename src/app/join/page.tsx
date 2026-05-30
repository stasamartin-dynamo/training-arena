'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function JoinPage() {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [step, setStep] = useState<'code' | 'nickname'>('code');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      if (snap.empty) {
        toast.error('Session nenalezena nebo již skončila');
        return;
      }
      setSessionId(snap.docs[0].id);
      setStep('nickname');
    } catch {
      toast.error('Chyba při hledání session');
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      const { addDoc, collection: col } = await import('firebase/firestore');
      await addDoc(col(db, 'sessions', sessionId, 'participants'), {
        nickname: nickname.trim(),
        sessionId,
        score: 0,
        joinedAt: Date.now(),
      });
      localStorage.setItem('nickname', nickname.trim());
      localStorage.setItem('sessionId', sessionId);
      router.push(`/play/${sessionId}`);
    } catch {
      toast.error('Chyba při připojování');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-2">🏟️ Training Arena</h1>
          <p className="text-purple-200 text-lg">Připojit se ke školení</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          {step === 'code' ? (
            <div className="space-y-4">
              <h2 className="text-white font-bold text-xl text-center">Zadej kód školení</h2>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="např. AB12"
                maxLength={6}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400 text-center text-3xl font-mono font-bold tracking-widest"
                onKeyDown={(e) => e.key === 'Enter' && findSession()}
              />
              <button
                onClick={findSession}
                disabled={loading || !code.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50"
              >
                {loading ? 'Hledám...' : 'Najít školení'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-white font-bold text-xl text-center">Jak se jmenuješ?</h2>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Tvoje přezdívka"
                maxLength={20}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400 text-center text-2xl font-bold"
                onKeyDown={(e) => e.key === 'Enter' && joinSession()}
              />
              <button
                onClick={joinSession}
                disabled={loading || !nickname.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50"
              >
                {loading ? 'Připojuji...' : '🚀 Vstoupit do arény!'}
              </button>
              <button
                onClick={() => setStep('code')}
                className="w-full text-purple-300 py-2 text-sm hover:text-white transition-all"
              >
                ← Zpět
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
