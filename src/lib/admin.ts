// Yönetici hesapları: portföy/satış özetini ve kapanan talepleri görürler.
// Sunucu (Apps Script) aynı listeyi ayrıca kontrol eder; buradaki liste yalnızca ekranı düzenler.
export const ADMIN_EMAILS = ['ilbey@palmiyeyatirim.com', 'zahit@palmiyeyatirim.com', 'omer@palmiyeyatirim.com'];

// Danışman listelerinde (rehber, panel) gösterilmeyen hesaplar. Hesap çalışmaya devam eder.
export const HIDDEN_EMAILS = ['zahit@palmiyeyatirim.com'];

export const isAdmin = (email?: string | null) => ADMIN_EMAILS.includes((email ?? '').trim().toLowerCase());
export const isHiddenPerson = (email?: string | null) => HIDDEN_EMAILS.includes((email ?? '').trim().toLowerCase());
