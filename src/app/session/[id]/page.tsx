'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc } from 'firebase/firestore';
import { Session, Participant } from '@/types';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

export default function SessionPage() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'sessions', id as string), (snap) => {
      if (snap.exists()) setSession({ id: snap.id, ...snap.data() } as Session);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(collection(db, 'sessions', id as string, 'participants'), (snap) => {
      setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const joinUrl = `${window.location.origin}/join?code=${session?.code}`;
    QRCode.toDataURL(joinUrl, { width: 200, margin: 2 })
      .then(setQrUrl)
      .catch(console.error);
  }, [id, session?.code]);

  const startSession = async () => {
    await updateDoc(doc(db, 'sessions', id as string), { status: 'active' });
    toast.success('Session spuštěna!');
  };

  const endSession = async () => {
    await updateDoc(doc(db, 'sessions', id as string), { status: 'finished' });
    toast.success('Session ukončena');
  };

  const launchModule = async (type: string) => {
    const moduleRef = await addDoc(collection(db, 'sessions', id as string, 'modules'), {
      type,
      status: 'active',
      createdAt: Date.now(),
      data: {},
    });
    await updateDoc(doc(db, 'sessions', id as string), { currentModule: moduleRef.id });
    setActiveModule(moduleRef.id);
    router.push(`/session/${id}/module/${moduleRef.id}?type=${type}`);
  };

  if (!session) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="text-white text-xl">Načítání...</div>
    </div>
  );

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button onClick={() => router.push('/dashboard')} className="text-purple-300 hover:text-white text-sm mb-1">← Dashboard</button>
            <h1 className="text-3xl font-black text-white">{session.title}</h1>
            <p className="text-purple-300">Kód: <span className="font-mono font-bold text-2xl text-white">{session.code}</span></p>
          </div>
          <div className="flex gap-3">
            {session.status === 'waiting' && (
              <button onClick={startSession} className="bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-all">
                ▶ Spustit
              </button>
            )}
            {session.status === 'active' && (
              <button onClick={endSession} className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 transition-all">
                ⏹ Ukončit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 flex flex-col items-center">
            <h2 className="text-white font-bold mb-3">📱 QR Kód</h2>
            {qrUrl && <img src={qrUrl} alt="QR" className="rounded-xl" />}
            <p className="text-purple-300 text-xs mt-2 text-center">{joinUrl}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
            <h2 className="text-white font-bold mb-3">👥 Účastníci ({participants.length})</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {participants.length === 0 && <p className="text-purple-300 text-sm">Čeká se na účastníky...</p>}
              {participants.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2">
                  <span className="text-white text-sm">{p.nickname}</span>
                  <span className="text-yellow-300 text-sm font-bold">{p.score} b</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
            <h2 className="text-white font-bold mb-3">📊 Status</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-purple-300">Status:</span>
                <span className={`font-bold ${session.status === 'active' ? 'text-green-400' : session.status === 'finished' ? 'text-gray-400' : 'text-yellow-400'}`}>
                  {session.status === 'active' ? '🟢 Aktivní' : session.status === 'finished' ? '⚫ Ukončená' : '🟡 Čeká'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">Účastníků:</span>
                <span className="text-white font-bold">{participants.length}</span>
              </div>
            </div>
          </div>
        </div>

        {session.status === 'active' && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h2 className="text-white font-bold text-xl mb-4">🎯 Spustit modul</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { type: 'quiz', icon: '❓', label: 'Kvíz' },
                { type: 'vote', icon: '🗳️', label: 'Hlasování' },
                { type: 'scenario', icon: '🎭', label: 'Scénář' },
                { type: 'gamification', icon: '🏆', label: 'Gamifikace' },
                { type: 'reflection', icon: '💭', label: 'Reflexe' },
              ].map(m => (
                <button
                  key={m.type}
                  onClick={() => launchModule(m.type)}
                  className="bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-white/20 text-white rounded-xl p-4 hover:from-purple-500/50 hover:to-pink-500/50 transition-all text-center"
                >
                  <div className="text-3xl mb-1">{m.icon}</div>
                  <div className="font-bold text-sm">{m.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
