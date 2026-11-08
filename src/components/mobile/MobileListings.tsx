import { useMemo, useRef, useState, useEffect } from 'react';
import { Eye, EyeOff, Heart, MessageCircle, Phone, RefreshCw, Search, Share2, SlidersHorizontal } from 'lucide-react';
import type { CustomerRequest, ListingStatus, Property } from '../../types';
import {
  REGIONS,
  customerShareText,
  daysSince,
  formatPrice,
  isIncomplete,
  isRecent,
  isRent,
  isStale,
  kindOf,
  parsePrice,
  parseSize,
  priceDropped,
  whatsappUrl,
} from '../../lib/sheets';
import { requestsFor } from '../../lib/match';
import { useSettings } from '../../lib/settings';
import { Thumb, StatusPill } from '../ui';
import type { ListPreset, Quick } from '../ListingList';
import { Chip, Segmented, Sheet, MField, btnBig, btnBigSecondary } from './controls';
import { InstallBanner } from './InstallApp';

type Scope = 'all' | 'mine' | 'favorites';
type Deal = 'Hepsi' | 'Satılık' | 'Kiralık';
type MQuick = Quick | 'talep';
type Sort = 'newest' | 'price-asc' | 'price-desc' | 'size-desc' | 'oldest-update';

interface Props {
  properties: Property[];
  requests: CustomerRequest[];
  scope: Scope;
  preset: ListPreset;
  userName: string;
  presentMode: boolean;
  onTogglePresent: () => void;
  loading: boolean;
  loadError: boolean;
  onRefresh: () => void;
}

const STATUSES: { status: ListingStatus; label: string }[] = [
  { status: 'Aktif', label: 'Aktif' },
  { status: 'Pasif', label: 'Pasif' },
  { status: 'Satıldı', label: 'Satılan / kiralanan' },
  { status: 'Silindi', label: 'Silinen' },
];

const QUICKS: { id: MQuick; label: string }[] = [
  { id: 'talep', label: 'Talebe uyan' },
  { id: 'yeni', label: 'Son 7 gün' },
  { id: 'teyitsiz', label: 'Teyitsiz' },
  { id: 'eksik', label: 'Bilgisi eksik' },
  { id: 'indirim', label: 'Fiyatı düşen' },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: 'newest', label: 'En yeni eklenen' },
  { id: 'price-asc', label: 'Fiyat: düşükten yükseğe' },
  { id: 'price-desc', label: 'Fiyat: yüksekten düşüğe' },
  { id: 'size-desc', label: 'Metrekare: büyükten küçüğe' },
  { id: 'oldest-update', label: 'En uzun teyitsiz kalan' },
];

const PAGE = 12;

export default function MobileListings({ properties, requests, scope, preset, userName, presentMode, onTogglePresent, loading, loadError, onRefresh }: Props) {
  const { settings, favorites } = useSettings();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListingStatus>('Aktif');
  const [deal, setDeal] = useState<Deal>('Hepsi');
  const [kind, setKind] = useState('Hepsi');
  const [region, setRegion] = useState(preset.region ?? 'Hepsi');
  const [quick, setQuick] = useState<MQuick | undefined>(preset.quick);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<Sort>(preset.quick === 'teyitsiz' ? 'oldest-update' : 'newest');
  const [sheet, setSheet] = useState(false);

  const mineKey = userName.toLocaleLowerCase('tr');
  const scoped = useMemo(() => {
    if (scope === 'mine') return properties.filter((p) => p.agentName.toLocaleLowerCase('tr').includes(mineKey));
    if (scope === 'favorites') return properties.filter((p) => favorites.includes(p.id));
    return properties;
  }, [properties, scope, mineKey, favorites]);

  const kinds = useMemo(() => {
    const dynamic = scoped.map((p) => kindOf(p.category)).filter(Boolean);
    return Array.from(new Set(['Daire', 'Arsa', 'İşyeri', ...dynamic])).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [scoped]);

  const regionChips = useMemo(() => {
    const custom = Array.from(new Set(scoped.map((p) => p.region))).filter((r) => !REGIONS.includes(r) && r !== 'Belirtilmemiş');
    const extra = scoped.some((p) => p.region === 'Belirtilmemiş') ? ['Belirtilmemiş'] : [];
    return [...REGIONS, ...custom, ...extra];
  }, [scoped]);

  const matchCount = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach((p) => m.set(p.id, requestsFor(p, requests).length));
    return m;
  }, [scoped, requests]);

  const order = useMemo(() => new Map(properties.map((p, i) => [p.id, i])), [properties]);

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    const min = minPrice ? parseInt(minPrice, 10) : 0;
    const max = maxPrice ? parseInt(maxPrice, 10) : Infinity;
    const list = scoped.filter((p) => {
      if (p.status !== status) return false;
      if (q) {
        const hay = [p.title, p.description, p.id, p.agentName, presentMode ? '' : p.adaParsel, p.category, p.region, p.neighborhood, p.rooms]
          .join(' ')
          .toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      if (deal !== 'Hepsi' && !p.category.toLocaleLowerCase('tr').includes(deal.toLocaleLowerCase('tr'))) return false;
      if (kind !== 'Hepsi' && kindOf(p.category) !== kind) return false;
      if (region !== 'Hepsi' && p.region !== region) return false;
      if (quick === 'teyitsiz' && !isStale(p, settings.staleDays)) return false;
      if (quick === 'yeni' && !isRecent(p)) return false;
      if (quick === 'eksik' && !isIncomplete(p)) return false;
      if (quick === 'indirim' && !priceDropped(p)) return false;
      if (quick === 'talep' && !(matchCount.get(p.id) ?? 0)) return false;
      const price = parsePrice(p.price);
      return price >= min && price <= max;
    });
    const time = (d: Date | null) => d?.getTime() ?? 0;
    const idx = (p: Property) => order.get(p.id) ?? 0;
    if (sort === 'newest') list.sort((a, b) => time(b.createdAt) - time(a.createdAt) || idx(b) - idx(a));
    if (sort === 'price-asc') list.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    if (sort === 'price-desc') list.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    if (sort === 'size-desc') list.sort((a, b) => parseSize(b.size) - parseSize(a.size));
    if (sort === 'oldest-update') list.sort((a, b) => time(a.updatedAt) - time(b.updatedAt));
    return list;
  }, [scoped, status, search, deal, kind, region, quick, minPrice, maxPrice, sort, presentMode, settings.staleDays, matchCount, order]);

  // Kartlar parça parça çizilir; süzgeç değişince başa döner
  const sig = [search, status, deal, kind, region, quick, minPrice, maxPrice, sort].join('|');
  const [paging, setPaging] = useState({ sig, limit: PAGE });
  const limit = paging.sig === sig ? paging.limit : PAGE;
  const shown = rows.slice(0, limit);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setPaging({ sig, limit: limit + PAGE });
      },
      { rootMargin: '800px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sig, limit, rows.length]);

  const filterCount =
    (deal !== 'Hepsi' ? 1 : 0) +
    (kind !== 'Hepsi' ? 1 : 0) +
    (region !== 'Hepsi' ? 1 : 0) +
    (quick ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (status !== 'Aktif' ? 1 : 0) +
    (sort !== 'newest' ? 1 : 0);
  const clearFilters = () => {
    setDeal('Hepsi');
    setKind('Hepsi');
    setRegion('Hepsi');
    setQuick(undefined);
    setMinPrice('');
    setMaxPrice('');
    setStatus('Aktif');
    setSort('newest');
  };

  const title = scope === 'mine' ? 'Benim ilanlarım' : scope === 'favorites' ? 'Favorilerim' : 'İlanlar';
  const pending = loading && !properties.length;

  return (
    <div>
      <header className="m-top px-4 pt-4 flex items-center gap-2">
        <h1 className="text-2xl font-semibold flex-1 min-w-0 truncate">{title}</h1>
        <button
          onClick={onTogglePresent}
          aria-pressed={presentMode}
          aria-label={presentMode ? 'Sunum modunu kapat' : 'Sunum modunu aç'}
          className={`h-11 px-3 rounded-full border flex items-center gap-2 text-[14px] ${presentMode ? 'border-ink text-ink' : 'border-control text-muted'}`}
        >
          {presentMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          {presentMode && <span>Sunum</span>}
        </button>
        <button onClick={onRefresh} aria-label="Yenile" className="w-11 h-11 rounded-full flex items-center justify-center text-muted active:bg-surface">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {scope === 'all' && <InstallBanner />}

      <div className="sticky top-0 z-30 bg-ground m-top px-4 py-3 flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <label htmlFor="m-search" className="sr-only">İlan ara</label>
          <input
            id="m-search"
            type="search"
            enterKeyHint="search"
            placeholder="Başlık, mahalle, ilan no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-lg pl-11 bg-surface border-transparent"
          />
        </div>
        <button
          onClick={() => setSheet(true)}
          aria-label={filterCount ? `Filtre, ${filterCount} seçili` : 'Filtre'}
          className={`relative h-12 px-4 rounded-xl border flex items-center gap-2 text-[15px] font-medium shrink-0 ${filterCount ? 'border-ink text-ink' : 'border-control text-muted'}`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          Filtre
          {filterCount > 0 && (
            <span className="min-w-5 h-5 px-1 rounded-full bg-ink text-ground text-[12px] font-semibold flex items-center justify-center num">{filterCount}</span>
          )}
        </button>
      </div>

      <div className="px-4 pb-2 flex items-center justify-between text-[14px] text-muted">
        <span className="num">{pending ? 'Yükleniyor…' : `${rows.length} ilan`}</span>
        {filterCount > 0 && (
          <button onClick={clearFilters} className="min-h-11 px-2 -mr-2 underline underline-offset-2">Filtreyi temizle</button>
        )}
      </div>

      <div className="px-4 space-y-4">
        {loadError ? (
          <div className="rounded-2xl border border-dashed border-control px-4 py-4 text-muted space-y-3">
            <p>İlanlar yüklenemedi. İnternet bağlantınızı kontrol edin.</p>
            <button onClick={onRefresh} className={`${btnBigSecondary} w-full`}>Tekrar dene</button>
          </div>
        ) : pending ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-control px-4 py-6 text-muted text-center">
            {scope === 'favorites' && !favorites.length
              ? 'Henüz favori ilan yok. Kartın üstündeki kalp simgesiyle ekleyin.'
              : filterCount || search.trim()
                ? 'Bu aramayla eşleşen ilan yok. Filtreyi genişletmeyi deneyin.'
                : scope === 'mine'
                  ? `${userName} adına kayıtlı ilan yok.`
                  : 'Bu durumda ilan yok.'}
          </div>
        ) : (
          shown.map((p) => <Card key={p.id} p={p} matched={matchCount.get(p.id) ?? 0} presentMode={presentMode} staleDays={settings.staleDays} signature={settings.shareSignature} />)
        )}
        {shown.length < rows.length && <div ref={sentinel} className="h-10" aria-hidden="true" />}
      </div>

      {sheet && (
        <Sheet
          title="Filtre"
          onClose={() => setSheet(false)}
          footer={
            <div className="flex gap-3">
              <button onClick={clearFilters} className={`${btnBigSecondary} flex-1`}>Sıfırla</button>
              <button onClick={() => setSheet(false)} className={`${btnBig} flex-[2]`}>{rows.length} ilanı göster</button>
            </div>
          }
        >
          <div className="space-y-6">
            <MField label="İşlem">
              <Segmented label="Satılık veya kiralık" value={deal} options={['Hepsi', 'Satılık', 'Kiralık']} onChange={(v) => setDeal(v as Deal)} />
            </MField>
            <MField label="Cins">
              <div className="flex flex-wrap gap-2">
                <Chip on={kind === 'Hepsi'} onClick={() => setKind('Hepsi')}>Hepsi</Chip>
                {kinds.map((k) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}
              </div>
            </MField>
            <MField label="Bölge">
              <div className="flex flex-wrap gap-2">
                <Chip on={region === 'Hepsi'} onClick={() => setRegion('Hepsi')}>Hepsi</Chip>
                {regionChips.map((r) => <Chip key={r} on={region === r} onClick={() => setRegion(r)}>{r}</Chip>)}
              </div>
            </MField>
            <MField label="Fiyat aralığı (₺)">
              <div className="flex items-center gap-2">
                <input aria-label="En düşük fiyat" inputMode="numeric" pattern="[0-9]*" placeholder="En az" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ''))} className="field-lg num" />
                <span className="text-faint">–</span>
                <input aria-label="En yüksek fiyat" inputMode="numeric" pattern="[0-9]*" placeholder="En çok" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))} className="field-lg num" />
              </div>
            </MField>
            <MField label="Hızlı süzgeç">
              <div className="flex flex-wrap gap-2">
                {QUICKS.map((q) => (
                  <Chip key={q.id} on={quick === q.id} onClick={() => setQuick(quick === q.id ? undefined : q.id)}>{q.label}</Chip>
                ))}
              </div>
            </MField>
            <MField label="Durum">
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => <Chip key={s.status} on={status === s.status} onClick={() => setStatus(s.status)}>{s.label}</Chip>)}
              </div>
            </MField>
            <MField label="Sıralama">
              <div className="flex flex-wrap gap-2">
                {SORTS.map((s) => <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</Chip>)}
              </div>
            </MField>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Card({ p, matched, presentMode, staleDays, signature }: { p: Property; matched: number; presentMode: boolean; staleDays: number; signature: string }) {
  const { favorites, toggleFavorite } = useSettings();
  const fav = favorites.includes(p.id);
  const href = `#/ilan/${encodeURIComponent(p.id)}`;
  const wa = whatsappUrl(p);
  const tel = p.agentPhone.replace(/[^0-9+]/g, '');
  const size = parseSize(p.size);
  const days = daysSince(p.updatedAt);
  const stale = isStale(p, staleDays);
  const sold = p.status === 'Satıldı';
  const place = [p.region !== 'Belirtilmemiş' ? p.region : '', p.neighborhood].filter(Boolean).join(' · ');
  const meta = [p.category, p.rooms, size ? `${size.toLocaleString('tr-TR')} m²` : ''].filter(Boolean).join(' · ');
  const photos = p.images?.length ?? 0;

  // Telefonun paylaşım menüsü açılır (WhatsApp dahil); desteklenmiyorsa WhatsApp kişi seçimi
  const share = async () => {
    const text = customerShareText(p, signature);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
      } catch {
        /* kullanıcı paylaşım menüsünü kapattı */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    }
  };

  const act = 'h-11 rounded-xl flex items-center justify-center gap-2 text-[15px] font-medium active:opacity-70';

  return (
    <article className="bg-surface rounded-2xl overflow-hidden">
      <div className="relative">
        <a href={href} aria-label={`${p.title} ilanını aç`} className="block">
          <Thumb src={p.imageUrl} alt="" className="w-full aspect-[16/10]" />
        </a>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pr-14">
          {p.status !== 'Aktif' && <StatusPill status={p.status} />}
          {p.status === 'Aktif' && matched > 0 && (
            <span className="h-6 px-2.5 rounded-full bg-positive-bg text-positive text-[13px] font-medium flex items-center">{matched === 1 ? 'Talep eşleşti' : `${matched} talep eşleşti`}</span>
          )}
          {priceDropped(p) && <span className="h-6 px-2.5 rounded-full bg-raised text-ink text-[13px] font-medium flex items-center">Fiyat düştü</span>}
        </div>
        <button
          onClick={() => toggleFavorite(p.id)}
          aria-pressed={fav}
          aria-label={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          className={`absolute right-1.5 top-1.5 w-11 h-11 rounded-full flex items-center justify-center bg-surface/80 ${fav ? 'text-negative' : 'text-ink'}`}
        >
          <Heart className="w-5 h-5" fill={fav ? 'currentColor' : 'none'} />
        </button>
        {photos > 1 && <span className="absolute right-3 bottom-3 h-6 px-2 rounded-full bg-black/60 text-white text-[12px] flex items-center num">{photos} fotoğraf</span>}
      </div>

      <div className="p-4">
        <a href={href} className="block">
          <p className={`text-xl font-semibold num ${sold ? 'text-muted line-through' : 'text-accent'}`}>
            {formatPrice(p.price)}
            {isRent(p) && <span className="text-[15px] text-faint font-normal no-underline"> /ay</span>}
            {priceDropped(p) && <span className="ml-2 text-[14px] text-faint font-normal line-through">{formatPrice(p.oldPrice || '')}</span>}
          </p>
          <h2 className="mt-1 text-[17px] font-semibold leading-6 line-clamp-2">{p.title}</h2>
          <p className="mt-1 text-[14px] text-muted">{[place, meta].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-[13px] text-faint">
            <span className="num">{p.id}</span> · {p.agentName}
            {!presentMode && p.adaParsel?.trim() ? ` · Ada/parsel ${p.adaParsel}` : ''}
            {days !== null && (
              <span className={stale ? 'text-warning' : ''}> · {stale ? `${days} gündür teyitsiz` : days === 0 ? 'bugün güncellendi' : `${days} gün önce güncellendi`}</span>
            )}
          </p>
        </a>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {tel ? (
            <a href={`tel:${tel}`} className={`${act} bg-raised text-ink`} aria-label={`${p.agentName} ara`}>
              <Phone className="w-5 h-5" /> Ara
            </a>
          ) : (
            <span className={`${act} bg-raised text-faint`}><Phone className="w-5 h-5" /> Ara</span>
          )}
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" className={`${act} bg-positive-bg text-positive`} aria-label={`${p.agentName} ile WhatsApp'ta yaz`}>
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </a>
          ) : (
            <span className={`${act} bg-raised text-faint`}><MessageCircle className="w-5 h-5" /> WhatsApp</span>
          )}
          <button onClick={share} className={`${act} col-span-2 bg-ink text-ground`}>
            <Share2 className="w-5 h-5" /> Müşteriye gönder
          </button>
        </div>
      </div>
    </article>
  );
}

function Skeleton() {
  return (
    <div aria-label="Yükleniyor" className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface rounded-2xl overflow-hidden">
          <div className="aspect-[16/10] bg-raised" />
          <div className="p-4 space-y-3">
            <div className="h-6 w-1/3 rounded bg-raised" />
            <div className="h-5 w-4/5 rounded bg-raised" />
            <div className="h-11 rounded-xl bg-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}
