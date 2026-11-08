import { useSyncExternalStore } from 'react';

// Kişiye ve cihaza özel küçük kayıtlar (son baktıklarım, kayıtlı filtreler, taslaklar).
// Yalnızca bu telefonda tutulur; ortak bilgisayarda çıkış yapılınca silinir.

interface Store<T> {
  get: () => T;
  set: (value: T) => void;
  clear: () => void;
  subscribe: (cb: () => void) => () => void;
}

function makeStore<T>(key: string, initial: T): Store<T> {
  const subs = new Set<() => void>();
  let raw: string | null | undefined;
  let cache: T = initial;
  const emit = () => subs.forEach((f) => f());
  const get = () => {
    let r: string | null = null;
    try {
      r = localStorage.getItem(key);
    } catch {
      /* depolama kapalı */
    }
    if (r !== raw) {
      raw = r;
      try {
        cache = r ? (JSON.parse(r) as T) : initial;
      } catch {
        cache = initial;
      }
    }
    return cache;
  };
  return {
    get,
    set(value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* dolu veya kapalıysa bu oturumda yine de çalışır */
        cache = value;
        raw = undefined;
      }
      emit();
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* önemsiz */
      }
      raw = undefined;
      cache = initial;
      emit();
    },
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

export const useStore = <T,>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get);

/* ---------- Son baktığım ilanlar ---------- */

const MAX_RECENTS = 12;
export const recentsStore = makeStore<string[]>('palmiye_recents', []);

export function rememberView(id: string) {
  const list = recentsStore.get();
  if (list[0] === id) return;
  recentsStore.set([id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENTS));
}

/* ---------- Kayıtlı filtreler ---------- */

export interface SavedFilter {
  id: string;
  name: string;
  deal: string;
  kind: string;
  region: string;
  minPrice: string;
  maxPrice: string;
  quick?: string;
  status: string;
  sort: string;
}

export const savedFiltersStore = makeStore<SavedFilter[]>('palmiye_saved_filters', []);

export function saveFilter(f: Omit<SavedFilter, 'id'>) {
  const list = savedFiltersStore.get();
  savedFiltersStore.set([...list, { ...f, id: `f${Date.now().toString(36)}` }].slice(-8));
}
export const deleteFilter = (id: string) => savedFiltersStore.set(savedFiltersStore.get().filter((f) => f.id !== id));

/* ---------- Talebe uyan ilanlar: hangileri görüldü ---------- */

// Talep numarası -> görülmüş ilan numaraları. Yeni uyanlar "yeni" diye işaretlenir.
export const seenMatchesStore = makeStore<Record<string, string[]>>('palmiye_seen_matches', {});

/* ---------- Taslaklar ---------- */

export interface ListingDraft {
  savedAt: number;
  step: number;
  images: string[];
  features: string[];
  form: Record<string, string>;
  location: { lat: number; lng: number } | null;
}

export const listingDraftStore = makeStore<ListingDraft | null>('palmiye_draft_listing', null);
export const requestDraftStore = makeStore<{ savedAt: number; form: Record<string, string> } | null>('palmiye_draft_request', null);

/** Çıkışta kişisel kayıtların hepsi silinir. */
export function clearPersonal() {
  recentsStore.clear();
  savedFiltersStore.clear();
  seenMatchesStore.clear();
  listingDraftStore.clear();
  requestDraftStore.clear();
}

/* ---------- Küçük yardımcılar ---------- */

/** Android'de kısa titreşim; iPhone desteklemez, sessizce atlanır. */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* önemsiz */
  }
}

export function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || '';
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}
