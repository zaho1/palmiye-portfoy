import type { ListPreset } from '../components/ListingList';

export type Route =
  | { name: 'list'; preset: ListPreset }
  | { name: 'mine' }
  | { name: 'favorites' }
  | { name: 'new' }
  | { name: 'newRequest' }
  | { name: 'requests' }
  | { name: 'map' }
  | { name: 'me' }
  | { name: 'settings' }
  | { name: 'detail'; id: string }
  | { name: 'brochure'; id: string };

// Hash yönlendirme: tarayıcının geri tuşu çalışır, linkler paylaşılabilir.
// Liste filtreleri: #/?bolge=Altınova, #/?filtre=teyitsiz|yeni|eksik|indirim
// #/talep/yeni ve #/ben yalnızca telefon ekranlarıdır; masaüstünde App içinde karşılığına düşer.
export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('ilan/')) return { name: 'detail', id: decodeURIComponent(h.slice(5)) };
  if (h.startsWith('brosur/')) return { name: 'brochure', id: decodeURIComponent(h.slice(7)) };
  if (h === 'yeni') return { name: 'new' };
  if (h === 'talep/yeni') return { name: 'newRequest' };
  if (h === 'benim') return { name: 'mine' };
  if (h === 'favoriler') return { name: 'favorites' };
  if (h === 'talepler') return { name: 'requests' };
  if (h === 'harita') return { name: 'map' };
  if (h === 'ben') return { name: 'me' };
  if (h === 'ayarlar') return { name: 'settings' };
  const q = new URLSearchParams(h.startsWith('?') ? h.slice(1) : '');
  const quick = q.get('filtre');
  return {
    name: 'list',
    preset: {
      region: q.get('bolge') ?? undefined,
      quick: quick === 'teyitsiz' || quick === 'yeni' || quick === 'eksik' || quick === 'indirim' ? quick : undefined,
    },
  };
}
