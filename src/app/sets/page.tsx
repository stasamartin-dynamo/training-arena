'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { LibraryItem, TrainingSet, ModuleType } from '@/types/library';
import toast from 'react-hot-toast';

const MODULE_TYPES = [
  { type: 'quiz', icon: '❓', label: 'Kvíz' },
  { type: 'vote', icon: '🗳️', label: 'Hlasování' },
  { type: 'scenario', icon: '🎭', label: 'Scénář' },
  { type: 'reflection', icon: '💭', label: 'Reflexe' },
];

export default function SetsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sets, setSets] = useState<TrainingSet[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TrainingSet | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<LibraryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedSet, setExpandedSet] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'sets'), where('lektorId', '==', user.uid), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snap => setSets(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingSet))));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'library'), where('lektorId', '==', user.uid), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snap => setLibrary(snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem))));
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setSelectedItems([]);
    setShowForm(true);
  };

  const openEdit = (set: TrainingSet) => {
    setEditing(set);
    setTitle(set.title);
    setDescription(set.description);
    setSelectedItems(set.items || []);
    setShowForm(true);
  };

  const toggleItem = (item: LibraryItem) => {
    setSelectedItems(prev =>
      prev.find(i => i.id === item.id)
        ? prev.filter(i => i.id !== item.id)
        : [...prev, item]
    );
  };

  const moveItem = (index: number, dir: 'up' | 'down') => {
    const newItems = [...selectedItems];
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= newItems.length) return;
    [newItems[index], newItems[swap]] = [newItems[swap], newItems[index]];
    setSelectedItems(newItems);
  };

  const save = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const data = {
        lektorId: user.uid,
        title: title.trim(),
        description: description.trim(),
        items: selectedItems,
        updatedAt: Date.now(),
      };
      if (editing) {
        await updateDoc(doc(db, 'sets', editing.id), data);
        toast.success('Sada uložena!');
      } else {
        await addDoc(collection(db, 'sets'), { ...data, createdAt: Date.now() });
        toast.success('Sada vytvořena!');
      }
      setShowForm(false);
    } catch { toast.error('Chyba při ukládání'); } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Smazat tuto sadu?')) return;
    await deleteDoc(doc(db, 'sets', id));
    toast.success('Smazáno');
  };

  const typeInfo = (type: string) => MODULE_TYPES.find(m => m.type === type) || MODULE_TYPES[0];

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>← Dashboard</button>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '26px', margin: '4px 0 0' }}>🗂️ Sady školení</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '14px' }}>{sets.length} sad</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => router.push('/library')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              📚 Knihovna
            </button>
            <button onClick={openNew} className="btn-primary" style={{ padding: '10px 20px' }}>
              ➕ Nová sada
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="glass card" style={{ marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 20px' }}>{editing ? '✏️ Upravit sadu' : '➕ Nová sada'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Název sady (např. Obchodní dovednosti - základy)"
                className="input-field" />
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Popis (volitelný)"
                rows={2} className="input-field" />

              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '10px' }}>
                  Vyber moduly z knihovny ({selectedItems.length} vybráno):
                </label>
                {library.length === 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>Knihovna je prázdná. <button onClick={() => router.push('/library')} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', textDecoration: 'underline' }}>Přidej položky</button></p>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                  {library.map(item => {
                    const t = typeInfo(item.type);
                    const selected = !!selectedItems.find(i => i.id === item.id);
                    return (
                      <div key={item.id} onClick={() => toggleItem(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: selected ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${selected ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selected ? '#7c3aed' : 'rgba(255,255,255,0.3)'}`, background: selected ? '#7c3aed' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selected && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '16px' }}>{t.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: '#fff', fontWeight: 600, margin: 0, fontSize: '14px' }}>{item.title}</p>
                          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order selected */}
              {selectedItems.length > 0 && (
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Pořadí modulů:</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedItems.map((item, i) => {
                      const t = typeInfo(item.type);
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 12px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', width: '20px' }}>{i + 1}.</span>
                          <span>{t.icon}</span>
                          <span style={{ color: '#fff', fontSize: '13px', flex: 1 }}>{item.title}</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => moveItem(i, 'up')} disabled={i === 0} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                            <button onClick={() => moveItem(i, 'down')} disabled={i === selectedItems.length - 1} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', opacity: i === selectedItems.length - 1 ? 0.3 : 1 }}>↓</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={save} disabled={saving || !title.trim()} className="btn-primary" style={{ padding: '12px 24px' }}>
                  {saving ? 'Ukládám...' : '💾 Uložit sadu'}
                </button>
                <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer' }}>
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sets list */}
        {sets.length === 0 && !showForm && (
          <div className="glass card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗂️</div>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Žádné sady. Vytvoř první!</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sets.map(set => (
            <div key={set.id} className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedSet(expandedSet === set.id ? null : set.id)}>
                  <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 4px', fontSize: '16px' }}>{set.title}</h3>
                  {set.description && <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', fontSize: '13px' }}>{set.description}</p>}
                  <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '12px' }}>{set.items?.length || 0} modulů · {expandedSet === set.id ? '▲ skrýt' : '▼ zobrazit'}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => openEdit(set)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>✏️</button>
                  <button onClick={() => remove(set.id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
                </div>
              </div>
              {expandedSet === set.id && set.items?.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {set.items.map((item, i) => {
                    const t = typeInfo(item.type);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', width: '20px' }}>{i + 1}.</span>
                        <span>{t.icon}</span>
                        <div>
                          <p style={{ color: '#fff', margin: 0, fontSize: '13px', fontWeight: 600 }}>{item.title}</p>
                          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '12px' }}>{item.question}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
