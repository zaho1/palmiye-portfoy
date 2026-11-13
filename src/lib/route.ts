import type { ListPreset } from '../components/ListingList';

export type Route =
  | { name: 'today' }
  | { name: 'list'; preset: ListPreset }
  | { name: 'mine' }
  | { name: 'favorites' }
  | { name: 'new' }
  | { name: 'newRequest' }
  | { name: 'requests' }
  | { name: 'map' }
  | { name: 'me' }
  | { name: 'team' }
  | { name: 'agent'; agent: string }
  | { name: 'settings' }
  | { name: 'detail'; id: string }
  | { name: 'brochure'; id: string }
  | { name: 'comps'; id: string }
  | { name: 'report'; id: string };

// Hash yönlendirme: tarayıcının geri tuşu çalışır, linkler paylaşılabilir.
// Liste filtreleri: #/?bolge=Altınova, #/?filtre=teyitsiz|yeni|eksik|indirim
// Telefon: #/?yakin=1 (yakınımdakiler), #/?kf=<id> (kayıtlı filtre)
// #/danismanlar (ofis rehberi), #/danisman/<ad> (o danışmanın ilanları)
// #/bugun, #/talep/yeni ve #/ben yalnızca telefon ekranlarıdır; masaüstünde App içinde karşılığına düşer.
export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('ilan/')) return { name: 'detail', id: decodeURIComponent(h.slice(5)) };
  if (h.startsWith('brosur/')) return { name: 'brochure', id: decodeURIComponent(h.slice(7)) };
  if (h.startsWith('emsal/')) return { name: 'comps', id: decodeURIComponent(h.slice(6)) };
  if (h.startsWith('rapor/')) return { name: 'report', id: decodeURIComponent(h.slice(6)) };
  if (h === 'yeni') return { name: 'new' };
  if (h === 'talep/yeni') return { name: 'newRequest' };
  if (h === 'benim') return { name: 'mine' };
  if (h === 'favoriler') return { name: 'favorites' };
  if (h === 'talepler') return { name: 'requests' };
  if (h === 'bugun') return { name: 'today' };
  if (h === 'harita') return { name: 'map' };
  if (h === 'ben') return { name: 'me' };
  if (h === 'danismanlar') return { name: 'team' };
  if (h.startsWith('danisman/')) return { name: 'agent', agent: decodeURIComponent(h.slice(9)) };
  if (h === 'ayarlar') return { name: 'settings' };
  const q = new URLSearchParams(h.startsWith('?') ? h.slice(1) : '');
  const quick = q.get('filtre');
  return {
    name: 'list',
    preset: {
      region: q.get('bolge') ?? undefined,
      quick: quick === 'teyitsiz' || quick === 'yeni' || quick === 'eksik' || quick === 'indirim' ? quick : undefined,
      nearby: q.get('yakin') === '1' ? true : undefined,
      saved: q.get('kf') ?? undefined,
    },
  };
}
