import type { ActivityEntry, Property } from '../types';

/**
 * Bekleyen değişiklikler.
 *
 * Google'ın yayınlanmış CSV'si birkaç dakika önbellekte kalır. Bir ilan eklenip silindiğinde
 * ekran hemen güncellenir ama sonraki yenilemede eski CSV gelince değişiklik "geri alınmış" gibi
 * görünürdü (gidip gelme). Burada yapılan her değişiklik, Sheets'ten gelen veri aynı sonucu
 * gösterene kadar (en fazla 30 dk) cihazda saklanır ve gelen verinin üzerine uygulanır.
 */

const KEY = 'palmiye_pending_v1';
const MAX_AGE_MS = 30 * 60 * 1000;

type Patch = Partial<Pick<Property, 'status' | 'price' | 'oldPrice' | 'lat' | 'lng'>>;

interface PendingAdd {
  title: string;
  at: number;
  property: Omit<Property, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };
}
interface PendingPatch {
  title: string;
  at: number;
  change: Patch;
}
interface PendingNote {
  key: string; // noteId veya not metni
  title: string;
  at: number;
}

interface Store {
  adds: PendingAdd[];
  patches: PendingPatch[];
  deletedNotes: PendingNote[];
}

const empty = (): Store => ({ adds: [], patches: [], deletedNotes: [] });

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw) as Store;
    const now = Date.now();
    return {
      adds: (s.adds ?? []).filter((x) => now - x.at < MAX_AGE_MS),
      patches: (s.patches ?? []).filter((x) => now - x.at < MAX_AGE_MS),
      // Silinen notlar daha uzun tutulur: eski script satırı silmiyorsa bile bu cihazda gizli kalsın
      deletedNotes: (s.deletedNotes ?? []).filter((x) => now - x.at < 30 * 24 * 60 * 60 * 1000),
    };
  } catch {
    return empty();
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* depolama kapalıysa yalnızca bu oturumda geçerli */
  }
}

const norm = (t: string) => t.trim().toLocaleLowerCase('tr');

export function rememberAdd(p: Property) {
  const s = read();
  s.adds = s.adds.filter((a) => norm(a.title) !== norm(p.title));
  s.adds.push({
    title: p.title,
    at: Date.now(),
    property: { ...p, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  });
  write(s);
}

export function rememberPatch(title: string, change: Patch) {
  const s = read();
  const existing = s.patches.find((x) => norm(x.title) === norm(title));
  if (existing) {
    existing.change = { ...existing.change, ...change };
    existing.at = Date.now();
  } else {
    s.patches.push({ title, at: Date.now(), change });
  }
  write(s);
}

export function forgetPatch(title: string) {
  const s = read();
  s.patches = s.patches.filter((x) => norm(x.title) !== norm(title));
  write(s);
}

export function rememberDeletedNote(title: string, key: string) {
  const s = read();
  s.deletedNotes.push({ title, key, at: Date.now() });
  write(s);
}

function samePatch(p: Property, change: Patch) {
  return (Object.keys(change) as (keyof Patch)[]).every((k) => {
    const want = change[k];
    const have = p[k];
    if (k === 'lat' || k === 'lng') return have !== undefined && Math.abs(Number(have) - Number(want)) < 1e-4;
    return String(have ?? '').trim() === String(want ?? '').trim();
  });
}

/** Sheets'ten gelen ilanların üzerine bekleyen değişiklikleri uygular; Sheets'e işlenmiş olanları temizler. */
export function mergeProperties(fetched: Property[]): Property[] {
  const s = read();
  const byTitle = new Map(fetched.map((p) => [norm(p.title), p]));

  // Sheets artık aynı değeri gösteriyorsa beklemeye gerek yok
  s.patches = s.patches.filter((x) => {
    const p = byTitle.get(norm(x.title));
    return !p || !samePatch(p, x.change);
  });
  s.adds = s.adds.filter((a) => !byTitle.has(norm(a.title)));
  write(s);

  const merged = fetched.map((p) => {
    const patch = s.patches.find((x) => norm(x.title) === norm(p.title));
    return patch ? { ...p, ...patch.change } : p;
  });

  const added: Property[] = s.adds.map((a, i) => ({
    ...a.property,
    id: a.property.id || `YENİ-${i + 1}`,
    createdAt: new Date(a.property.createdAt),
    updatedAt: new Date(a.property.updatedAt),
  }));

  return [...merged, ...added];
}

/** Silinmiş notları ve "Not silindi" kayıtlarını hareket listesinden çıkarır. */
export function cleanActivity(entries: ActivityEntry[]): ActivityEntry[] {
  const s = read();
  const removed = new Set<string>();
  s.deletedNotes.forEach((d) => removed.add(`${norm(d.title)}::${d.key}`));
  // Eski script notu silmek yerine "Not silindi" satırı ekliyordu; o satırın işaret ettiği notu da gizle
  entries
    .filter((a) => a.action === 'Not silindi')
    .forEach((a) => {
      if (a.noteId) removed.add(`${norm(a.title)}::${a.noteId}`);
      if (a.detail) removed.add(`${norm(a.title)}::${a.detail}`);
    });

  return entries.filter((a) => {
    if (a.action === 'Not silindi') return false;
    if (a.action !== 'Not') return true;
    const t = norm(a.title);
    return !(removed.has(`${t}::${a.noteId ?? ''}`) || removed.has(`${t}::${a.detail}`));
  });
}
