// Yönetici hesapları: portföy/satış özetini ve kapanan talepleri görürler.
// Sunucu (Apps Script) aynı listeyi ayrıca kontrol eder; buradaki liste yalnızca ekranı düzenler.
export const ADMIN_EMAILS = ['ilbey@palmiyeyatirim.com', 'zahit@palmiyeyatirim.com', 'omer@palmiyeyatirim.com'];

// Danışman listelerinde (rehber, panel) gösterilmeyen hesaplar. Hesap çalışmaya devam eder.
export const HIDDEN_EMAILS = ['zahit@palmiyeyatirim.com'];

export const isAdmin = (email?: string | null) => ADMIN_EMAILS.includes((email ?? '').trim().toLowerCase());
export const isHiddenPerson = (email?: string | null) => HIDDEN_EMAILS.includes((email ?? '').trim().toLowerCase());

// İsim karşılaştırması: büyük/küçük harf ve Türkçe karakter farkı önemsiz ("Ersin Aktarlı" = "ersin aktarli")
export const foldName = (s: string) =>
  (s || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();

// İlanın durumunu (pasif, satıldı, sil, aktife al) değiştirebilir mi: ilanın danışmanı veya yönetici
export const canManageListing = (agentName: string, userName: string, email: string | null | undefined) =>
  isAdmin(email) || (!!userName && foldName(agentName) === foldName(userName));
