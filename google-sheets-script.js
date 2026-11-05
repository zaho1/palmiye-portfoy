// Google Apps Script for Palmiye Portföy (v2)
// Bu script'i Google Sheets > Uzantılar > Apps Script altına yapıştırın.
// Dağıt > Dağıtımları yönet > düzenle > "Yeni sürüm" seçip kaydedin (adres değişmez).
// Erişim: "Herkes" (Anyone). İlk çalıştırmada Google izin isteyebilir.
//
// Sayfalar:
//   İlanlar sayfası   : ilk sayfa (yayınlanan CSV). Sütunlar başlık adından bulunur, eksik başlık sona eklenir.
//                       "Konum" sütunu "enlem, boylam" tutar (haritada işaretlenen nokta).
//   Talepler          : müşteri talepleri (yayınlanmaz, doGet ile okunur)
//   Hareketler        : kim, ne zaman, hangi ilanda ne yaptı
//   Satışlar          : satış / kiralama kayıtları
//   Mal Sahipleri     : ofis içi mal sahibi bilgileri (yayınlanmaz, şifreyle okunur)

// Ofis şifresi: src/config/auth.ts içindeki defaultPassword ile aynı olmalı.
// Mal sahibi bilgileri yalnızca bu anahtarla okunabilir.
var OFFICE_KEY = 'Palmiye2026!';
var TZ = 'Europe/Istanbul';

function now_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
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
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getDisplayValues();
  var headers = values[0];
  return values.slice(1).map(function (row, i) {
    var o = { _row: i + 2 };
    headers.forEach(function (h, j) { o[String(h).trim()] = row[j]; });
    return o;
  });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var who = data.user || '';
    var sh, map, row;

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
      }
      return json_({ success: true });
    }

    if (data.action === 'addNote') {
      var noteId = 'N-' + new Date().getTime().toString(36).toUpperCase();
      log_(who, 'Not', data.title, data.note + '|' + noteId);
      return json_({ success: true, noteId: noteId });
    }

    if (data.action === 'deleteNote') {
      // Hareketler sayfasından notu bul ve sil
      var sh = sheet_('Hareketler', ['Tarih', 'Kim', 'İşlem', 'İlan', 'Detay']);
      var lastRow = sh.getLastRow();
      var dataRange = sh.getDataRange();
      var values = dataRange.getValues();

      // Not ID'sini bul (Detay sütununda | ile ayrılmış) veya eski notları tarih + kim + detay ile eşleştir
      for (var i = values.length - 1; i >= 1; i--) {
        var detail = String(values[i][4] || '');
        var action = String(values[i][2] || '');
        var rowTitle = String(values[i][3] || '');
        var rowWho = String(values[i][1] || '');
        var rowDate = String(values[i][0] || '');

        // Yeni notlar: noteId ile eşleştir
        if (detail.includes(data.noteId) && rowTitle === String(data.title)) {
          sh.deleteRow(i + 1);
          log_(who, 'Not silindi', data.title, '');
          break;
        }
        // Eski notlar: action = Not, title eşleşir, detail eşleşir, who eşleşir
        if (action === 'Not' && rowTitle === String(data.title) && detail === data.noteId && rowWho === who) {
          sh.deleteRow(i + 1);
          log_(who, 'Not silindi', data.title, '');
          break;
        }
      }
      return json_({ success: true });
    }
        }
      }
      return json_({ success: true });
    }

    if (data.action === 'saveOwner') {
      if (data.key !== OFFICE_KEY) return json_({ success: false, message: 'Yetkisiz' });
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
      for (var i = 1; i < ids.length; i++) {
        if (String(ids[i][0]) === String(data.id)) {
          setCells_(sh, i + 1, map, { 'Durum': 'Kapandı' });
          break;
        }
      }
      log_(who, 'Müşteri talebi kapandı', '', data.id);
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
    if (p.action === 'requests') return json_({ success: true, rows: readSheet_('Talepler') });
    if (p.action === 'log') return json_({ success: true, rows: readSheet_('Hareketler').reverse().slice(0, 200) });
    if (p.action === 'owner') {
      if (p.key !== OFFICE_KEY) return json_({ success: false, message: 'Yetkisiz' });
      var rows = readSheet_('Mal Sahipleri').filter(function (r) { return String(r['İlan Başlığı']).trim() === String(p.title).trim(); });
      return json_({ success: true, row: rows[0] || null });
    }
    return json_({ status: 'active', message: 'Palmiye Portföy API çalışıyor', version: 2 });
  } catch (error) {
    return json_({ success: false, message: error.toString() });
  }
}
