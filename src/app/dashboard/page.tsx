'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
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
    if (!user) return;
    const q = query(
      collection(db, 'sessions'),
      where('lektorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
    });
    return unsub;
  }, [user]);

  const createSession = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const code = generateCode();
      const docRef = await addDoc(collection(db, 'sessions'), {
        code,
        lektorId: user.uid,
        lektorName: user.email,
        title: title.trim(),
        status: 'waiting',
        currentModule: null,
        createdAt: Date.now(),
      });
      toast.success(`Session vytvořena! Kód: ${code}`);
      setTitle('');
      router.push(`/session/${docRef.id}`);
    } catch {
      toast.error('Chyba při vytváření session');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="text-white text-xl">Načítání...</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">🏟️ Training Arena</h1>
            <p className="text-purple-300">{user?.email}</p>
          </div>
          <button
            onClick={logOut}
            className="bg-white/10 text-white px-4 py-2 rounded-xl hover:bg-white/20 transition-all"
          >
            Odhlásit
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4">➕ Nová session</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Název školení (např. Obchodní dovednosti)"
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300 focus:outline-none focus:border-purple-400"
              onKeyDown={(e) => e.key === 'Enter' && createSession()}
            />
            <button
              onClick={createSession}
              disabled={creating || !title.trim()}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {creating ? '...' : 'Vytvořit'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold text-white">📋 Moje sessions</h2>
          {sessions.length === 0 && (
            <div className="bg-white/10 rounded-2xl p-8 text-center text-purple-300">
              Zatím žádné sessions. Vytvořte první!
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => router.push(`/session/${session.id}`)}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 cursor-pointer hover:bg-white/20 transition-all"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-white font-bold text-lg">{session.title}</h3>
                  <p className="text-purple-300 text-sm">Kód: <span className="font-mono font-bold text-purple-200">{session.code}</span></p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  session.status === 'active' ? 'bg-green-500/20 text-green-300' :
                  session.status === 'finished' ? 'bg-gray-500/20 text-gray-300' :
                  'bg-yellow-500/20 text-yellow-300'
                }`}>
                  {session.status === 'active' ? '🟢 Aktivní' :
                   session.status === 'finished' ? '⚫ Ukončená' : '🟡 Čeká'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
