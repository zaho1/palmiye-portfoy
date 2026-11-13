import { useState } from 'react';
import { Copy, ExternalLink, Landmark } from 'lucide-react';
import type { ParcelFields, Property } from '../types';
import Dialog, { btnPrimary, btnSecondary } from './Dialog';

// İlçe belediyelerinin siteleri (imar planı ve imar durumu başvurusu için)
const MUNICIPALITY: Record<string, { name: string; url: string }> = {
  Merkez: { name: 'Yalova Belediyesi', url: 'https://www.yalova.bel.tr' },
  Çiftlikköy: { name: 'Çiftlikköy Belediyesi', url: 'https://www.yalovaciftlikkoy.bel.tr' },
  Altınova: { name: 'Altınova Belediyesi', url: 'https://www.altinova.bel.tr' },
  Çınarcık: { name: 'Çınarcık Belediyesi', url: 'https://www.cinarcik.bel.tr' },
  Termal: { name: 'Termal Belediyesi', url: 'https://www.termal.bel.tr' },
  Armutlu: { name: 'Armutlu Belediyesi', url: 'https://www.armutlu.bel.tr' },
};

export const parcelOf = (p: Property): ParcelFields => ({
  adaParsel: p.adaParsel || '',
  neighborhood: p.neighborhood || '',
  imarStatus: p.imarStatus || '',
  taks: p.taks || '',
  kaks: p.kaks || '',
  maxFloors: p.maxFloors || '',
  imarNote: p.imarNote || '',
});

// "100/1", "Ada 100 Parsel 1", "100 / 1" → { ada, parsel }
export function splitAdaParsel(s: string): { ada: string; parsel: string } {
  const nums = (s || '').match(/\d+/g) ?? [];
  return { ada: nums[0] ?? '', parsel: nums[1] ?? '' };
}

// Ofis içi kart: ada/parsel, imar bilgileri, TKGM ve belediye bağlantıları
export default function ParcelCard({ property: p, onSave }: { property: Property; onSave: (f: ParcelFields) => void }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { ada, parsel } = splitAdaParsel(p.adaParsel || '');
  const district = p.region !== 'Belirtilmemiş' ? p.region : '';
  const muni = MUNICIPALITY[district];
  const lookup = ['Yalova', district, p.neighborhood ? `${p.neighborhood} Mah.` : '', ada ? `Ada ${ada}` : '', parsel ? `Parsel ${parsel}` : ''].filter(Boolean).join(' / ');
  const empty = !p.adaParsel && !p.imarStatus && !p.taks && !p.kaks && !p.maxFloors && !p.imarNote;

  // TKGM sayfası il/ilçe/mahalle seçimiyle çalışır; bilgiler panoya kopyalanır, sayfa yeni sekmede açılır
  const openTkgm = async () => {
    try {
      await navigator.clipboard.writeText(lookup);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      /* pano izni yoksa sadece sayfa açılır */
    }
    window.open('https://parselsorgu.tkgm.gov.tr/', '_blank', 'noopener');
  };

  return (
    <section className="bg-surface rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-muted" /> Parsel ve imar</h2>
        <button onClick={() => setEditing(true)} className="text-sm text-muted hover:text-ink underline underline-offset-2">
          {empty ? 'Ekle' : 'Düzenle'}
        </button>
      </div>

      <dl className="mt-2 grid sm:grid-cols-2 gap-x-8 text-sm">
        <Row label="Konum" value={['Yalova', district, p.neighborhood].filter(Boolean).join(' / ')} />
        <Row label="Ada / parsel" value={ada ? `${ada} / ${parsel || '—'}` : '—'} warn={!ada} />
        <Row label="İmar durumu" value={p.imarStatus || '—'} />
        <Row label="TAKS" value={p.taks || '—'} />
        <Row label="KAKS (emsal)" value={p.kaks || '—'} />
        <Row label="Maks. kat" value={p.maxFloors || '—'} />
      </dl>
      {p.imarNote && <p className="mt-2 text-sm text-muted whitespace-pre-line">{p.imarNote}</p>}
      {empty && (
        <p className="mt-2 text-sm text-muted">Ada/parsel ve imar bilgisi girilmemiş. Arsa ve tarlalarda emsal ve değerleme için önemli.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={openTkgm} className={btnSecondary} title={lookup}>
          {copied ? <><Copy className="w-4 h-4" /> Kopyalandı, TKGM açıldı</> : <>TKGM'de parseli bul <ExternalLink className="w-3.5 h-3.5" /></>}
        </button>
        {muni && (
          <a href={muni.url} target="_blank" rel="noreferrer" className={btnSecondary}>
            {muni.name} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      {ada && (
        <p className="mt-2 text-xs text-faint">
          TKGM'de "İdari sorgu"dan Yalova, {district || 'ilçe'}{p.neighborhood ? `, ${p.neighborhood}` : ''} seçip ada {ada}, parsel {parsel || '?'} girin. Bilgiler panoya kopyalanır.
        </p>
      )}

      {editing && (
        <ParcelDialog
          value={parcelOf(p)}
          onClose={() => setEditing(false)}
          onSave={(f) => {
            setEditing(false);
            onSave(f);
          }}
        />
      )}
    </section>
  );
}

function ParcelDialog({ value, onClose, onSave }: { value: ParcelFields; onClose: () => void; onSave: (f: ParcelFields) => void }) {
  const initial = splitAdaParsel(value.adaParsel);
  const [ada, setAda] = useState(initial.ada);
  const [parsel, setParsel] = useState(initial.parsel);
  const [f, setF] = useState(value);
  const set = (k: keyof ParcelFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog
      title="Parsel ve imar bilgisi"
      onClose={onClose}
      actions={
        <>
          <button onClick={onClose} className={btnSecondary}>Vazgeç</button>
          <button
            onClick={() => onSave({ ...f, adaParsel: ada.trim() ? `${ada.trim()}/${parsel.trim()}` : '' })}
            className={btnPrimary}
          >
            Kaydet
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-ink">
        <div>
          <label htmlFor="pa-ada" className="block text-sm font-medium mb-2">Ada</label>
          <input id="pa-ada" inputMode="numeric" value={ada} onChange={(e) => setAda(e.target.value)} className="field num" />
        </div>
        <div>
          <label htmlFor="pa-parsel" className="block text-sm font-medium mb-2">Parsel</label>
          <input id="pa-parsel" inputMode="numeric" value={parsel} onChange={(e) => setParsel(e.target.value)} className="field num" />
        </div>
        <div className="col-span-2">
          <label htmlFor="pa-nb" className="block text-sm font-medium mb-2">Mahalle</label>
          <input id="pa-nb" value={f.neighborhood} onChange={set('neighborhood')} className="field" />
        </div>
        <div className="col-span-2">
          <label htmlFor="pa-imar" className="block text-sm font-medium mb-2">İmar durumu</label>
          <input id="pa-imar" list="imar-options" placeholder="Konut, Ticari, Villa, Tarım…" value={f.imarStatus} onChange={set('imarStatus')} className="field" />
          <datalist id="imar-options">
            {['Konut', 'Konut + Ticaret', 'Ticari', 'Villa', 'Turizm', 'Sanayi', 'Tarım', 'İmarsız', 'Hisseli'].map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
        <div>
          <label htmlFor="pa-taks" className="block text-sm font-medium mb-2">TAKS</label>
          <input id="pa-taks" inputMode="decimal" placeholder="0,30" value={f.taks} onChange={set('taks')} className="field num" />
        </div>
        <div>
          <label htmlFor="pa-kaks" className="block text-sm font-medium mb-2">KAKS (emsal)</label>
          <input id="pa-kaks" inputMode="decimal" placeholder="1,20" value={f.kaks} onChange={set('kaks')} className="field num" />
        </div>
        <div className="col-span-2">
          <label htmlFor="pa-kat" className="block text-sm font-medium mb-2">Maks. kat / yükseklik</label>
          <input id="pa-kat" placeholder="4 kat veya Hmax 12,50 m" value={f.maxFloors} onChange={set('maxFloors')} className="field" />
        </div>
        <div className="col-span-2">
          <label htmlFor="pa-note" className="block text-sm font-medium mb-2">İmar notu</label>
          <textarea id="pa-note" rows={3} placeholder="Çekme mesafeleri, yola terk, plan notları…" value={f.imarNote} onChange={set('imarNote')} className="field h-auto py-2" />
        </div>
      </div>
      <p className="mt-3 text-sm">Bilgiler ilana kaydedilir. Ada/parsel müşteriye giden metinde ve broşürde görünmez.</p>
    </Dialog>
  );
}

function Row({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-8 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className={`num text-right ${warn ? 'text-warning' : ''}`}>{value}</dd>
    </div>
  );
}
