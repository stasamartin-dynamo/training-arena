'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { LibraryItem, ModuleType } from '@/types/library';
import toast from 'react-hot-toast';

const MODULE_TYPES = [
  { type: 'quiz', icon: '❓', label: 'Kvíz' },
  { type: 'vote', icon: '🗳️', label: 'Hlasování' },
  { type: 'scenario', icon: '🎭', label: 'Scénář' },
  { type: 'reflection', icon: '💭', label: 'Reflexe' },
];

const EMPTY_ITEM = {
  type: 'quiz' as ModuleType,
  title: '',
  question: '',
  options: ['', '', '', ''],
  timeLimit: 30,
};

export default function LibraryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'library'),
      where('lektorId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem)));
    });
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_ITEM);
    setShowForm(true);
  };

  const openEdit = (item: LibraryItem) => {
    setEditing(item);
    setForm({ type: item.type, title: item.title, question: item.question, options: [...item.options, '', '', '', ''].slice(0, 4), timeLimit: item.timeLimit });
    setShowForm(true);
  };

  const save = async () => {
    if (!user || !form.title.trim() || !form.question.trim()) return;
    setSaving(true);
    try {
      const data = {
        lektorId: user.uid,
        type: form.type,
        title: form.title.trim(),
        question: form.question.trim(),
        options: form.type === 'reflection' ? [] : form.options.filter(o => o.trim()),
        timeLimit: form.timeLimit,
        updatedAt: Date.now(),
      };
      if (editing) {
        await updateDoc(doc(db, 'library', editing.id), data);
        toast.success('Uloženo!');
      } else {
        await addDoc(collection(db, 'library'), { ...data, createdAt: Date.now() });
        toast.success('Přidáno do knihovny!');
      }
      setShowForm(false);
    } catch { toast.error('Chyba při ukládání'); } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Smazat tuto položku?')) return;
    await deleteDoc(doc(db, 'library', id));
    toast.success('Smazáno');
  };

  const filtered = filterType === 'all' ? items : items.filter(i => i.type === filterType);

  const typeInfo = (type: string) => MODULE_TYPES.find(m => m.type === type) || MODULE_TYPES[0];

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>← Dashboard</button>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '26px', margin: '4px 0 0' }}>📚 Knihovna obsahu</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '14px' }}>{items.length} položek</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => router.push('/sets')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              🗂️ Sady
            </button>
            <button onClick={() => router.push('/library/import')} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              📥 Import z Excelu
            </button>
            <button onClick={openNew} className="btn-primary" style={{ padding: '10px 20px' }}>
              ➕ Nová položka
            </button>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[{ type: 'all', icon: '📋', label: 'Vše' }, ...MODULE_TYPES].map(m => (
            <button key={m.type} onClick={() => setFilterType(m.type)}
              style={{
                padding: '6px 14px', borderRadius: '999px', border: '1px solid',
                borderColor: filterType === m.type ? '#7c3aed' : 'rgba(255,255,255,0.15)',
                background: filterType === m.type ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div className="glass card" style={{ marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 20px' }}>{editing ? '✏️ Upravit' : '➕ Nová položka'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {MODULE_TYPES.map(m => (
                  <button key={m.type} onClick={() => setForm(f => ({ ...f, type: m.type as ModuleType }))}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: '2px solid',
                      borderColor: form.type === m.type ? '#7c3aed' : 'rgba(255,255,255,0.15)',
                      background: form.type === m.type ? 'rgba(124,58,237,0.2)' : 'transparent',
                      color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    }}>{m.icon} {m.label}</button>
                ))}
              </div>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Název (interní popis, např. 'Scénář - náročný klient')"
                className="input-field" />
              <textarea value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                placeholder={form.type === 'reflection' ? 'Otázka pro reflexi (např. Co si odnášíš?)' : form.type === 'scenario' ? 'Popiš situaci/scénář...' : 'Zadej otázku...'}
                rows={3} className="input-field" />
              {form.type !== 'reflection' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Možnosti odpovědí</label>
                  {form.options.map((opt, i) => (
                    <input key={i} value={opt}
                      onChange={e => { const n = [...form.options]; n[i] = e.target.value; setForm(f => ({ ...f, options: n })); }}
                      placeholder={`Možnost ${String.fromCharCode(65 + i)}`} className="input-field" />
                  ))}
                </div>
              )}
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Časový limit</label>
                <select value={form.timeLimit} onChange={e => setForm(f => ({ ...f, timeLimit: Number(e.target.value) }))}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}>
                  <option value={10}>10 sekund</option>
                  <option value={20}>20 sekund</option>
                  <option value={30}>30 sekund</option>
                  <option value={60}>60 sekund</option>
                  <option value={0}>Bez limitu</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={save} disabled={saving || !form.title.trim() || !form.question.trim()} className="btn-primary" style={{ padding: '12px 24px' }}>
                  {saving ? 'Ukládám...' : '💾 Uložit'}
                </button>
                <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer' }}>
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {filtered.length === 0 && !showForm && (
          <div className="glass card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Knihovna je prázdná. Přidej první položku!</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(item => {
            const t = typeInfo(item.type);
            return (
              <div key={item.id} className="glass" style={{ borderRadius: '16px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>{t.icon}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>{t.label}</span>
                  </div>
                  <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 4px', fontSize: '15px' }}>{item.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question}</p>
                  {item.options.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.options.map((o, i) => (
                        <span key={i} style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>{o}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => openEdit(item)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>✏️</button>
                  <button onClick={() => remove(item.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
