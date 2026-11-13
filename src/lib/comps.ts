import { useCallback, useEffect, useState } from 'react';
import type { Comp, Property } from '../types';
import { fetchComps, isRent, kindOf, parsePrice, parseSize, type SaleComp } from './sheets';

/**
 * Emsal analizi.
 * Kaynaklar: (1) portföyümüzdeki benzer ilanlar (satılanlar dahil),
 * (2) danışmanların elle girdiği emsaller ("Emsaller" sayfası; ör. sahibinden'de görülen ilanlar).
 * Sahibinden'den otomatik veri çekilmez; yalnızca filtreli arama sayfası açılır.
 */

export type CompSource = 'portfoy' | 'manuel';

export interface CompItem {
  key: string;
  source: CompSource;
  title: string;
  price: number;
  size: number;
  perM2: number; // 0: m² bilinmiyor
  region: string;
  neighborhood: string;
  rooms: string;
  state: 'İlanda' | 'Satıldı' | 'Pasif';
  realized: boolean; // gerçekleşen satış fiyatı mı (yalnızca yöneticide gelir)
  propertyId?: string;
  link?: string;
  comp?: Comp;
  score: number;
  note?: string;
}

const norm = (s?: string) => (s || '').toLocaleLowerCase('tr').trim();
const kindKey = (category: string) => norm(kindOf(category));
const rentOf = (category: string) => norm(category).includes('kiralık');

function similarity(base: { region: string; neighborhood?: string; rooms?: string; size: number }, x: { region: string; neighborhood?: string; rooms?: string; size: number }) {
  let score = 0;
  if (base.region && base.region !== 'Belirtilmemiş' && norm(x.region) === norm(base.region)) score += 3;
  if (base.neighborhood && norm(x.neighborhood) === norm(base.neighborhood)) score += 2;
  if (base.rooms && norm(x.rooms) === norm(base.rooms)) score += 1;
  if (base.size && x.size) {
    const r = Math.min(base.size, x.size) / Math.max(base.size, x.size);
    score += 2 * r;
    if (r < 0.5) score -= 2; // boyut çok farklı
  }
  return score;
}

export function buildComps(p: Property, properties: Property[], comps: Comp[], sales: SaleComp[]): CompItem[] {
  const rent = isRent(p);
  const kind = kindKey(p.category);
  const size = parseSize(p.size);
  const base = { region: p.region, neighborhood: p.neighborhood, rooms: p.rooms, size };
  const realizedByTitle = new Map<string, number>();
  sales.forEach((s) => s.price > 0 && realizedByTitle.set(norm(s.title), s.price));

  const fromPortfolio: CompItem[] = properties
    .filter((x) => x.id !== p.id && x.status !== 'Silindi' && isRent(x) === rent && kindKey(x.category) === kind)
    .map((x) => {
      const xs = parseSize(x.size);
      const realized = x.status === 'Satıldı' ? realizedByTitle.get(norm(x.title)) : undefined;
      const price = realized ?? parsePrice(x.price);
      return {
        key: `p-${x.id}`,
        source: 'portfoy' as const,
        title: x.title,
        price,
        size: xs,
        perM2: price && xs ? Math.round(price / xs) : 0,
        region: x.region,
        neighborhood: x.neighborhood || '',
        rooms: x.rooms || '',
        state: x.status === 'Satıldı' ? ('Satıldı' as const) : x.status === 'Pasif' ? ('Pasif' as const) : ('İlanda' as const),
        realized: realized !== undefined,
        propertyId: x.id,
        score: similarity(base, { region: x.region, neighborhood: x.neighborhood, rooms: x.rooms, size: xs }) + (x.status === 'Satıldı' ? 0.5 : 0),
      };
    })
    .filter((i) => i.price > 0);

  const manual: CompItem[] = comps
    .filter((c) => rentOf(c.category) === rent && kindKey(c.category) === kind)
    .map((c) => ({
      key: `m-${c.id}`,
      source: 'manuel' as const,
      title: [c.rooms, c.neighborhood || c.region, c.source].filter(Boolean).join(' · ') || 'Emsal',
      price: c.price,
      size: c.size,
      perM2: c.price && c.size ? Math.round(c.price / c.size) : 0,
      region: c.region,
      neighborhood: c.neighborhood,
      rooms: c.rooms,
      state: c.state,
      realized: false,
      link: c.link,
      comp: c,
      note: c.note,
      // Bu ilan için girilen emsaller öne çıkar
      score: similarity(base, c) + (norm(c.forTitle) === norm(p.title) ? 3 : 0),
    }));

  return [...manual, ...fromPortfolio].sort((a, b) => b.score - a.score);
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
};

export interface CompStats {
  count: number; // m² fiyatı olan emsal sayısı
  median: number;
  p25: number;
  p75: number;
  position: number | null; // bu ilanın m² fiyatı medyana göre (0.08 = %8 üstünde)
  estimate: { low: number; mid: number; high: number } | null;
}

// Puanı en yüksek emsallerden (varsayılan 10) m² istatistiği
export function compStats(p: Property, items: CompItem[], limit = 10): CompStats {
  const usable = items.filter((i) => i.perM2 > 0).slice(0, limit);
  const sorted = usable.map((i) => i.perM2).sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const size = parseSize(p.size);
  const own = size ? parsePrice(p.price) / size : 0;
  const round = (n: number) => {
    const step = n >= 10_000_000 ? 100_000 : n >= 1_000_000 ? 50_000 : n >= 100_000 ? 5_000 : 500;
    return Math.round(n / step) * step;
  };
  const p25 = quantile(sorted, 0.25);
  const p75 = quantile(sorted, 0.75);
  return {
    count: sorted.length,
    median,
    p25,
    p75,
    position: own && median ? own / median - 1 : null,
    estimate: size && sorted.length >= 3 ? { low: round(p25 * size), mid: round(median * size), high: round(p75 * size) } : null,
  };
}

/* ---------- Sahibinden arama bağlantısı ---------- */

const REGION_SLUG: Record<string, string> = {
  Merkez: 'yalova-merkez',
  Çiftlikköy: 'yalova-ciftlikkoy',
  Altınova: 'yalova-altinova',
  Çınarcık: 'yalova-cinarcik',
  Termal: 'yalova-termal',
  Armutlu: 'yalova-armutlu',
};

function kindSlug(category: string): string | null {
  const k = norm(kindOf(category));
  if (k.includes('daire')) return 'daire';
  if (k.includes('villa')) return 'villa';
  if (k.includes('müstakil')) return 'mustakil-ev';
  if (k.includes('arsa')) return 'arsa';
  return null;
}

// Benzer ilanları sahibinden'in kendi arama sayfasında açar (kategori + ilçe + ±%25 fiyat).
// Kategori eşlemesi bilinmiyorsa anahtar kelimeli genel aramaya düşer.
export function sahibindenSearchUrl(p: Property): string {
  const rent = isRent(p);
  const price = parsePrice(p.price);
  const q = new URLSearchParams();
  if (price) {
    q.set('price_min', String(Math.round((price * 0.75) / 1000) * 1000));
    q.set('price_max', String(Math.round((price * 1.25) / 1000) * 1000));
  }
  const slug = kindSlug(p.category);
  const place = REGION_SLUG[p.region] ?? 'yalova';
  const qs = q.toString();
  if (slug) return `https://www.sahibinden.com/${rent ? 'kiralik' : 'satilik'}-${slug}/${place}${qs ? `?${qs}` : ''}`;
  return sahibindenKeywordUrl(p);
}

export function sahibindenKeywordUrl(p: Property): string {
  const words = ['Yalova', p.region !== 'Belirtilmemiş' ? p.region : '', p.category, p.rooms].filter(Boolean).join(' ');
  return `https://www.sahibinden.com/arama?query_text=${encodeURIComponent(words)}`;
}

/* ---------- Veri: Emsaller sayfası (önbellekli) ---------- */

let cache: { comps: Comp[]; sales: SaleComp[] } | null = null;

export function useComps() {
  const [data, setData] = useState(cache);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(cache ? 'ready' : 'loading');

  const reload = useCallback(() => {
    return fetchComps()
      .then((d) => {
        cache = d;
        setData(d);
        setState('ready');
      })
      .catch(() => setState((s) => (cache ? s : 'error')));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Ekleme/silme sonrası ekranı hemen güncellemek için
  const mutate = useCallback((fn: (comps: Comp[]) => Comp[]) => {
    const next = { comps: fn(cache?.comps ?? []), sales: cache?.sales ?? [] };
    cache = next;
    setData(next);
  }, []);

  return { comps: data?.comps ?? [], sales: data?.sales ?? [], state, reload, mutate };
}

export const fmtTL = (n: number) => (n ? `${n.toLocaleString('tr-TR')} TL` : '—');
export const fmtPct = (x: number) => `%${Math.abs(Math.round(x * 100))} ${x >= 0 ? 'üstünde' : 'altında'}`;
