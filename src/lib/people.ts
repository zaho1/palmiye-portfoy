import { OFFICE_AUTH_CONFIG } from '../config/auth';

// Hareket kayıtlarında "Kim" sütunu e-posta tutar; ekranda ad gösterilir.
export function nameOf(who: string): string {
  const u = OFFICE_AUTH_CONFIG.allowedUsers.find((x) => x.email.toLowerCase() === who.toLowerCase());
  if (u) return u.name;
  return who.includes('@') ? who.split('@')[0] : who;
}
