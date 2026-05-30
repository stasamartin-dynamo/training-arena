'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { Session } from '@/types';

export default function PlayPage() {
  const { id } = useParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNickname] = useState('');
  const [currentModule, setCurrentModule] = useState<{id: string, type: string} | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('nickname');
    if (!saved) { router.push('/join'); return; }
    setNickname(saved);
  }, [router]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string), async (snap) => {
      if (!snap.exists()) return;
      const s = { id: snap.id, ...snap.data() } as Session;
      setSession(s);

      if (s.currentModule) {
        const modDoc = await getDocs(
          query(collection(db, 'sessions', id as string, 'modules'),
          where('status', '==', 'active'), limit(1))
        );
        if (!modDoc.empty) {
          const mod = modDoc.docs[0];
          setCurrentModule({ id: mod.id, type: mod.data().type });
        }
      } else {
        setCurrentModule(null);
      }
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (currentModule) {
      router.push(`/play/${id}/module/${currentModule.id}?type=${currentModule.type}`);
    }
  }, [currentModule, id, router]);

  if (!session) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="text-white text-xl">Načítání...</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          <div className="text-6xl mb-4">🏟️</div>
          <h1 className="text-3xl font-black text-white mb-2">Training Arena</h1>
          <p className="text-purple-300 mb-6">{session.title}</p>

          <div className="bg-white/10 rounded-xl p-4 mb-6">
            <p className="text-purple-300 text-sm">Přihlášen jako</p>
            <p className="text-white font-bold text-2xl">{nickname}</p>
          </div>

          {session.status === 'waiting' && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce mx-1" style={{animationDelay: '0ms'}}></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce mx-1" style={{animationDelay: '150ms'}}></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce mx-1" style={{animationDelay: '300ms'}}></div>
              </div>
              <p className="text-yellow-300 font-medium">Čekáme na lektora...</p>
              <p className="text-purple-400 text-sm">Lektor brzy spustí školení</p>
            </div>
          )}

          {session.status === 'active' && !currentModule && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse mx-1"></div>
              </div>
              <p className="text-green-300 font-medium">Školení probíhá</p>
              <p className="text-purple-400 text-sm">Čekej na další aktivitu...</p>
            </div>
          )}

          {session.status === 'finished' && (
            <div className="space-y-3">
              <p className="text-4xl">🎉</p>
              <p className="text-white font-bold text-xl">Školení skončilo!</p>
              <p className="text-purple-300">Děkujeme za účast</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
