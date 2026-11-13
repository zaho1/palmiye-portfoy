import { useMemo, useState } from 'react';
import { nameOf } from '../lib/people';
import { Heart, LayoutGrid, List, Plus, SlidersHorizontal, UserPlus } from 'lucide-react';
import type { ActivityEntry, CustomerRequest, ListingStatus, Property } from '../types';
import {
  REGIONS,
  daysSince,
  formatDateTime,
  formatPhone,
  formatPrice,
  isIncomplete,
  isRecent,
  isRent,
  isStale,
  kindOf,
  parsePrice,
  parseSize,
  priceDropped,
} from '../lib/sheets';
import { requestsFor } from '../lib/match';
import { useSettings } from '../lib/settings';
import { ContactButtons, Thumb } from './ui';

export type Quick = 'teyitsiz' | 'yeni' | 'eksik' | 'indirim';
export interface ListPreset {
  region?: string;
  quick?: Quick;
  // Yalnızca telefon: yakınımdakiler ve kayıtlı filtre
  nearby?: boolean;
  saved?: string;
}

interface Props {
  properties: Property[];
  requests: CustomerRequest[];
  activity: ActivityEntry[];
  scope: 'all' | 'mine' | 'favorites';
  preset: ListPreset;
  userName: string;
  searchTerm: string;
  presentMode: boolean;
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
}

const TABS: { status: ListingStatus; label: string }[] = [
  { status: 'Aktif', label: 'Aktif' },
  { status: 'Pasif', label: 'Pasif' },
  { status: 'Satıldı', label: 'Satılan / kiralanan' },
  { status: 'Silindi', label: 'Silinen' },
];

type Deal = 'Hepsi' | 'Satılık' | 'Kiralık';
type Sort = 'sheet' | 'newest' | 'price-asc' | 'price-desc' | 'size-desc' | 'oldest-update';

const open = (p: Property) => {
  window.location.hash = `#/ilan/${encodeURIComponent(p.id)}`;
};

const sameMonth = (d: Date | null) => {
  if (!d) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
};

// Satırda tek işaret: önce talep eşleşmesi, sonra fiyat düşüşü
function rowMark(p: Property, matched: number) {
  if (p.status === 'Aktif' && matched > 0) return { text: matched === 1 ? 'Talep eşleşti' : `${matched} talep eşleşti`, cls: 'bg-positive-bg text-positive' };
  if (priceDropped(p)) return { text: 'Fiyat düştü', cls: 'bg-raised text-ink' };
  return null;
}

export default function ListingList({ properties, requests, activity, scope, preset, userName, searchTerm, presentMode, loading, loadError, onRetry }: Props) {
  const { settings, update, favorites } = useSettings();
  const staleDays = settings.staleDays;
  const [tab, setTab] = useState<ListingStatus>('Aktif');
  const [deal, setDeal] = useState<Deal>('Hepsi');
  const [kind, setKind] = useState('Hepsi');
  const [region, setRegion] = useState(preset.region ?? 'Hepsi');
  const [quick, setQuick] = useState<Quick | undefined>(preset.quick);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<Sort>(preset.quick === 'teyitsiz' ? 'oldest-update' : preset.quick === 'yeni' ? 'newest' : 'sheet');
  const [moreFilters, setMoreFilters] = useState(false);
  const view = settings.defaultView;

  const mineKey = userName.toLocaleLowerCase('tr');
  const scoped = useMemo(() => {
    if (scope === 'mine') return properties.filter((p) => p.agentName.toLocaleLowerCase('tr').includes(mineKey));
    if (scope === 'favorites') return properties.filter((p) => favorites.includes(p.id));
    return properties;
  }, [properties, scope, mineKey, favorites]);

  const kinds = useMemo(() => {
    const base = ['Daire', 'Arsa', 'İşyeri'];
    const dynamic = Array.from(new Set(scoped.map((p) => kindOf(p.category)).filter(Boolean)));
    return Array.from(new Set([...base, ...dynamic])).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [scoped]);

  const regionChips = useMemo(() => {
    const extra = scoped.some((p) => p.region === 'Belirtilmemiş') ? ['Belirtilmemiş'] : [];
    const custom = Array.from(new Set(scoped.map((p) => p.region))).filter((r) => !REGIONS.includes(r) && r !== 'Belirtilmemiş');
    return ['Hepsi', ...REGIONS, ...custom, ...extra];
  }, [scoped]);

  const matchCount = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach((p) => m.set(p.id, requestsFor(p, requests).length));
    return m;
  }, [scoped, requests]);

  // Durum dışındaki filtreler; sekme sayıları bu kümeden hesaplanır ki sayılar listeyle aynı olsun.
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr');
    const min = minPrice ? parseInt(minPrice, 10) : 0;
    const max = maxPrice ? parseInt(maxPrice, 10) : Infinity;
    return scoped.filter((p) => {
      if (q) {
        const hay = [p.title, p.description, p.id, p.agentName, presentMode ? '' : p.adaParsel, p.category, p.region, p.neighborhood, p.rooms]
          .join(' ')
          .toLocaleLowerCase('tr');
        if (!hay.includes(q)) return false;
      }
      if (deal !== 'Hepsi' && !p.category.toLocaleLowerCase('tr').includes(deal.toLocaleLowerCase('tr'))) return false;
      if (kind !== 'Hepsi' && kindOf(p.category) !== kind) return false;
      if (region !== 'Hepsi' && p.region !== region) return false;
      if (quick === 'teyitsiz' && !isStale(p, staleDays)) return false;
      if (quick === 'yeni' && !isRecent(p)) return false;
      if (quick === 'eksik' && !isIncomplete(p)) return false;
      if (quick === 'indirim' && !priceDropped(p)) return false;
      const price = parsePrice(p.price);
      return price >= min && price <= max;
    });
  }, [scoped, searchTerm, deal, kind, region, quick, minPrice, maxPrice, presentMode, staleDays]);

  const counts = useMemo(() => {
    const c: Record<ListingStatus, number> = { Aktif: 0, Pasif: 0, Satıldı: 0, Silindi: 0 };
    filtered.forEach((p) => {
      if (p.status in c) c[p.status] += 1;
    });
    return c;
  }, [filtered]);

  const rows = useMemo(() => {
    const r = filtered.filter((p) => p.status === tab);
    const time = (d: Date | null) => d?.getTime() ?? 0;
    if (sort === 'newest') r.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    if (sort === 'price-asc') r.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    if (sort === 'price-desc') r.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    if (sort === 'size-desc') r.sort((a, b) => parseSize(b.size) - parseSize(a.size));
    if (sort === 'oldest-update') r.sort((a, b) => time(a.updatedAt) - time(b.updatedAt));
    return r;
  }, [filtered, tab, sort]);

  // Özet şeridi; ilk yüklemede sıfır yerine çizgi
  const pending = loading && !properties.length;
  const active = scoped.filter((p) => p.status === 'Aktif');
  const activeRent = active.filter(isRent).length;
  const hasDates = scoped.some((p) => p.createdAt);
  const addedThisMonth = scoped.filter((p) => sameMonth(p.createdAt)).length;
  const soldThisMonth = scoped.filter((p) => p.status === 'Satıldı' && sameMonth(p.updatedAt)).length;
  const matchedListings = active.filter((p) => (matchCount.get(p.id) ?? 0) > 0).length;

  const filtersOn = deal !== 'Hepsi' || kind !== 'Hepsi' || region !== 'Hepsi' || quick || minPrice || maxPrice || searchTerm.trim();
  const clearFilters = () => {
    setDeal('Hepsi');
    setKind('Hepsi');
    setRegion('Hepsi');
    setQuick(undefined);
    setMinPrice('');
    setMaxPrice('');
  };

  const QUICK_TITLE: Record<Quick, string> = {
    teyitsiz: `${staleDays}+ gündür teyit edilmeyen ilanlar`,
    yeni: 'Son 7 günde eklenen ilanlar',
    eksik: 'Bilgisi eksik ilanlar',
    indirim: 'Fiyatı düşen ilanlar',
  };
  const title =
    scope === 'mine' ? 'Benim ilanlarım'
    : scope === 'favorites' ? 'Favorilerim'
    : quick ? QUICK_TITLE[quick]
    : region !== 'Hepsi' && preset.region ? `${region} ilanları`
    : 'Ofis portföyü';


  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted mt-1">
          {pending
            ? 'İlanlar yükleniyor…'
            : scope === 'favorites'
              ? 'Yıldızladığınız ilanlar bu cihazda saklanır.'
              : 'Yalova · bütün danışmanların ilanları tek listede.'}
        </p>
      </div>

      {/* Ana işlemler: en çok kullanılan iki iş, ortada ve belirgin */}
      {scope !== 'favorites' && !quick && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto w-full py-2">
          <a
            href="#/yeni"
            className="group flex items-center gap-4 rounded-2xl bg-ink text-ground px-5 py-4 hover:opacity-90 transition-opacity"
          >
            <span className="w-11 h-11 rounded-full bg-ground/15 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">Yeni ilan ekle</span>
              <span className="block text-xs opacity-75">Fotoğraf, fiyat ve konumla portföye ekleyin</span>
            </span>
          </a>
          <a
            href="#/talepler"
            className="group flex items-center gap-4 rounded-2xl bg-surface border border-control px-5 py-4 hover:bg-active transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-positive-bg text-positive flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">Müşteri talebi ekle</span>
              <span className="block text-xs text-muted">
                {requests.filter((r) => r.status === 'Açık').length} açık talep · uyan ilanlar otomatik eşleşir
              </span>
            </span>
          </a>
        </div>
      )}

      {/* Özet: üç sade kutu */}
      <section aria-label="Özet" className="bg-surface rounded-xl grid grid-cols-3 [&>*]:p-3 divide-x divide-rule">
        <Kpi label="Aktif ilan" value={pending ? '—' : active.length} sub={`${active.length - activeRent} satılık · ${activeRent} kiralık`} />
        <Kpi label="Bu ay eklenen" value={hasDates ? addedThisMonth : '—'} sub={`Bu ay satılan / kiralanan: ${hasDates ? soldThisMonth : '—'}`} />
        <a href="#/talepler" className="transition-colors hover:bg-active rounded-r-xl">
          <Kpi label="Talebe uyan ilan" value={pending ? '—' : matchedListings} sub="Eşleşmeleri görmek için tıklayın" />
        </a>
      </section>

      {/* Durum sekmeleri: tam genişlikte 1px çizgi, etiket genişliğinde 2px gösterge */}
      <div className="border-b border-rule overflow-x-auto">
        <div role="tablist" aria-label="İlan durumu" className="flex gap-6 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.status}
              role="tab"
              aria-selected={tab === t.status}
              onClick={() => setTab(t.status)}
              className={`relative h-10 text-sm transition-colors ${tab === t.status ? 'text-ink font-medium' : 'text-nav hover:text-ink'}`}
            >
              {t.label} <span className="num text-faint">{counts[t.status]}</span>
              {tab === t.status && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-ink" />}
            </button>
          ))}
        </div>
      </div>

      {/* Filtreler: tek satır; fiyat ve sıralama "Daha fazla" altında */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 rounded-full bg-surface p-1" role="group" aria-label="Satılık veya kiralık">
            {(['Hepsi', 'Satılık', 'Kiralık'] as Deal[]).map((d) => (
              <button
                key={d}
                onClick={() => setDeal(d)}
                aria-pressed={deal === d}
                className={`px-3 rounded-full text-sm transition-colors ${deal === d ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="kind">Cins</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field h-9 !w-[140px] pr-8">
            <option value="Hepsi">Tüm cinsler</option>
            {kinds.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="region">Bölge</label>
          <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} className="field h-9 !w-[150px] pr-8">
            {regionChips.map((r) => (
              <option key={r} value={r}>{r === 'Hepsi' ? 'Tüm bölgeler' : r}</option>
            ))}
          </select>
          <button
            onClick={() => setMoreFilters((v) => !v)}
            aria-expanded={moreFilters}
            className={`h-9 px-3 rounded-full text-sm flex items-center gap-1.5 border transition-colors ${
              moreFilters || minPrice || maxPrice || sort !== 'sheet' ? 'border-ink text-ink' : 'border-control text-muted hover:text-ink'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Fiyat ve sıralama
          </button>
          {filtersOn && (
            <button onClick={clearFilters} className="h-9 px-2 text-sm text-muted hover:text-ink underline underline-offset-2">
              Temizle
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted num">{rows.length} ilan</span>
            <div className="hidden md:flex h-9 rounded-full bg-surface p-1" role="group" aria-label="Görünüm">
              <button onClick={() => update({ defaultView: 'list' })} aria-pressed={view === 'list'} aria-label="Liste görünümü" className={`w-9 rounded-full flex items-center justify-center ${view === 'list' ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => update({ defaultView: 'grid' })} aria-pressed={view === 'grid'} aria-label="Galeri görünümü" className={`w-9 rounded-full flex items-center justify-center ${view === 'grid' ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {moreFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
            <label className="sr-only" htmlFor="min">En düşük fiyat</label>
            <input id="min" inputMode="numeric" placeholder="En az ₺" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ''))} className="field h-9 !w-32 num" />
            <span className="text-faint">–</span>
            <label className="sr-only" htmlFor="max">En yüksek fiyat</label>
            <input id="max" inputMode="numeric" placeholder="En çok ₺" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))} className="field h-9 !w-32 num" />
            <label className="sr-only" htmlFor="sort">Sıralama</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field h-9 !w-[210px] pr-8 sm:ml-auto">
              <option value="sheet">Sıralama: varsayılan</option>
              <option value="newest">En yeni eklenen</option>
              <option value="oldest-update">En uzun teyitsiz kalan</option>
              <option value="price-asc">Fiyat: düşükten yükseğe</option>
              <option value="price-desc">Fiyat: yüksekten düşüğe</option>
              <option value="size-desc">Metrekare: büyükten küçüğe</option>
            </select>
          </div>
        )}
      </div>

      {/* İçerik */}
      {loadError ? (
        <div className="rounded-lg border border-dashed border-control px-4 py-3 text-muted flex flex-wrap items-center gap-3">
          <span>İlanlar yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.</span>
          <button onClick={onRetry} className="text-ink underline underline-offset-2">Tekrar dene</button>
        </div>
      ) : pending ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-control px-4 py-3 text-muted">
          {scope === 'favorites' && !favorites.length
            ? 'Henüz favori ilan yok. İlan satırındaki kalp simgesiyle ekleyin.'
            : filtersOn
              ? 'Bu filtrelerle eşleşen ilan yok. Bölgeyi veya fiyat aralığını genişletmeyi deneyin.'
              : scope === 'mine'
                ? `Bu sekmede ${userName} adına kayıtlı ilan yok.`
                : 'Bu sekmede ilan yok.'}
        </div>
      ) : view === 'grid' ? (
        <Gallery rows={rows} presentMode={presentMode} matchCount={matchCount} staleDays={staleDays} />
      ) : (
        <Table rows={rows} presentMode={presentMode} matchCount={matchCount} staleDays={staleDays} />
      )}

      {scope === 'all' && !quick && !loading && <OfficePanels activity={activity} />}
    </div>
  );
}

function Kpi({ label, value, sub, warn = false, className = '' }: { label: string; value: number | string; sub: string; warn?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] lg:text-xs text-muted">{label}</p>
      <p className={`text-lg lg:text-xl font-semibold num mt-0.5 ${warn ? 'text-warning' : ''}`}>{value}</p>
      <p className="hidden lg:block text-[11px] text-faint mt-0">{sub}</p>
    </div>
  );
}

function Price({ p, className = '' }: { p: Property; className?: string }) {
  const sold = p.status === 'Satıldı';
  return (
    <span className={`num whitespace-nowrap ${sold ? 'text-muted line-through' : 'text-accent'} ${className}`}>
      {formatPrice(p.price)}
      {isRent(p) && <span className="text-faint no-underline"> /ay</span>}
    </span>
  );
}

function Freshness({ p, staleDays }: { p: Property; staleDays: number }) {
  const d = daysSince(p.updatedAt);
  if (d === null) return null;
  const stale = isStale(p, staleDays);
  return (
    <span className={stale ? 'text-warning' : ''}>
      {' · '}
      {stale ? `${d} gündür teyitsiz` : d === 0 ? 'bugün güncellendi' : `${d} gün önce güncellendi`}
    </span>
  );
}

function Mark({ p, matched }: { p: Property; matched: number }) {
  const m = rowMark(p, matched);
  if (!m) return null;
  return <span className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-medium whitespace-nowrap flex-none ${m.cls}`}>{m.text}</span>;
}

export function FavoriteButton({ id, className = '' }: { id: string; className?: string }) {
  const { favorites, toggleFavorite } = useSettings();
  const on = favorites.includes(id);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(id);
      }}
      aria-pressed={on}
      aria-label={on ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      title={on ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      className={`w-9 h-9 rounded-full flex items-center justify-center flex-none transition-colors ${on ? 'text-negative' : 'text-faint hover:text-ink'} ${className}`}
    >
      <Heart className="w-4 h-4" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

function Table({ rows, presentMode, matchCount, staleDays }: { rows: Property[]; presentMode: boolean; matchCount: Map<string, number>; staleDays: number }) {
  return (
    <>
      {/* Masaüstü ve tablet: tablo */}
      <div className="hidden md:block -mx-2 overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="font-normal px-2 h-9">İlan</th>
              {!presentMode && <th className="font-normal px-2 h-9 hidden lg:table-cell">Ada / parsel</th>}
              <th className="font-normal px-2 h-9 text-right">Alan</th>
              <th className="font-normal px-2 h-9 text-right">Fiyat</th>
              <th className="font-normal px-2 h-9 hidden lg:table-cell">Danışman</th>
              <th className="px-2 h-9"><span className="sr-only">İletişim ve favori</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} onClick={() => open(p)} className="border-t border-rule cursor-pointer hover:bg-surface transition-colors">
                <td className="px-2 py-3 w-[44%]">
                  <div className="flex items-center gap-3 min-w-0">
                    <Thumb src={p.imageUrl} alt="" className="w-16 h-12 rounded flex-none" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <a href={`#/ilan/${encodeURIComponent(p.id)}`} onClick={(e) => e.stopPropagation()} className="font-medium truncate hover:underline underline-offset-2">
                          {p.title}
                        </a>
                        <Mark p={p} matched={matchCount.get(p.id) ?? 0} />
                      </div>
                      <p className="text-xs text-faint mt-0.5 truncate">
                        <span className="num">{p.id}</span> · {p.category}
                        {p.region !== 'Belirtilmemiş' ? ` · ${p.region}${p.neighborhood ? ` ${p.neighborhood}` : ''}` : ''}
                        {p.rooms ? ` · ${p.rooms}` : ''}
                        <Freshness p={p} staleDays={staleDays} />
                      </p>
                    </div>
                  </div>
                </td>
                {!presentMode && (
                  <td className="px-2 py-3 hidden lg:table-cell num">{p.adaParsel?.trim() || <span className="text-faint">—</span>}</td>
                )}
                <td className="px-2 py-3 text-right num whitespace-nowrap">
                  {parseSize(p.size) ? <>{parseSize(p.size).toLocaleString('tr-TR')}<span className="text-faint"> m²</span></> : <span className="text-faint">—</span>}
                </td>
                <td className="px-2 py-3 text-right font-medium">
                  <Price p={p} />
                  {priceDropped(p) && <p className="text-xs text-faint line-through num font-normal">{formatPrice(p.oldPrice || '')}</p>}
                </td>
                <td className="px-2 py-3 hidden lg:table-cell">
                  <p className="truncate max-w-[200px]">{p.agentName}</p>
                  <p className="text-xs text-faint num">{p.agentPhone ? formatPhone(p.agentPhone) : '—'}</p>
                </td>
                <td className="px-2 py-3 w-[132px]">
                  <div className="flex items-center justify-end gap-1">
                    <FavoriteButton id={p.id} />
                    <ContactButtons p={p} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Telefon: iki satırlı liste */}
      <ul className="md:hidden -mx-4">
        {rows.map((p) => (
          <li key={p.id} className="border-t border-rule first:border-t-0 flex items-center pr-2">
            <a href={`#/ilan/${encodeURIComponent(p.id)}`} className="flex gap-3 pl-4 py-3 active:bg-surface flex-1 min-w-0">
              <Thumb src={p.imageUrl} alt="" className="w-16 h-16 rounded flex-none" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.title}</p>
                <p className="mt-0.5 text-sm font-medium flex items-center gap-2"><Price p={p} /><Mark p={p} matched={matchCount.get(p.id) ?? 0} /></p>
                <p className="text-[13px] text-faint truncate mt-0.5">
                  {p.region !== 'Belirtilmemiş' ? `${p.region} · ` : ''}
                  {p.category}
                  {parseSize(p.size) ? ` · ${parseSize(p.size)} m²` : ''}
                  {!presentMode && p.adaParsel?.trim() ? ` · ${p.adaParsel}` : ''} · {p.agentName}
                  <Freshness p={p} staleDays={staleDays} />
                </p>
              </div>
            </a>
            <FavoriteButton id={p.id} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Gallery({ rows, presentMode, matchCount, staleDays }: { rows: Property[]; presentMode: boolean; matchCount: Map<string, number>; staleDays: number }) {
  return (
    <div className="grid gap-[14px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
      {rows.map((p) => (
        <article key={p.id} onClick={() => open(p)} className="bg-surface rounded-xl overflow-hidden cursor-pointer group flex flex-col">
          <div className="relative">
            <Thumb src={p.imageUrl} alt="" className="w-full aspect-[4/3] group-hover:opacity-90 transition-opacity" />
            <FavoriteButton id={p.id} className="absolute right-2 top-2 bg-surface/90" />
          </div>
          <div className="p-[14px] flex-1 flex flex-col gap-1">
            <p className="text-base font-semibold flex items-center gap-2"><Price p={p} /><Mark p={p} matched={matchCount.get(p.id) ?? 0} /></p>
            <a href={`#/ilan/${encodeURIComponent(p.id)}`} onClick={(e) => e.stopPropagation()} className="font-medium line-clamp-2 hover:underline underline-offset-2">
              {p.title}
            </a>
            <p className="text-xs text-faint">
              {p.region !== 'Belirtilmemiş' ? `${p.region} · ` : ''}
              {p.category}
              {parseSize(p.size) ? ` · ${parseSize(p.size)} m²` : ''}
              {!presentMode && p.adaParsel?.trim() ? ` · Ada/parsel ${p.adaParsel}` : ''}
              <Freshness p={p} staleDays={staleDays} />
            </p>
            <div className="flex items-center gap-3 mt-auto pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{p.agentName}</p>
                <p className="text-xs text-faint num">{p.agentPhone ? formatPhone(p.agentPhone) : '—'}</p>
              </div>
              <ContactButtons p={p} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

// Alt panel: sadece son hareketler
function OfficePanels({ activity }: { activity: ActivityEntry[] }) {
  const filteredActivity = activity.filter((a) =>
    a.action === 'Not' || a.action === 'Durum' || a.action === 'Fiyat' ||
    a.action === 'İlan eklendi' || a.action === 'Satıldı / kiralandı' ||
    a.action === 'Müşteri talebi eklendi' || a.action === 'Müşteri talebi kapandı'
  );

  return (
    <section className="pt-4">
      <div className="bg-surface rounded-xl p-3">
        <h2 className="text-sm font-semibold">Son hareketler</h2>
        {filteredActivity.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Henüz kayıt yok.</p>
        ) : (
          <ul className="mt-2">
            {filteredActivity.slice(0, 4).map((a, i) => (
              <li key={i} className="flex gap-2 py-1.5 border-t border-rule first:border-t-0 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{a.action}</span>
                    {a.title && <span className="text-muted"> · {a.title}</span>}
                  </p>
                  <p className="text-[11px] text-faint truncate">{[nameOf(a.who), /^[A-Z]{1,3}-[A-Z0-9]+$/.test(a.detail.trim()) ? '' : a.detail].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-[11px] text-faint num whitespace-nowrap">{formatDateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div aria-label="Yükleniyor" className="-mx-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-3 border-t border-rule">
          <div className="w-16 h-12 rounded bg-surface" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 rounded bg-surface" />
            <div className="h-3 w-1/5 rounded bg-surface" />
          </div>
          <div className="h-3.5 w-24 rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
