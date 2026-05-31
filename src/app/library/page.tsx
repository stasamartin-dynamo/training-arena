'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { LibraryItem, ModuleType } from '@/types/library';
import toast from 'react-hot-toast';

const MODULE_TYPES = [
  { type: 'quiz', icon: '❓', label: 'Kvíz', color: '#7c3aed' },
  { type: 'vote', icon: '🗳️', label: 'Hlasování', color: '#0891b2' },
  { type: 'scenario', icon: '🎭', label: 'Scénář', color: '#db2777' },
  { type: 'reflection', icon: '💭', label: 'Reflexe', color: '#059669' },
];

const EMPTY_ITEM = {
  type: 'quiz' as ModuleType,
  title: '',
  question: '',
  options: ['', '', '', ''],
  timeLimit: 30,
  correctAnswer: '',
  points: 100,
};

export default function LibraryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('library_cache');
        return cached ? JSON.parse(cached) : [];
      } catch { return []; }
    }
    return [];
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'folders' | 'all'>('folders');

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
  }, [user?.uid]);

  // Group items by folder (setName field, or 'Bez složky')
  const folders = (() => {
    const map = new Map<string, LibraryItem[]>();
    items.forEach(item => {
      const folder = (item as LibraryItem & { setName?: string }).setName || 'Bez složky';
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(item);
    });
    return map;
  })();

  const toggleFolder = (name: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_ITEM);
    setShowForm(true);
  };

  const openEdit = (item: LibraryItem) => {
    setEditing(item);
    setForm({ type: item.type, title: item.title, question: item.question, options: [...item.options, '', '', '', ''].slice(0, 4), timeLimit: item.timeLimit, correctAnswer: item.correctAnswer || '', points: item.points ?? 100 });
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
        correctAnswer: form.correctAnswer || '',
        points: form.points ?? 100,
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

  const removeFolder = async (folderName: string, folderItems: LibraryItem[]) => {
    if (!confirm(`Smazat celou složku "${folderName}" (${folderItems.length} položek)?`)) return;
    try {
      await Promise.all(folderItems.map(item => deleteDoc(doc(db, 'library', item.id))));
      toast.success(`Složka "${folderName}" smazána`);
    } catch { toast.error('Chyba při mazání složky'); }
  };

  const filtered = filterType === 'all' ? items : items.filter(i => i.type === filterType);
  const typeInfo = (type: string) => MODULE_TYPES.find(m => m.type === type) || MODULE_TYPES[0];

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Načítání...</div>;

  const ItemCard = ({ item }: { item: LibraryItem }) => {
    const t = typeInfo(item.type);
    return (
      <div className="glass" style={{ borderRadius: '14px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', borderLeft: `3px solid ${t.color}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontSize: '14px' }}>{t.icon}</span>
            <span style={{ color: t.color, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{t.label}</span>
          </div>
          <h3 style={{ color: '#fff', fontWeight: 700, margin: '0 0 3px', fontSize: '14px' }}>{item.title}</h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0 0 6px', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question}</p>
          {item.options.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {item.options.map((o, i) => (
                <span key={i} style={{ background: `${t.color}22`, color: t.color, padding: '2px 7px', borderRadius: '5px', fontSize: '11px' }}>
                  {String.fromCharCode(65 + i)}: {o.length > 20 ? o.slice(0, 20) + '…' : o}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => openEdit(item)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>✏️</button>
          <button onClick={() => remove(item.id)} style={{ background: 'rgba(239,68,68,0.12)', border: 'none', color: '#f87171', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
        </div>
      </div>
    );
  };

  return (
    <main className='app-bg' style={{ minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>← Dashboard</button>
            <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '26px', margin: '4px 0 0' }}>📚 Knihovna obsahu</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '14px' }}>{items.length} položek · {folders.size} složek</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/sets')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              🗂️ Sady
            </button>
            <button onClick={() => router.push('/library/import')} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              📥 Import
            </button>
            <button onClick={openNew} className="btn-primary" style={{ padding: '10px 20px' }}>
              ➕ Nová
            </button>
          </div>
        </div>

        {/* View toggle + filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setView('folders')}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid', borderColor: view === 'folders' ? '#7c3aed' : 'rgba(255,255,255,0.15)', background: view === 'folders' ? 'rgba(124,58,237,0.2)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              📁 Složky
            </button>
            <button onClick={() => setView('all')}
              style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid', borderColor: view === 'all' ? '#7c3aed' : 'rgba(255,255,255,0.15)', background: view === 'all' ? 'rgba(124,58,237,0.2)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              📋 Vše
            </button>
          </div>
          {view === 'all' && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[{ type: 'all', icon: '📋', label: 'Vše' }, ...MODULE_TYPES].map(m => (
                <button key={m.type} onClick={() => setFilterType(m.type)}
                  style={{ padding: '5px 12px', borderRadius: '999px', border: '1px solid', borderColor: filterType === m.type ? '#7c3aed' : 'rgba(255,255,255,0.15)', background: filterType === m.type ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="glass card" style={{ marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 20px' }}>{editing ? '✏️ Upravit' : '➕ Nová položka'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {MODULE_TYPES.map(m => (
                  <button key={m.type} onClick={() => setForm(f => ({ ...f, type: m.type as ModuleType }))}
                    style={{ padding: '8px 16px', borderRadius: '10px', border: '2px solid', borderColor: form.type === m.type ? '#7c3aed' : 'rgba(255,255,255,0.15)', background: form.type === m.type ? 'rgba(124,58,237,0.2)' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Název (interní popis)" className="input-field" />
              <textarea value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                placeholder={form.type === 'reflection' ? 'Otázka pro reflexi...' : form.type === 'scenario' ? 'Popiš situaci/scénář...' : 'Zadej otázku...'}
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
              {form.type !== 'reflection' && form.type !== 'vote' && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>✅ Správná odpověď</label>
                    <select value={form.correctAnswer} onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none' }}>
                      <option value="">— žádná (hlasování) —</option>
                      {form.options.filter(o => o.trim()).map((o, i) => (
                        <option key={i} value={o}>{String.fromCharCode(65+i)}: {o.length > 40 ? o.slice(0,40)+'…' : o}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ minWidth: '120px' }}>
                    <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>🏆 Body za správnou</label>
                    <input type="number" value={form.points} min={0} max={1000} step={10}
                      onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))}
                      className="input-field" style={{ width: '100%' }} />
                  </div>
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

        {/* Folder view */}
        {view === 'folders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.length === 0 && !showForm && (
              <div className="glass card" style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>Knihovna je prázdná. Importuj Excel nebo přidej položku!</p>
              </div>
            )}
            {Array.from(folders.entries()).map(([folderName, folderItems]) => {
              const isOpen = openFolders.has(folderName);
              const typesCounts = folderItems.reduce((acc, item) => {
                acc[item.type] = (acc[item.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              return (
                <div key={folderName}>
                  {/* Folder header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => toggleFolder(folderName)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: isOpen ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isOpen ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: isOpen ? '16px 16px 0 0' : '16px', padding: '14px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                    <span style={{ fontSize: '20px' }}>{isOpen ? '📂' : '📁'}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{folderName}</span>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {Object.entries(typesCounts).map(([type, count]) => {
                          const t = typeInfo(type);
                          return (
                            <span key={type} style={{ background: `${t.color}22`, color: t.color, padding: '1px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
                              {t.icon} {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{folderItems.length} položek</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
                  </button>
                  <button onClick={() => removeFolder(folderName, folderItems)}
                    style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>
                    🗑️
                  </button>
                  </div>
                  {/* Folder contents */}
                  {isOpen && (
                    <div style={{ border: '1px solid rgba(124,58,237,0.3)', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(124,58,237,0.05)' }}>
                      {folderItems.map(item => <ItemCard key={item.id} item={item} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All view */}
        {view === 'all' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.length === 0 && !showForm && (
              <div className="glass card" style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>Žádné položky</p>
              </div>
            )}
            {filtered.map(item => <ItemCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </main>
  );
}
