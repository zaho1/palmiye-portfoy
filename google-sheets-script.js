// Google Apps Script for Palmiye Portföy (v4: kişisel hesaplar, bildirimler, müşteri takibi)
// Bu script'i Google Sheets > Uzantılar > Apps Script altına yapıştırın.
// Dağıt > Dağıtımları yönet > düzenle > "Yeni sürüm" seçip kaydedin (adres değişmez).
// Erişim: "Herkes" (Anyone). İlk çalıştırmada Google izin isteyebilir (e-posta/harici istek izni: izin verin).
// Kurulum adımları için repodaki KURULUM_V4.md dosyasına bakın.
//
// Sayfalar:
//   İlanlar sayfası        : ilk sayfa. Sütunlar başlık adından bulunur, eksik başlık sona eklenir.
//   Talepler               : müşteri talepleri (+ Sonraki Arama, Son Görüşme, Görüşme Notu)
//   Hareketler             : kim, ne zaman, hangi ilanda ne yaptı
//   Satışlar               : satış / kiralama kayıtları
//   Mal Sahipleri          : ofis içi mal sahibi bilgileri (yalnızca giriş yapmış danışmanlar okur)
//   Danışmanlar            : hesaplar (e-posta, ad, telefon, rol, aktif, davet kodu, şifre özeti)
//   Bildirim Abonelikleri  : telefonların bildirim kayıtları

// ---------- AYARLAR ----------
// Eski ortak ofis şifresi: yalnızca "zorunlu giriş" açılmadan önce, eski uygulama sürümleri için.
var OFFICE_KEY = 'Palmiye2026!';
// Bildirimler: Vercel'deki /api/send adresi ve gizli anahtar (Vercel'de PUSH_SECRET ile aynı olmalı).
var PUSH_URL = '';     // örn. 'https://palmiye-portfoy.vercel.app/api/send'
var PUSH_SECRET = '';  // uzun rastgele bir metin
var SITE_URL = 'https://palmiye-portfoy.vercel.app';
var TZ = 'Europe/Istanbul';
var TOKEN_DAYS = 90;
var STALE_DAYS = 30;
var VERSION = 4;

// Hesap listesi: kurulum() bu listeden "Danışmanlar" sayfasını doldurur (olanlara dokunmaz).
// [e-posta, ad soyad, telefon, rol]  rol: 'Yönetici' veya 'Danışman'
var ADVISORS = [
  ['ilbey@palmiyeyatirim.com', 'İlbey Faruk Nergiz', '0535 014 77 69', 'Yönetici'],
  ['zahit@palmiyeyatirim.com', 'Nureddin Zahit Arıduru', '0505 146 59 49', 'Yönetici'],
  ['omer@palmiyeyatirim.com', 'Ömer Nergiz', '0532 465 03 15', 'Yönetici'],
];

var ADV_HEADERS = ['E-posta', 'Ad Soyad', 'Telefon', 'Rol', 'Aktif', 'Davet Kodu', 'Şifre Özeti', 'Tuz', 'Son Giriş'];
var SUB_HEADERS = ['E-posta', 'Endpoint', 'p256dh', 'auth', 'Cihaz', 'Tarih', 'Haberler'];

// ---------- Yardımcılar ----------

function now_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
}
function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function listingSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

// Adıyla sayfa; yoksa verilen başlıklarla oluşturur.
function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Başlık -> sütun numarası (1 tabanlı). Eksik başlıklar sona eklenir.
function headerMap_(sh, names) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var map = {};
  headers.forEach(function (h, i) { if (h) map[h] = i + 1; });
  (names || []).forEach(function (n) {
    if (!map[n]) {
      lastCol = sh.getLastColumn() + 1;
      sh.getRange(1, lastCol).setValue(n);
      map[n] = lastCol;
    }
  });
  return map;
}

// Bir nesneyi başlıklara göre yeni satır olarak yazar. Tarih sütunları düz metin kalır (CSV'de ISO görünsün diye).
function appendObject_(sh, obj) {
  var keys = Object.keys(obj);
  var map = headerMap_(sh, keys);
  var width = sh.getLastColumn();
  var row = [];
  for (var i = 0; i < width; i++) row.push('');
  keys.forEach(function (k) { row[map[k] - 1] = obj[k] === undefined || obj[k] === null ? '' : obj[k]; });
  var r = sh.getLastRow() + 1;
  var range = sh.getRange(r, 1, 1, width);
  range.setNumberFormat('@');
  range.setValues([row]);
  return r;
}

function findRowByTitle_(sh, map, title) {
  var col = map['İlan Başlığı'];
  if (!col) return -1;
  var values = sh.getRange(1, col, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(title).trim()) return i + 1;
  }
  return -1;
}

function setCells_(sh, row, map, obj) {
  Object.keys(obj).forEach(function (k) {
    var cell = sh.getRange(row, map[k]);
    cell.setNumberFormat('@');
    cell.setValue(obj[k]);
  });
}

function log_(who, action, title, detail) {
  var sh = sheet_('Hareketler', ['Tarih', 'Kim', 'İşlem', 'İlan', 'Detay']);
  sh.appendRow([now_(), who || '', action, title || '', detail || '']);
}

function readSheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  return readRows_(sh);
}

function readRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getDisplayValues();
  var headers = values[0];
  return values.slice(1).map(function (row, i) {
    var o = { _row: i + 2 };
    headers.forEach(function (h, j) { o[String(h).trim()] = row[j]; });
    return o;
  });
}

function lowerTr_(s) {
  return String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}
function digits_(s) {
  return String(s || '').replace(/[^0-9]/g, '');
}
function parsePrice_(s) {
  var d = digits_(s);
  return d ? parseInt(d, 10) : 0;
}
function parseSize_(s) {
  var m = String(s || '').replace(',', '.').match(/[0-9.]+/);
  return m ? Math.round(parseFloat(m[0].replace(/\.(?=\d{3})/g, ''))) : 0;
}
function kindOf_(category) {
  return String(category || '').replace(/satılık|kiralık/gi, '').trim();
}

// ---------- Hesaplar ve oturum ----------

function props_() {
  return PropertiesService.getScriptProperties();
}
function enforced_() {
  return props_().getProperty('AUTH_ENFORCED') === '1';
}
function secret_() {
  var p = props_();
  var s = p.getProperty('TOKEN_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('TOKEN_SECRET', s);
  }
  return s;
}
function b64_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes);
}
function sign_(payload) {
  return b64_(Utilities.computeHmacSha256Signature(payload, secret_()));
}
function makeToken_(email) {
  var payload = email + '|' + (Date.now() + TOKEN_DAYS * 86400000);
  return b64_(Utilities.newBlob(payload).getBytes()) + '.' + sign_(payload);
}
function hashPw_(pw, salt) {
  var h = salt + '|' + pw;
  for (var i = 0; i < 400; i++) {
    h = b64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt));
  }
  return h;
}

function advisors_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('advisors');
  if (hit) return JSON.parse(hit);
  var rows = readSheet_('Danışmanlar').map(function (r) {
    return {
      row: r._row,
      email: String(r['E-posta']).trim().toLowerCase(),
      name: String(r['Ad Soyad']).trim(),
      phone: String(r['Telefon']).trim(),
      role: String(r['Rol']).trim() || 'Danışman',
      active: lowerTr_(r['Aktif']) !== 'hayır',
      invite: String(r['Davet Kodu']).trim().toUpperCase(),
      hash: String(r['Şifre Özeti']).trim(),
      salt: String(r['Tuz']).trim(),
    };
  }).filter(function (a) { return a.email; });
  try { cache.put('advisors', JSON.stringify(rows), 60); } catch (e) { /* önemsiz */ }
  return rows;
}
function clearAdvisorCache_() {
  CacheService.getScriptCache().remove('advisors');
}
function advisorByEmail_(email) {
  email = String(email || '').trim().toLowerCase();
  var list = advisors_();
  for (var i = 0; i < list.length; i++) if (list[i].email === email) return list[i];
  return null;
}
function advisorByName_(name) {
  name = lowerTr_(String(name || '').trim());
  if (!name) return null;
  var list = advisors_();
  for (var i = 0; i < list.length; i++) if (lowerTr_(list[i].name) === name) return list[i];
  return null;
}

// Geçerli oturum jetonu -> aktif danışman; yoksa null
function authed_(token) {
  if (!token) return null;
  var parts = String(token).split('.');
  if (parts.length !== 2) return null;
  try {
    var payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    if (sign_(payload) !== parts[1]) return null;
    var bits = payload.split('|');
    if (Number(bits[1]) < Date.now()) return null;
    var a = advisorByEmail_(bits[0]);
    return a && a.active ? a : null;
  } catch (e) {
    return null;
  }
}

function userPublic_(a) {
  return { email: a.email, name: a.name, phone: a.phone, role: a.role };
}

function tooManyFails_(email) {
  var n = Number(CacheService.getScriptCache().get('fail:' + email) || 0);
  return n >= 5;
}
function noteFail_(email) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('fail:' + email) || 0) + 1;
  cache.put('fail:' + email, String(n), 900);
}

function setAdvisorCells_(a, obj) {
  var sh = sheet_('Danışmanlar', ADV_HEADERS);
  var map = headerMap_(sh, ADV_HEADERS);
  setCells_(sh, a.row, map, obj);
  clearAdvisorCache_();
}

// ---------- Giriş geçmişi ----------
// "Giriş Geçmişi" sayfası: en yeni kayıt en üstte. Girişler, hatalı denemeler ve
// her danışmanın uygulamayı o gün ilk açışı yazılır (yöneticinin kimin kullandığını görmesi için).
function loginSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Giriş Geçmişi');
  if (!sh) {
    sh = ss.insertSheet('Giriş Geçmişi');
    sh.appendRow(['Tarih', 'E-posta', 'Ad Soyad', 'Olay', 'Cihaz']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  return sh;
}
function loginLog_(email, name, event, device) {
  try {
    var sh = loginSheet_();
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, 5).setValues([[now_(), email, name || '', event, String(device || '').slice(0, 60)]]);
  } catch (e) { /* kayıt tutulamazsa giriş yine çalışır */ }
}
// Oturumu açık danışmanın o günkü ilk kullanımı (günde bir satır)
function markSeen_(a) {
  try {
    var day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    var key = 'seen_' + a.email;
    var cache = CacheService.getScriptCache();
    if (cache.get(key) === day) return;
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(key) === day) { cache.put(key, day, 21600); return; }
    props.setProperty(key, day);
    cache.put(key, day, 21600);
    loginLog_(a.email, a.name, 'Uygulamayı kullandı', '');
  } catch (e) { /* önemsiz */ }
}

function doLogin_(data) {
  var out = doLoginCore_(data);
  var email = String(data.email || '').trim().toLowerCase();
  if (email) {
    var a = advisorByEmail_(email);
    var event = out.success
      ? (data.action === 'activate' ? 'İlk giriş (hesap açıldı)' : 'Giriş yaptı')
      : 'Başarısız giriş: ' + (out.message || '');
    loginLog_(email, a ? a.name : '', event, data.device);
  }
  return out;
}

function doLoginCore_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  if (!email) return { success: false, message: 'E-posta gerekli.' };
  if (tooManyFails_(email)) return { success: false, message: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' };
  var a = advisorByEmail_(email);
  if (!a || !a.active) {
    noteFail_(email);
    return { success: false, message: 'E-posta veya şifre hatalı.' };
  }

  // İlk giriş: davet kodu + kendi seçeceği şifre
  if (data.action === 'activate') {
    var code = String(data.invite || '').trim().toUpperCase();
    var pw = String(data.password || '');
    if (!a.invite || a.hash) return { success: false, message: 'Bu hesap zaten etkinleştirilmiş. Şifrenizle giriş yapın veya yöneticiden yeni davet kodu isteyin.' };
    if (code !== a.invite) {
      noteFail_(email);
      return { success: false, message: 'Davet kodu hatalı.' };
    }
    if (pw.length < 8) return { success: false, message: 'Şifre en az 8 karakter olmalı.' };
    var salt = Utilities.getUuid();
    setAdvisorCells_(a, { 'Şifre Özeti': hashPw_(pw, salt), 'Tuz': salt, 'Davet Kodu': '', 'Son Giriş': now_() });
    log_(a.email, 'Hesap etkinleştirildi', '', '');
    return { success: true, token: makeToken_(a.email), user: userPublic_(a) };
  }

  if (!a.hash) return { success: false, message: 'Hesabınız henüz etkinleştirilmedi. "İlk giriş" ile davet kodunuzu kullanın.' };
  if (hashPw_(String(data.password || ''), a.salt) !== a.hash) {
    noteFail_(email);
    return { success: false, message: 'E-posta veya şifre hatalı.' };
  }
  setAdvisorCells_(a, { 'Son Giriş': now_() });
  return { success: true, token: makeToken_(a.email), user: userPublic_(a) };
}

function changePassword_(a, data) {
  var pw = String(data.newPassword || '');
  if (hashPw_(String(data.password || ''), a.salt) !== a.hash) return { success: false, message: 'Mevcut şifre hatalı.' };
  if (pw.length < 8) return { success: false, message: 'Yeni şifre en az 8 karakter olmalı.' };
  var salt = Utilities.getUuid();
  setAdvisorCells_(a, { 'Şifre Özeti': hashPw_(pw, salt), 'Tuz': salt });
  return { success: true };
}

// ---------- Eşleşme (src/lib/match.ts ile aynı mantık) ----------

function requestMatches_(req, p) {
  if (String(p['Durum'] || 'Aktif') !== 'Aktif' || req['Durum'] !== 'Açık') return false;
  var cat = lowerTr_(p['Kategori']);
  if (req['Tür'] && cat.indexOf(lowerTr_(req['Tür'])) < 0) return false;
  if (req['Cins'] && lowerTr_(kindOf_(p['Kategori'])) !== lowerTr_(req['Cins'])) return false;
  if (req['Bölge'] && lowerTr_(p['Bölge']) !== lowerTr_(req['Bölge'])) return false;
  var rr = String(req['Oda Sayısı'] || '').replace(/\s/g, '');
  var pr = String(p['Oda Sayısı'] || '').replace(/\s/g, '');
  if (rr && pr && rr !== pr) return false;
  var max = parsePrice_(req['En Çok Fiyat']);
  if (max && parsePrice_(p['Fiyat']) > max) return false;
  var min = parseSize_(req['En Az m²']);
  if (min && parseSize_(p['m²']) < min) return false;
  return true;
}

// Bir ilana uyan açık talepleri açan danışmanların e-postaları (adet ile)
function matchRecipients_(listing, excludeEmail) {
  var counts = {};
  readSheet_('Talepler').forEach(function (req) {
    if (!requestMatches_(req, listing)) return;
    var a = advisorByName_(req['Danışman']);
    if (!a || a.email === excludeEmail) return;
    counts[a.email] = (counts[a.email] || 0) + 1;
  });
  return counts;
}

// ---------- Bildirimler ----------

// emails: ['a@b'] ya da null (herkes). news=true ise yalnızca "Ofis haberleri"ni açmış cihazlara.
function sendPush_(emails, news, msg, exclude) {
  if (!PUSH_URL || !PUSH_SECRET) return;
  try {
    var want = emails ? emails.map(function (e) { return String(e).toLowerCase(); }) : null;
    var subs = readSheet_('Bildirim Abonelikleri').filter(function (s) {
      if (want && want.indexOf(String(s['E-posta']).toLowerCase()) < 0) return false;
      if (news && s['Haberler'] !== 'Evet') return false;
      if (exclude && String(s['E-posta']).toLowerCase() === String(exclude).toLowerCase()) return false;
      return !!s['Endpoint'];
    });
    if (!subs.length) return;
    var messages = subs.map(function (s) {
      return { endpoint: s['Endpoint'], p256dh: s['p256dh'], auth: s['auth'], payload: msg };
    });
    var res = UrlFetchApp.fetch(PUSH_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ secret: PUSH_SECRET, messages: messages }),
      muteHttpExceptions: true,
    });
    var out = JSON.parse(res.getContentText());
    (out.gone || []).forEach(removeSub_);
    if (out.failed || (out.gone && out.gone.length) || out.error) log_('sistem', 'Bildirim gönderilemedi', '', String(res.getResponseCode() + ' ' + (out.error || JSON.stringify(out.problems || []))).slice(0, 200));
  } catch (e) {
    log_('sistem', 'Bildirim hatası', '', String(e).slice(0, 200));
  }
}

function sendPushEach_(counts, build) {
  Object.keys(counts).forEach(function (email) {
    sendPush_([email], false, build(counts[email]));
  });
}

function removeSub_(endpoint) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bildirim Abonelikleri');
  if (!sh || sh.getLastRow() < 2) return;
  var col = headerMap_(sh, SUB_HEADERS)['Endpoint'];
  var values = sh.getRange(1, col, sh.getLastRow(), 1).getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(endpoint)) sh.deleteRow(i + 1);
  }
}

function subscribe_(a, data) {
  var sub = data.sub || {};
  if (!sub.endpoint || !sub.keys) return { success: false, message: 'Geçersiz abonelik' };
  var sh = sheet_('Bildirim Abonelikleri', SUB_HEADERS);
  var map = headerMap_(sh, SUB_HEADERS);
  var values = sh.getLastRow() > 1 ? sh.getRange(1, map['Endpoint'], sh.getLastRow(), 1).getValues() : [[]];
  var row = -1;
  for (var i = 1; i < values.length; i++) if (String(values[i][0]) === sub.endpoint) row = i + 1;
  var obj = {
    'E-posta': a.email,
    'Endpoint': sub.endpoint,
    'p256dh': sub.keys.p256dh,
    'auth': sub.keys.auth,
    'Cihaz': String(data.device || '').slice(0, 60),
    'Tarih': now_(),
    'Haberler': data.news ? 'Evet' : 'Hayır',
  };
  if (row < 0) appendObject_(sh, obj);
  else setCells_(sh, row, map, obj);
  return { success: true };
}

// Her sabah 09:00 (pazar hariç): bugün aranacak müşteri ve teyit bekleyen ilan özeti
function morningDigest() {
  if (Utilities.formatDate(new Date(), TZ, 'u') === '7') return;
  var today = today_();
  var calls = {};
  readSheet_('Talepler').forEach(function (r) {
    if (r['Durum'] !== 'Açık') return;
    var next = String(r['Sonraki Arama'] || '').trim();
    if (!next || next > today) return;
    var a = advisorByName_(r['Danışman']);
    if (a) calls[a.email] = (calls[a.email] || 0) + 1;
  });
  var stale = {};
  var limit = new Date().getTime() - STALE_DAYS * 86400000;
  readRows_(listingSheet_()).forEach(function (p) {
    if (String(p['Durum'] || 'Aktif') !== 'Aktif') return;
    var m = String(p['Son Güncelleme'] || p['Eklenme Tarihi'] || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m || new Date(+m[1], +m[2] - 1, +m[3]).getTime() > limit) return;
    var a = advisorByName_(p['Danışman Bilgileri']);
    if (a) stale[a.email] = (stale[a.email] || 0) + 1;
  });
  var all = {};
  Object.keys(calls).concat(Object.keys(stale)).forEach(function (e) { all[e] = true; });
  Object.keys(all).forEach(function (email) {
    var parts = [];
    if (calls[email]) parts.push(calls[email] + ' müşteri araman gerekiyor');
    if (stale[email]) parts.push(stale[email] + ' ilanın teyit bekliyor');
    sendPush_([email], false, { title: 'Günaydın, bugün için notların', body: parts.join(' · '), url: '/#/bugun', tag: 'digest' });
  });
}

// Editörde bir kez çalıştırın: sabah özeti için günlük tetikleyiciyi kurar.
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'morningDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('morningDigest').timeBased().everyDays(1).atHour(9).inTimezone(TZ).create();
}

// ---------- Kurulum (editörden çalıştırılır) ----------

// 1) Danışmanlar sayfasını oluşturur, ADVISORS listesindeki yeni kişileri ekler, davet kodu üretir.
function kurulum() {
  var sh = sheet_('Danışmanlar', ADV_HEADERS);
  var map = headerMap_(sh, ADV_HEADERS);
  var have = {};
  readSheet_('Danışmanlar').forEach(function (r) { have[String(r['E-posta']).trim().toLowerCase()] = true; });
  var added = 0;
  ADVISORS.forEach(function (a) {
    var email = String(a[0]).trim().toLowerCase();
    if (have[email]) return;
    appendObject_(sh, { 'E-posta': email, 'Ad Soyad': a[1], 'Telefon': a[2], 'Rol': a[3] || 'Danışman', 'Aktif': 'Evet', 'Davet Kodu': inviteCode_() });
    added++;
  });
  sheet_('Bildirim Abonelikleri', SUB_HEADERS);
  var talepler = sheet_('Talepler', ['Talep No', 'Tarih', 'Durum']);
  headerMap_(talepler, ['Sonraki Arama', 'Son Görüşme', 'Görüşme Notu']);
  clearAdvisorCache_();
  return added + ' kişi eklendi. Davet kodları "Danışmanlar" sayfasında.';
}

function inviteCode_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// Şifresini unutan veya yeni cihazı olmayan kişi için: Danışmanlar sayfasında satırı seçmeden,
// e-postayı aşağıya yazıp editörde çalıştırın. Şifre sıfırlanır, yeni davet kodu üretilir.
function davetYenile() {
  var email = 'ornek@palmiyeyatirim.com';
  var a = advisorByEmail_(email);
  if (!a) return 'Bulunamadı: ' + email;
  var code = inviteCode_();
  setAdvisorCells_(a, { 'Davet Kodu': code, 'Şifre Özeti': '', 'Tuz': '' });
  return email + ' için yeni davet kodu: ' + code;
}

// 2) Herkes hesabını etkinleştirdikten SONRA çalıştırın: eski ortak şifre ve şifresiz okuma kapanır.
function zorunluGirisiAc() {
  props_().setProperty('AUTH_ENFORCED', '1');
  return 'Zorunlu giriş açıldı. Artık yalnızca kişisel hesapla girilebilir.';
}
function zorunluGirisiKapat() {
  props_().deleteProperty('AUTH_ENFORCED');
  return 'Zorunlu giriş kapatıldı.';
}

// ---------- API ----------

function gate_(token, legacyUser) {
  var a = authed_(token);
  if (a) {
    markSeen_(a);
    return { ok: true, who: a.email, advisor: a };
  }
  if (enforced_()) return { ok: false };
  return { ok: true, who: legacyUser || '', advisor: null };
}

var AUTH_FAIL = { success: false, code: 'auth', message: 'Oturum gerekli veya süresi doldu. Yeniden giriş yapın.' };

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'login' || data.action === 'activate') return json_(doLogin_(data));

    var g = gate_(data.token, data.user);
    if (!g.ok) return json_(AUTH_FAIL);
    var who = g.who;
    var sh, map, row;

    if (data.action === 'changePassword') {
      if (!g.advisor) return json_(AUTH_FAIL);
      return json_(changePassword_(g.advisor, data));
    }

    if (data.action === 'pushSubscribe') {
      if (!g.advisor) return json_(AUTH_FAIL);
      return json_(subscribe_(g.advisor, data));
    }
    if (data.action === 'pushTest') {
      sendPush_([who], false, { title: 'Bildirimler açık', body: 'Bu bir deneme bildirimidir. Müşterine uyan ilanlar burada görünecek.', url: '/#/bugun', tag: 'test' });
      return json_({ success: true });
    }
    if (data.action === 'pushUnsubscribe') {
      removeSub_(data.endpoint);
      return json_({ success: true });
    }

    if (data.action === 'add') {
      sh = listingSheet_();
      var listing = data.data;
      listing['Eklenme Tarihi'] = now_();
      listing['Son Güncelleme'] = now_();
      appendObject_(sh, listing);
      if (data.owner && (data.owner['Mal Sahibi'] || data.owner['Telefon'])) {
        var owner = data.owner;
        owner['İlan Başlığı'] = listing['İlan Başlığı'];
        appendObject_(sheet_('Mal Sahipleri', ['İlan Başlığı']), owner);
      }
      log_(who, 'İlan eklendi', listing['İlan Başlığı'], listing['Fiyat']);
      var price = parsePrice_(listing['Fiyat']);
      var priceText = price ? price.toLocaleString('tr-TR') + ' TL' : '';
      sendPushEach_(matchRecipients_(listing, who), function (n) {
        return {
          title: n > 1 ? n + ' talebine uyan yeni ilan' : 'Müşterine uyan yeni ilan',
          body: [listing['İlan Başlığı'], priceText].filter(Boolean).join(' · '),
          url: '/#/talepler',
          tag: 'match',
        };
      });
      var adder = advisorByEmail_(who);
      sendPush_(null, true, {
        title: 'Ofiste yeni ilan',
        body: [listing['İlan Başlığı'], priceText, adder ? adder.name : ''].filter(Boolean).join(' · '),
        url: '/#/?filtre=yeni',
        tag: 'news-add',
      }, who);
      return json_({ success: true });
    }

    if (['updateStatus', 'touch', 'updatePrice', 'recordSale', 'setLocation'].indexOf(data.action) !== -1) {
      sh = listingSheet_();
      map = headerMap_(sh, ['Durum', 'Son Güncelleme', 'Eski Fiyat', 'Konum']);
      row = findRowByTitle_(sh, map, data.title);
      if (row < 0) return json_({ success: false, message: 'İlan bulunamadı' });

      if (data.action === 'updateStatus') {
        setCells_(sh, row, map, { 'Durum': data.status, 'Son Güncelleme': now_() });
        log_(who, 'Durum: ' + data.status, data.title, '');
      }
      if (data.action === 'setLocation') {
        setCells_(sh, row, map, { 'Konum': data.location });
        log_(who, 'Konum işaretlendi', data.title, data.location);
      }
      if (data.action === 'touch') {
        setCells_(sh, row, map, { 'Son Güncelleme': now_() });
        log_(who, 'Güncel olduğu teyit edildi', data.title, '');
      }
      if (data.action === 'updatePrice') {
        var oldPrice = sh.getRange(row, map['Fiyat']).getDisplayValue();
        setCells_(sh, row, map, { 'Fiyat': data.price, 'Eski Fiyat': oldPrice, 'Son Güncelleme': now_() });
        log_(who, 'Fiyat değişti', data.title, oldPrice + ' → ' + data.price);
        if (parsePrice_(data.price) < parsePrice_(oldPrice)) {
          var pl = {};
          sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].forEach(function (h, i) {
            pl[String(h).trim()] = sh.getRange(row, i + 1).getDisplayValue();
          });
          sendPushEach_(matchRecipients_(pl, who), function () {
            return { title: 'Müşterine uyan ilanın fiyatı düştü', body: data.title + ' · ' + parsePrice_(data.price).toLocaleString('tr-TR') + ' TL', url: '/#/talepler', tag: 'drop' };
          });
        }
      }
      if (data.action === 'recordSale') {
        setCells_(sh, row, map, { 'Durum': 'Satıldı', 'Son Güncelleme': now_() });
        var s = data.sale || {};
        appendObject_(sheet_('Satışlar', ['Tarih']), {
          'Tarih': now_(),
          'İlan': data.title,
          'İlan Fiyatı': s.listPrice || '',
          'Gerçekleşen Fiyat': s.price || '',
          'Getiren Danışman': s.broughtBy || '',
          'Müşteri Kaynağı': s.source || '',
          'Kaydeden': who,
        });
        log_(who, 'Satıldı / kiralandı', data.title, (s.price || '') + (s.broughtBy ? ' · ' + s.broughtBy : ''));
        var seller = advisorByEmail_(who);
        sendPush_(null, true, {
          title: 'Ofiste satış',
          body: [data.title, seller ? seller.name : ''].filter(Boolean).join(' · '),
          url: '/#/bugun',
          tag: 'news-sale',
        }, who);
      }
      return json_({ success: true });
    }

    if (data.action === 'addNote') {
      var noteId = 'N-' + new Date().getTime().toString(36).toUpperCase();
      log_(who, 'Not', data.title, data.note + '|' + noteId);
      return json_({ success: true, noteId: noteId });
    }

    if (data.action === 'deleteNote') {
      // Hareketler sayfasından notu bulup satırı tamamen siler
      sh = sheet_('Hareketler', ['Tarih', 'Kim', 'İşlem', 'İlan', 'Detay']);
      var values = sh.getDataRange().getValues();
      var key = String(data.noteId || '');
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][2]) !== 'Not') continue;
        if (String(values[i][3]).trim() !== String(data.title).trim()) continue;
        var detail = String(values[i][4] || '');
        var parts = detail.split('|');
        var id = parts.length > 1 ? parts[parts.length - 1] : '';
        var text = parts.length > 1 ? parts.slice(0, -1).join('|') : detail;
        if ((id && id === key) || text === key) {
          sh.deleteRow(i + 1);
          break;
        }
      }
      return json_({ success: true });
    }

    if (data.action === 'saveOwner') {
      if (!g.advisor && data.key !== OFFICE_KEY) return json_({ success: false, message: 'Yetkisiz' });
      sh = sheet_('Mal Sahipleri', ['İlan Başlığı']);
      map = headerMap_(sh, Object.keys(data.owner).concat(['İlan Başlığı']));
      row = findRowByTitle_(sh, map, data.title);
      var ownerObj = data.owner;
      ownerObj['İlan Başlığı'] = data.title;
      if (row < 0) appendObject_(sh, ownerObj);
      else setCells_(sh, row, map, ownerObj);
      log_(who, 'Ofis içi bilgi güncellendi', data.title, '');
      return json_({ success: true });
    }

    if (data.action === 'addRequest') {
      var req = data.request;
      req['Tarih'] = now_();
      req['Durum'] = 'Açık';
      req['Talep No'] = 'T-' + new Date().getTime().toString(36).toUpperCase();
      appendObject_(sheet_('Talepler', ['Talep No', 'Tarih', 'Durum']), req);
      log_(who, 'Müşteri talebi eklendi', '', req['Talep No']);
      return json_({ success: true });
    }

    if (data.action === 'closeRequest') {
      sh = sheet_('Talepler', ['Talep No', 'Tarih', 'Durum']);
      map = headerMap_(sh, ['Talep No', 'Durum']);
      var ids = sh.getRange(1, map['Talep No'], sh.getLastRow(), 1).getValues();
      for (var j = 1; j < ids.length; j++) {
        if (String(ids[j][0]) === String(data.id)) {
          setCells_(sh, j + 1, map, { 'Durum': 'Kapandı' });
          break;
        }
      }
      log_(who, 'Müşteri talebi kapandı', '', data.id);
      return json_({ success: true });
    }

    // Müşteri takibi: görüşme notu, son görüşme, bir sonraki arama tarihi
    if (data.action === 'updateRequest') {
      sh = sheet_('Talepler', ['Talep No', 'Tarih', 'Durum']);
      map = headerMap_(sh, ['Talep No', 'Sonraki Arama', 'Son Görüşme', 'Görüşme Notu']);
      var rids = sh.getRange(1, map['Talep No'], sh.getLastRow(), 1).getValues();
      for (var k = 1; k < rids.length; k++) {
        if (String(rids[k][0]) === String(data.id)) {
          var f = data.fields || {};
          var change = {};
          ['Sonraki Arama', 'Son Görüşme', 'Görüşme Notu'].forEach(function (name) {
            if (f[name] !== undefined) change[name] = f[name];
          });
          setCells_(sh, k + 1, map, change);
          if (f['Görüşme Notu']) log_(who, 'Müşteri görüşmesi', '', data.id + ': ' + f['Görüşme Notu']);
          break;
        }
      }
      return json_({ success: true });
    }

    return json_({ success: false, message: 'Geçersiz işlem' });
  } catch (error) {
    return json_({ success: false, message: error.toString() });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'ping') {
      var list = advisors_();
      var ready = list.some(function (a) { return a.active && (a.hash || a.invite); });
      return json_({ status: 'active', message: 'Palmiye Portföy API çalışıyor', version: VERSION, accounts: ready, enforced: enforced_() });
    }

    var g = gate_(p.token, '');
    if (!g.ok) return json_(AUTH_FAIL);

    if (p.action === 'whoami') {
      return json_(g.advisor ? { success: true, user: userPublic_(g.advisor) } : AUTH_FAIL);
    }
    // Ofis rehberi: ad, telefon, rol (şifre bilgisi hiçbir zaman gönderilmez)
    if (p.action === 'advisors') {
      return json_({ success: true, rows: advisors_().filter(function (a) { return a.active; }).map(userPublic_) });
    }
    // İlanlar canlı okunur: yayınlanmış CSV'nin birkaç dakikalık önbelleği yüzünden eklenen/silinen ilan gidip gelmesin
    if (p.action === 'listings') return json_({ success: true, rows: readRows_(listingSheet_()) });
    if (p.action === 'requests') return json_({ success: true, rows: readSheet_('Talepler') });
    if (p.action === 'log') return json_({ success: true, rows: readSheet_('Hareketler').reverse().slice(0, 200) });
    if (p.action === 'owner') {
      if (!g.advisor && p.key !== OFFICE_KEY) return json_({ success: false, message: 'Yetkisiz' });
      var rows = readSheet_('Mal Sahipleri').filter(function (r) { return String(r['İlan Başlığı']).trim() === String(p.title).trim(); });
      return json_({ success: true, row: rows[0] || null });
    }
    return json_({ status: 'active', message: 'Palmiye Portföy API çalışıyor', version: VERSION });
  } catch (error) {
    return json_({ success: false, message: error.toString() });
  }
}

// Hareketler sayfasındaki "Not silindi" kayıtlarını temizlemek için
// Apps Script editöründe bu fonksiyonu seçip "Çalıştır" butonuna bas
function cleanDeletedNotes() {
  var sh = sheet_('Hareketler', ['Tarih', 'Kim', 'İşlem', 'İlan', 'Detay']);
  var dataRange = sh.getDataRange();
  var values = dataRange.getValues();
  var deletedCount = 0;

  // Alttan yukarı doğru sil ki satır numaraları bozulmasın
  for (var i = values.length - 1; i >= 1; i--) {
    var action = String(values[i][2] || '');
    if (action === 'Not silindi') {
      sh.deleteRow(i + 1);
      deletedCount++;
    }
  }

  return 'Temizlendi: ' + deletedCount + ' adet "Not silindi" kaydı silindi.';
}

// Bildirim izni: editörde bir kez çalıştırın. Google "harici hizmete bağlan" iznini ister;
// günlükte "200 {...}" görünürse Vercel'e bağlantı çalışıyor demektir.
function bildirimIzniVer() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, ['https://www.googleapis.com/auth/script.external_request']);
  var res = UrlFetchApp.fetch(PUSH_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ secret: PUSH_SECRET, messages: [] }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
