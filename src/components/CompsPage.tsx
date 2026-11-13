import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, FileText, Plus, Search, Trash2 } from 'lucide-react';
import type { Comp, Property } from '../types';
import { addComp, deleteComp, formatPrice, isRent, parseSize, REGIONS, type NewComp } from '../lib/sheets';
import { buildComps, compStats, fmtPct, fmtTL, sahibindenKeywordUrl, sahibindenSearchUrl, useComps, type CompItem } from '../lib/comps';
import { isAdmin } from '../lib/admin';
import Dialog, { btnPrimary, btnSecondary } from './Dialog';

interface Props {
  property: Property;
  properties: Property[];
  currentUser: string;
  userName: string;
  notify: (message: string) => void;
}

// İlan için emsal analizi: sahibinden'de filtreli arama, portföyden benzerler, elle girilen emsaller
export default function CompsPage({ property: p, properties, currentUser, userName, notify }: Props) {
  const { comps, sales, state, mutate, reload } = useComps();
  const [adding, setAdding] = useState(false);
  const items = useMemo(() => buildComps(p, properties, comps, sales), [p, properties, comps, sales]);
  const stats = useMemo(() => compStats(p, items), [p, items]);
  const rent = isRent(p);
  const size = parseSize(p.size);
  const manual = items.filter((i) => i.source === 'manuel');
  const portfolio = items.filter((i) => i.source === 'portfoy').slice(0, 12);
  const admin = isAdmin(currentUser);

  const remove = async (c: Comp) => {
    mutate((list) => list.filter((x) => x.id !== c.id));
    try {
      await deleteComp(c.id);
      notify('Emsal silindi.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Emsal silinemedi.');
      reload();
    }
  };

  return (
    <div className="space-y-[14px] max-w-[900px]">
      <div className="no-print flex flex-wrap items-center gap-2">
        <a href={`#/ilan/${encodeURIComponent(p.id)}`} className={btnSecondary}><ArrowLeft className="w-4 h-4" /> İlana dön</a>
        <a href={`#/rapor/${encodeURIComponent(p.id)}`} className={btnSecondary}><FileText className="w-4 h-4" /> Değerleme raporu</a>
      </div>

      <header className="bg-surface rounded-xl p-5">
        <p className="text-sm text-muted">Emsal analizi · <span className="num">{p.id}</span></p>
        <h1 className="text-lg font-semibold leading-6 mt-1">{p.title}</h1>
        <p className="text-sm text-faint mt-1">
          {[p.category, p.region !== 'Belirtilmemiş' ? p.region : '', p.neighborhood, p.rooms, size ? `${size.toLocaleString('tr-TR')} m²` : ''].filter(Boolean).join(' · ')}
        </p>
        <p className="text-2xl font-semibold num mt-2 text-accent">
          {formatPrice(p.price)}
          {rent && <span className="text-base text-muted font-normal"> / ay</span>}
        </p>
      </header>

      {/* Özet */}
      <section className="bg-surface rounded-xl p-5">
        <h2 className="text-base font-semibold">Piyasa özeti</h2>
        {state === 'loading' && !items.length ? (
          <p className="mt-2 text-sm text-muted">Emsaller yükleniyor…</p>
        ) : stats.count === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Metrekaresi bilinen emsal yok. Aşağıdan sahibinden'de benzerlerine bakıp birkaç emsal ekleyin; ortalama ve değer aralığı burada hesaplanır.
          </p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label={`m² ${rent ? 'kirası' : 'fiyatı'} (medyan)`} value={fmtTL(stats.median)} />
              <Stat label="Aralık" value={`${stats.p25.toLocaleString('tr-TR')} – ${stats.p75.toLocaleString('tr-TR')}`} />
              <Stat label="Emsal sayısı" value={String(stats.count)} />
              <Stat
                label="Bu ilan"
                value={stats.position === null ? '—' : Math.abs(stats.position) < 0.03 ? 'Ortalamada' : fmtPct(stats.position)}
                tone={stats.position === null ? '' : stats.position > 0.1 ? 'text-warning' : stats.position < -0.1 ? 'text-positive' : ''}
              />
            </dl>
            {stats.estimate ? (
              <p className="mt-4 text-sm">
                Emsallere göre tahmini {rent ? 'kira' : 'değer'}:{' '}
                <span className="font-semibold num">{fmtTL(stats.estimate.low)} – {fmtTL(stats.estimate.high)}</span>
                <span className="text-muted"> (orta: <span className="num">{fmtTL(stats.estimate.mid)}</span>)</span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">
                {size ? 'Değer aralığı için metrekaresi bilinen en az 3 emsal gerekiyor.' : "Değer aralığı için ilanın m²'si girilmeli."}
              </p>
            )}
            {stats.count < 5 && <p className="mt-1 text-xs text-faint">Emsal az; sonuçlar kaba bir fikir verir. Emsal ekledikçe güçlenir.</p>}
          </>
        )}
      </section>

      {/* Sahibinden */}
      <section className="bg-surface rounded-xl p-5">
        <h2 className="text-base font-semibold">Sahibinden'de benzerleri</h2>
        <p className="mt-1 text-sm text-muted">
          Aynı kategori ve ilçede, ±%25 fiyat aralığındaki ilanlar sahibinden'de açılır. Uygun bulduklarınızı "Emsal ekle" ile kaydedin.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={sahibindenSearchUrl(p)} target="_blank" rel="noreferrer" className={btnPrimary}>
            <Search className="w-4 h-4" /> Sahibinden'de aç
          </a>
          <a href={sahibindenKeywordUrl(p)} target="_blank" rel="noreferrer" className={btnSecondary}>
            Kelimeyle ara <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={() => setAdding(true)} className={btnSecondary}>
            <Plus className="w-4 h-4" /> Emsal ekle
          </button>
        </div>
      </section>

      {/* Elle eklenen emsaller */}
      <section className="bg-surface rounded-xl p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Eklenen emsaller</h2>
          <span className="text-sm text-muted num">{manual.length}</span>
        </div>
        {state === 'error' ? (
          <p className="mt-2 text-sm text-muted">Emsaller okunamadı. Apps Script'in yeni sürümü yayınlanınca açılır.</p>
        ) : manual.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Bu kategoride henüz emsal girilmemiş.</p>
        ) : (
          <ul className="mt-2">
            {manual.map((i) => (
              <CompRow
                key={i.key}
                item={i}
                canDelete={!!i.comp && (admin || i.comp.addedByEmail === currentUser.toLowerCase())}
                onDelete={() => i.comp && remove(i.comp)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Portföyden */}
      <section className="bg-surface rounded-xl p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Portföyümüzden benzerler</h2>
          <span className="text-sm text-muted num">{portfolio.length}</span>
        </div>
        {portfolio.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Portföyde aynı kategoride başka ilan yok.</p>
        ) : (
          <ul className="mt-2">
            {portfolio.map((i) => <CompRow key={i.key} item={i} />)}
          </ul>
        )}
        <p className="mt-3 text-xs text-faint">
          Benzerlik: aynı ilçe, mahalle, oda sayısı ve yakın metrekare öne çıkar.
          {admin ? ' Satılanlarda gerçekleşen satış fiyatı kullanılır.' : ' Satılanlarda son ilan fiyatı gösterilir.'}
        </p>
      </section>

      {adding && (
        <AddCompDialog
          property={p}
          onClose={() => setAdding(false)}
          onSaved={(c) => {
            mutate((list) => [c, ...list]);
            notify('Emsal kaydedildi.');
          }}
          onError={(m) => notify(m)}
          userName={userName}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-[17px] font-semibold num mt-0.5 ${tone}`}>{value}</dd>
    </div>
  );
}

function CompRow({ item: i, canDelete = false, onDelete }: { item: CompItem; canDelete?: boolean; onDelete?: () => void }) {
  const badge =
    i.state === 'Satıldı' ? 'bg-positive-bg text-positive' : i.state === 'Pasif' ? 'bg-raised text-muted' : 'bg-raised text-ink';
  const titleEl = i.propertyId ? (
    <a href={`#/ilan/${encodeURIComponent(i.propertyId)}`} className="font-medium hover:underline underline-offset-2">{i.title}</a>
  ) : i.link ? (
    <a href={i.link} target="_blank" rel="noreferrer" className="font-medium hover:underline underline-offset-2 inline-flex items-center gap-1">
      {i.title} <ExternalLink className="w-3 h-3" />
    </a>
  ) : (
    <span className="font-medium">{i.title}</span>
  );
  return (
    <li className="py-2.5 border-t border-rule first:border-t-0 text-sm flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="leading-5">{titleEl}</p>
        <p className="text-xs text-faint mt-0.5">
          {[i.region !== 'Belirtilmemiş' ? i.region : '', i.neighborhood, i.rooms, i.size ? `${i.size.toLocaleString('tr-TR')} m²` : 'm² yok'].filter(Boolean).join(' · ')}
          {i.comp?.addedBy ? ` · ${i.comp.addedBy}` : ''}
        </p>
        {i.note && <p className="text-xs text-muted mt-0.5">{i.note}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="num font-medium">{fmtTL(i.price)}</p>
        <p className="text-xs text-faint num">{i.perM2 ? `${i.perM2.toLocaleString('tr-TR')} TL/m²` : ''}</p>
        <span className={`inline-flex mt-1 h-5 px-2 rounded-full text-[11px] items-center ${badge}`}>
          {i.state}{i.realized ? ' · gerçekleşen' : ''}
        </span>
      </div>
      {canDelete && (
        <button onClick={onDelete} aria-label="Emsali sil" className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-muted hover:text-negative hover:bg-active">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

function AddCompDialog({
  property: p,
  onClose,
  onSaved,
  onError,
  userName,
  currentUser,
}: {
  property: Property;
  onClose: () => void;
  onSaved: (c: Comp) => void;
  onError: (message: string) => void;
  userName: string;
  currentUser: string;
}) {
  const [f, setF] = useState<NewComp>({
    forTitle: p.title,
    source: 'Sahibinden',
    link: '',
    category: p.category,
    region: p.region !== 'Belirtilmemiş' ? p.region : 'Merkez',
    neighborhood: '',
    size: '',
    rooms: p.rooms || '',
    price: '',
    state: 'İlanda',
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof NewComp) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setError('');
    if (!f.price.replace(/[^0-9]/g, '')) return setError('Fiyatı girin.');
    if (f.link && !/^https?:\/\//i.test(f.link.trim())) return setError('Link http ile başlamalı (sahibinden ilanının adresini yapıştırın).');
    setBusy(true);
    try {
      const id = await addComp({ ...f, link: f.link.trim() });
      onSaved({
        id: id || `yerel-${Date.now()}`,
        at: new Date(),
        forTitle: f.forTitle,
        source: f.source,
        link: f.link.trim(),
        category: f.category,
        region: f.region,
        neighborhood: f.neighborhood,
        size: parseSize(f.size),
        rooms: f.rooms,
        price: Number(f.price.replace(/[^0-9]/g, '')),
        state: f.state,
        note: f.note,
        addedBy: userName,
        addedByEmail: currentUser.toLowerCase(),
      });
      onClose();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Emsal kaydedilemedi.';
      setError(m);
      onError(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Emsal ekle"
      onClose={onClose}
      actions={
        <>
          <button onClick={onClose} className={btnSecondary}>Vazgeç</button>
          <button onClick={save} disabled={busy} className={`${btnPrimary} disabled:opacity-60`}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3 text-ink">
        <div className="sm:col-span-2">
          <label htmlFor="c-link" className="block text-sm font-medium mb-2">İlan linki (isteğe bağlı)</label>
          <input id="c-link" inputMode="url" placeholder="https://www.sahibinden.com/ilan/..." value={f.link} onChange={set('link')} className="field" />
        </div>
        <div>
          <label htmlFor="c-price" className="block text-sm font-medium mb-2">Fiyat (TL)</label>
          <input id="c-price" inputMode="numeric" value={f.price} onChange={set('price')} className="field num" />
        </div>
        <div>
          <label htmlFor="c-size" className="block text-sm font-medium mb-2">m²</label>
          <input id="c-size" inputMode="numeric" value={f.size} onChange={set('size')} className="field num" />
        </div>
        <div>
          <label htmlFor="c-region" className="block text-sm font-medium mb-2">İlçe</label>
          <select id="c-region" value={f.region} onChange={set('region')} className="field">
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-nb" className="block text-sm font-medium mb-2">Mahalle</label>
          <input id="c-nb" value={f.neighborhood} onChange={set('neighborhood')} className="field" />
        </div>
        <div>
          <label htmlFor="c-rooms" className="block text-sm font-medium mb-2">Oda sayısı</label>
          <input id="c-rooms" placeholder="3+1" value={f.rooms} onChange={set('rooms')} className="field" />
        </div>
        <div>
          <label htmlFor="c-state" className="block text-sm font-medium mb-2">Durum</label>
          <select id="c-state" value={f.state} onChange={set('state')} className="field">
            <option>İlanda</option>
            <option>Satıldı</option>
          </select>
        </div>
        <div>
          <label htmlFor="c-src" className="block text-sm font-medium mb-2">Kaynak</label>
          <select id="c-src" value={f.source} onChange={set('source')} className="field">
            <option>Sahibinden</option>
            <option>Emlakjet</option>
            <option>Hepsiemlak</option>
            <option>Başka ofis</option>
            <option>Tapu satışı</option>
            <option>Diğer</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-note" className="block text-sm font-medium mb-2">Not</label>
          <input id="c-note" placeholder="Örn. deniz manzaralı, site içi, pazarlıkla 4,2 M'ye satıldı" value={f.note} onChange={set('note')} className="field" />
        </div>
      </div>
      <p className="mt-3 text-sm">Kategori: {p.category}. Emsal "Emsaller" sayfasına yazılır ve aynı kategorideki tüm ilanların analizinde kullanılır.</p>
      {error && <p role="alert" className="mt-2 text-sm text-negative">{error}</p>}
    </Dialog>
  );
}
