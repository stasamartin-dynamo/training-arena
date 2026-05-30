'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { LibraryItem, ModuleType } from '@/types/library';

const TYPE_MAP: Record<string, ModuleType> = {
  'kvíz': 'quiz', 'kviz': 'quiz', 'quiz': 'quiz',
  'hlasování': 'vote', 'hlasovani': 'vote', 'vote': 'vote', 'anketa': 'vote',
  'scénář': 'scenario', 'scenár': 'scenario', 'scenar': 'scenario', 'scenario': 'scenario',
  'reflexe': 'reflection', 'reflection': 'reflection',
  'gamifikace': 'gamification', 'gamifikace': 'gamification', 'gamification': 'gamification',
};

interface PreviewItem {
  type: ModuleType;
  title: string;
  question: string;
  options: string[];
  timeLimit: number;
  valid: boolean;
  error?: string;
}

export default function ImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [setName, setSetName] = useState('');
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSetName(file.name.replace(/\.[^/.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
        const items: PreviewItem[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[0]) continue;
          const typRaw = String(row[0] || '').toLowerCase().trim();
          const typ = TYPE_MAP[typRaw];
          const title = String(row[1] || '').trim();
          const question = String(row[2] || '').trim();
          const opts = [row[3], row[4], row[5], row[6]].map(o => String(o || '').trim()).filter(Boolean);
          const time = Number(row[7]) || 0;
          if (!typ) {
            items.push({ type: 'quiz', title: title || `Řádek ${i}`, question, options: opts, timeLimit: time, valid: false, error: `Neznámý typ: "${row[0]}"` });
          } else if (!question) {
            items.push({ type: typ, title: title || `Řádek ${i}`, question, options: opts, timeLimit: time, valid: false, error: 'Chybí otázka' });
          } else {
            items.push({ type: typ, title: title || question.substring(0, 40), question, options: opts, timeLimit: time, valid: true });
          }
        }
        setPreview(items);
        setStep('preview');
      } catch { toast.error('Chyba při čtení souboru'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const doImport = async () => {
    if (!user) return;
    setImporting(true);
    try {
      const validItems = preview.filter(i => i.valid);
      const savedItems: LibraryItem[] = [];
      for (const item of validItems) {
        const ref = await addDoc(collection(db, 'library'), {
          lektorId: user.uid, type: item.type, title: item.title,
          question: item.question,
          options: item.type === 'reflection' ? [] : item.options,
          timeLimit: item.timeLimit, createdAt: Date.now(), updatedAt: Date.now(),
        });
        savedItems.push({ id: ref.id, lektorId: user.uid, type: item.type, title: item.title, question: item.question, options: item.options, timeLimit: item.timeLimit, createdAt: Date.now(), updatedAt: Date.now() });
      }
      if (setName.trim() && savedItems.length > 0) {
        await addDoc(collection(db, 'sets'), {
          lektorId: user.uid, title: setName.trim(),
          description: `Importováno z Excelu — ${validItems.length} modulů`,
          items: savedItems, createdAt: Date.now(), updatedAt: Date.now(),
        });
      }
      toast.success(`Importováno ${validItems.length} modulů!`);
      setStep('done');
    } catch { toast.error('Chyba při importu'); } finally { setImporting(false); }
  };

  const typeInfo: Record<string, {icon: string; label: string}> = {
    quiz: { icon: '❓', label: 'Kvíz' }, vote: { icon: '🗳️', label: 'Hlasování' },
    scenario: { icon: '🎭', label: 'Scénář' }, reflection: { icon: '💭', label: 'Reflexe' },
    gamification: { icon: '🏆', label: 'Gamifikace' },
  };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 50%, #0f1a2e 100%)', padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={() => router.push('/library')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', padding: 0, marginBottom: '16px' }}>← Knihovna</button>
        <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '26px', margin: '0 0 8px' }}>📥 Import z Excelu</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>Nahraj Excel šablonu a automaticky vytvoříme sadu školení</p>

        {step === 'upload' && (
          <div className="glass card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📊</div>
            <h2 style={{ color: '#fff', fontWeight: 700, margin: '0 0 8px' }}>Nahraj Excel soubor</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px', fontSize: '14px' }}>Formát: .xlsx se sloupci typ, název, otázka, možnost_A–D, čas_sekund</p>
            <label style={{ display: 'inline-block', cursor: 'pointer' }}>
              <div className="btn-primary" style={{ padding: '14px 32px', fontSize: '16px', display: 'inline-block' }}>📂 Vybrat soubor</div>
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div className="glass card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', fontSize: '13px' }}>Nalezeno {preview.length} řádků · {preview.filter(i => i.valid).length} platných</p>
                  <input value={setName} onChange={e => setSetName(e.target.value)} placeholder="Název sady školení" className="input-field" style={{ marginTop: '8px', maxWidth: '400px' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setStep('upload')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer' }}>← Zpět</button>
                  <button onClick={doImport} disabled={importing || preview.filter(i => i.valid).length === 0} className="btn-primary" style={{ padding: '10px 24px' }}>
                    {importing ? 'Importuji...' : `✅ Importovat ${preview.filter(i => i.valid).length} modulů`}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {preview.map((item, i) => {
                const t = typeInfo[item.type] || { icon: '📋', label: item.type };
                return (
                  <div key={i} className="glass" style={{ borderRadius: '12px', padding: '14px 18px', borderLeft: `3px solid ${item.valid ? '#34d399' : '#f87171'}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ fontSize: '20px', marginTop: '2px' }}>{t.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ color: item.valid ? '#34d399' : '#f87171', fontSize: '12px', fontWeight: 700 }}>{item.valid ? '✓' : '✗'}</span>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{t.label}</span>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{item.title}</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', fontSize: '13px' }}>{item.question}</p>
                        {item.options.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {item.options.map((o, j) => <span key={j} style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>{o}</span>)}
                          </div>
                        )}
                        {item.error && <p style={{ color: '#f87171', margin: '4px 0 0', fontSize: '12px' }}>⚠️ {item.error}</p>}
                      </div>
                      {item.timeLimit > 0 && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', flexShrink: 0 }}>⏱ {item.timeLimit}s</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="glass card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ color: '#fff', fontWeight: 900, fontSize: '24px', margin: '0 0 8px' }}>Import dokončen!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>Moduly jsou v knihovně a sada je připravena ke spuštění.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => router.push('/library')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>📚 Knihovna</button>
              <button onClick={() => router.push('/sets')} className="btn-primary" style={{ padding: '12px 24px' }}>🗂️ Zobrazit sady</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
