import { OFFICE_AUTH_CONFIG } from '../config/auth';
import type { SessionUser } from './sheets';
import { makeStore, useStore } from './personal';

// Ofis rehberi: sunucudaki "Danışmanlar" sayfasından gelir (30-40 kişi). Gelene kadar auth.ts'teki liste kullanılır.
export const directoryStore = makeStore<SessionUser[]>('palmiye_directory', []);

const fallback = (): SessionUser[] => OFFICE_AUTH_CONFIG.allowedUsers.map((u) => ({ ...u, role: 'Danışman' }));

export function getDirectory(): SessionUser[] {
  const list = directoryStore.get();
  return list.length ? list : fallback();
}

export function useDirectory(): SessionUser[] {
  const list = useStore(directoryStore);
  return list.length ? list : fallback();
}

export const personOf = (email: string): SessionUser | undefined => getDirectory().find((u) => u.email.toLowerCase() === email.toLowerCase());

// Hareket kayıtlarında "Kim" sütunu e-posta tutar; ekranda ad gösterilir.
export function nameOf(who: string): string {
  const u = personOf(who);
  if (u) return u.name;
  return who.includes('@') ? who.split('@')[0] : who;
}
