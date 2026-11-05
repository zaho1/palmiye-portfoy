import Papa from 'papaparse';
import type { ActivityEntry, CustomerRequest, ListingStatus, OwnerInfo, Property } from '../types';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrZ9plOA7q5mwahYBk3pW9GdMIBeIORrfRWBKx1wVetpliFeVt_hId-aoaQncMst5mF42RSnCxzQZw/pub?output=csv';
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxrz5C7MO9i1Xrer7fxclyAIV-UHNjJ1bCr99BkWaZ6fKmbi9FhUkpEHoSKZbFlP0kAUg/exec';

export const REGIONS = ['Merkez', 'Çiftlikköy', 'Altınova', 'Çınarcık', 'Termal', 'Armutlu'];
export const STALE_DAYS = 30;

// İlçe merkezleri: konumu işaretlenmemiş ilanlar haritada burada "yaklaşık" görünür
export const REGION_CENTERS: Record<string, [number, number]> = {
  Merkez: [40.6555, 29.2769],
  Çiftlikköy: [40.6614, 29.3236],
  Altınova: [40.6961, 29.5081],
  Çınarcık: [40.6430, 29.1203],
  Termal: [40.6083, 29.1736],
  Armutlu: [40.5194, 28.8297],
};
export const YALOVA_CENTER: [number, number] = [40.62, 29.2];

export function parseLocation(s?: string): { lat: number; lng: number } | null {
  const m = (s || '').match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export const formatLocation = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

export function coordsOf(p: Property): { lat: number; lng: number; approx: boolean } | null {
  if (p.lat !== undefined && p.lng !== undefined) return { lat: p.lat, lng: p.lng, approx: false };
  const c = REGION_CENTERS[p.region];
  return c ? { lat: c[0], lng: c[1], approx: true } : null;
}

// Her işlem Hareketler sayfasına kimin yaptığıyla yazılır
let apiUser = '';
export const setApiUser = (email: string) => {
  apiUser = email;
};

/* ---------- Tarih ---------- */

// Sheets tarihi farklı biçimlerde verebilir: "2026-10-21 22:30", "21.10.2026 22:30:00", "10/21/2026 22:30:00"
export function parseDate(s?: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?: (\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2], +(m[4] ?? 0), +(m[5] ?? 0));
  return null;
}

export function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function relativeDay(d: Date | null): string {
  const n = daysSince(d);
  if (n === null) return '—';
  if (n <= 0) return 'Bugün';
  if (n === 1) return 'Dün';
  return `${n} gün önce`;
}

export function formatDateTime(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// "Bilgisi eksik": ada/parsel, fotoğraf veya metrekare boş
export const isIncomplete = (p: Property) => !p.adaParsel?.trim() || !p.images?.length || !String(p.size ?? '').trim();
export const isRecent = (p: Property) => (daysSince(p.createdAt) ?? 999) <= 7;

export const isStale = (p: Property, days = STALE_DAYS) => p.status === 'Aktif' && (daysSince(p.updatedAt) ?? 0) >= days;

/* ---------- Okuma ---------- */

// Tam kelime araması: "Merkezi konum" Merkez ilçesi sayılmasın
function hasWord(text: string, word: string) {
  const w = word.toLocaleLowerCase('tr');
  return new RegExp(`(^|[^a-zçğıöşü])${w}($|[^a-zçğıöşü])`).test(text.toLocaleLowerCase('tr'));
}

function detectRegion(row: Record<string, string>): string {
  const explicit = (row['Bölge'] || '').trim();
  if (explicit) return explicit;
  // Eski satırlarda Bölge sütunu yok: önce başlıkta, sonra açıklamada ilçe adı aranır.
  // "Merkez" açıklamada çok geçtiği için yalnızca başlıkta sayılır.
  const title = row['İlan Başlığı'] || '';
  const desc = row['Açıklama'] || '';
  const towns = REGIONS.filter((r) => r !== 'Merkez');
  return (
    towns.find((r) => hasWord(title, r)) ??
    (hasWord(title, 'Merkez') ? 'Merkez' : undefined) ??
    towns.find((r) => hasWord(desc, r)) ??
    'Belirtilmemiş'
  );
}

export function fetchProperties(): Promise<Property[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        resolve(
          rows.map((row, index) => {
            // Görseller ||| ile ayrılmış
            const images = (row['Görsel URL'] || '').split('|||').map((s) => s.trim()).filter(Boolean);
            return {
              id: `PLM-${101 + index}`,
              title: (row['İlan Başlığı'] || '').trim() || 'Başlıksız ilan',
              price: row['Fiyat'] || '',
              category: row['Kategori'] || 'Diğer',
              imarStatus: row['İmar Durumu'] || '',
              size: row['m²'] || '',
              description: row['Açıklama'] || '',
              imageUrl: images[0],
              images,
              sahibindenUrl: row['Sahibinden Linki'] || '',
              adaParsel: row['Ada/Parsel'] || '',
              agentName: row['Danışman Bilgileri'] || 'Palmiye Danışmanı',
              agentPhone: row['Danışmanın Telefon Numarası'] || '',
              whatsappUrl: row['WhatsApp Link'] || '',
              status: (row['Durum'] || 'Aktif') as ListingStatus,
              region: detectRegion(row),
              neighborhood: row['Mahalle'] || '',
              rooms: row['Oda Sayısı'] || '',
              floor: row['Kat'] || '',
              buildingAge: row['Bina Yaşı'] || '',
              heating: row['Isınma'] || '',
              features: (row['Özellikler'] || '').split(',').map((s) => s.trim()).filter(Boolean),
              oldPrice: row['Eski Fiyat'] || '',
              createdAt: parseDate(row['Eklenme Tarihi']),
              updatedAt: parseDate(row['Son Güncelleme'] || row['Eklenme Tarihi']),
              ...(parseLocation(row['Konum']) ?? {}),
            };
          }),
        );
      },
      error: (error) => reject(error),
    });
  });
}

// Apps Script GET cevabı CORS ile okunabilir (yalnızca v2 script yayınlandıysa vardır)
async function get<T>(params: Record<string, string>): Promise<T> {
  const res = await fetch(`${SHEET_API_URL}?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.success === false) throw new Error(body.message || 'Apps Script hatası');
  return body as T;
}

export async function fetchRequests(): Promise<CustomerRequest[]> {
  const { rows } = await get<{ rows?: Record<string, string>[] }>({ action: 'requests' });
  if (!rows) throw new Error("Apps Script v2 yayınlanmamış");
  return rows.map((r) => ({
    id: r['Talep No'] || '',
    createdAt: parseDate(r['Tarih']),
    status: r['Durum'] === 'Kapandı' ? 'Kapandı' : 'Açık',
    agentName: r['Danışman'] || '',
    deal: r['Tür'] || '',
    kind: r['Cins'] || '',
    region: r['Bölge'] || '',
    rooms: r['Oda Sayısı'] || '',
    maxPrice: parsePrice(r['En Çok Fiyat'] || ''),
    minSize: parseSize(r['En Az m²'] || ''),
    note: r['Not'] || '',
  }));
}

export async function fetchActivity(): Promise<ActivityEntry[]> {
  const { rows } = await get<{ rows?: Record<string, string>[] }>({ action: 'log' });
  if (!rows) throw new Error("Apps Script v2 yayınlanmamış");
  return rows.map((r) => ({
    at: parseDate(r['Tarih']),
    who: r['Kim'] || '',
    action: r['İşlem'] || '',
    title: r['İlan'] || '',
    detail: r['Detay'] || '',
  }));
}

export async function fetchOwner(title: string, key: string): Promise<OwnerInfo | null> {
  const { row } = await get<{ row: Record<string, string> | null }>({ action: 'owner', title, key });
  if (!row) return null;
  return {
    name: row['Mal Sahibi'] || '',
    phone: row['Telefon'] || '',
    authorization: row['Yetki Belgesi'] || '',
    authorizationEnd: row['Yetki Bitiş'] || '',
    commission: row['Komisyon'] || '',
    keyLocation: row['Anahtar'] || '',
    note: row['Ofis Notu'] || '',
  };
}

/* ---------- Yazma ---------- */

// Apps Script CORS cevabı okunamadığı için istek no-cors gider; sonuç ancak yenilemede görülür.
async function post(body: Record<string, unknown>) {
  await fetch(SHEET_API_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, user: apiUser }),
  });
}

export const updateStatus = (title: string, status: ListingStatus) => post({ action: 'updateStatus', title, status });
export const touchListing = (title: string) => post({ action: 'touch', title });
export const updatePrice = (title: string, price: string) => post({ action: 'updatePrice', title, price });
export const addNote = (title: string, note: string) => post({ action: 'addNote', title, note });
export const setLocation = (title: string, location: string) => post({ action: 'setLocation', title, location });

export interface SaleRecord {
  listPrice: string;
  price: string;
  broughtBy: string;
  source: string;
}
export const recordSale = (title: string, sale: SaleRecord) => post({ action: 'recordSale', title, sale });

export function ownerToSheet(o: OwnerInfo) {
  return {
    'Mal Sahibi': o.name,
    'Telefon': o.phone,
    'Yetki Belgesi': o.authorization,
    'Yetki Bitiş': o.authorizationEnd,
    'Komisyon': o.commission,
    'Anahtar': o.keyLocation,
    'Ofis Notu': o.note,
  };
}
export const saveOwner = (title: string, owner: OwnerInfo, key: string) =>
  post({ action: 'saveOwner', title, owner: ownerToSheet(owner), key });

export interface NewRequest {
  agentName: string;
  deal: string;
  kind: string;
  region: string;
  rooms: string;
  maxPrice: string;
  minSize: string;
  note: string;
}
export const addRequest = (r: NewRequest) =>
  post({
    action: 'addRequest',
    request: {
      'Danışman': r.agentName,
      'Tür': r.deal,
      'Cins': r.kind,
      'Bölge': r.region,
      'Oda Sayısı': r.rooms,
      'En Çok Fiyat': r.maxPrice,
      'En Az m²': r.minSize,
      'Not': r.note,
    },
  });
export const closeRequest = (id: string) => post({ action: 'closeRequest', id });

export interface NewListing {
  title: string;
  price: string;
  category: string;
  imarStatus: string;
  size: string;
  description: string;
  images: string[];
  sahibindenUrl: string;
  adaParsel: string;
  agentName: string;
  agentPhone: string;
  whatsappUrl: string;
  region: string;
  neighborhood: string;
  rooms: string;
  floor: string;
  buildingAge: string;
  heating: string;
  features: string[];
  location: string;
}

export function addListing(l: NewListing, owner: OwnerInfo | null) {
  return post({
    action: 'add',
    data: {
      'İlan Başlığı': l.title,
      'Fiyat': l.price,
      'Kategori': l.category,
      'İmar Durumu': l.imarStatus,
      'm²': l.size,
      'Açıklama': l.description,
      'Görsel URL': l.images.join('|||'),
      'Sahibinden Linki': l.sahibindenUrl,
      'Ada/Parsel': l.adaParsel,
      'Danışman Bilgileri': l.agentName,
      'Danışmanın Telefon Numarası': l.agentPhone,
      'WhatsApp Link': l.whatsappUrl,
      'Durum': 'Aktif',
      'Bölge': l.region,
      'Mahalle': l.neighborhood,
      'Oda Sayısı': l.rooms,
      'Kat': l.floor,
      'Bina Yaşı': l.buildingAge,
      'Isınma': l.heating,
      'Özellikler': l.features.join(', '),
      'Konum': l.location,
    },
    owner: owner ? ownerToSheet(owner) : null,
  });
}

/* ---------- Biçimlendirme ---------- */

export function parsePrice(price: string | number): number {
  if (typeof price === 'number') return price;
  const clean = price.replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

export function formatPrice(price: string | number): string {
  const n = parsePrice(price);
  return n ? `${n.toLocaleString('tr-TR')} TL` : '—';
}

export function parseSize(size?: string | number): number {
  if (size === undefined) return 0;
  if (typeof size === 'number') return size;
  const m = size.replace(',', '.').match(/[0-9.]+/);
  return m ? Math.round(parseFloat(m[0].replace(/\.(?=\d{3})/g, ''))) : 0;
}

export const isRent = (p: Property) => p.category.toLocaleLowerCase('tr').includes('kiralık');

// "Kiralık Daire" -> "Daire"; yalnızca "Satılık" yazan satırlarda cins boş kalır.
export const kindOf = (category: string) => category.replace(/satılık|kiralık/gi, '').trim();

export const priceDropped = (p: Property) => {
  const old = parsePrice(p.oldPrice || '');
  return old > 0 && parsePrice(p.price) < old;
};

export function pricePerM2(p: Property): string | null {
  const price = parsePrice(p.price);
  const size = parseSize(p.size);
  if (!price || !size) return null;
  return `${Math.round(price / size).toLocaleString('tr-TR')} TL/m²`;
}

export function normalizeAdaParsel(s: string) {
  return s.replace(/\s/g, '').toLocaleLowerCase('tr');
}

export function phoneDigits(phone: string) {
  const raw = phone.replace(/[^0-9]/g, '');
  if (raw.length === 10) return `90${raw}`;
  if (raw.length === 11 && raw.startsWith('0')) return `9${raw}`;
  return raw;
}

export function formatPhone(phone: string) {
  const d = phone.replace(/[^0-9]/g, '').replace(/^90/, '').replace(/^0/, '');
  if (d.length !== 10) return phone;
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

export function whatsappUrl(p: Property) {
  const text = encodeURIComponent(`Merhaba, Palmiye Yatırım portföyündeki "${p.title}" (${p.id}) ilanı hakkında bilgi almak istiyorum.`);
  const phone = phoneDigits(p.agentPhone);
  if (phone) return `https://wa.me/${phone}?text=${text}`;
  return p.whatsappUrl ? `${p.whatsappUrl}?text=${text}` : '';
}

// Müşteriye gidecek metin: ada/parsel ve ofis içi bilgiler bilerek yok.
export function customerShareText(p: Property, signature = 'Palmiye Yatırım') {
  const facts = [
    p.category,
    p.rooms,
    parseSize(p.size) ? `${parseSize(p.size)} m²` : '',
    p.imarStatus ? `İmar: ${p.imarStatus}` : '',
  ].filter(Boolean);
  const lines = [
    p.title,
    [p.region !== 'Belirtilmemiş' ? `Yalova, ${p.region}` : 'Yalova', p.neighborhood].filter(Boolean).join(' · '),
    facts.join(' · '),
    p.features.length ? p.features.join(', ') : '',
    `Fiyat: ${formatPrice(p.price)}${isRent(p) ? ' / ay' : ''}`,
    '',
    `Bilgi için: ${p.agentName}${p.agentPhone ? ` · ${formatPhone(p.agentPhone)}` : ''}`,
    p.lat !== undefined && p.lng !== undefined ? `Konum: https://maps.google.com/?q=${p.lat},${p.lng}` : '',
    signature,
  ];
  return lines.filter((l, i) => l !== '' || i === 5).join('\n');
}

/* ---------- Görsel küçültme ---------- */

// Sheets hücresi 50.000 karakterle sınırlı; fotoğrafı göndermeden önce küçültüp JPEG'e çeviriyoruz.
export function compressImage(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(reader.result as string);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
