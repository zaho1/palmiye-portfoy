// Google Apps Script for Palmiye Portföy
// Bu script'i Google Sheets > Extensions > Apps Script altına yapıştırın
// Deploy olarak "Web App" seçin ve "Anyone" erişimi verin

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'add') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const newRow = [
        data.data['İlan Başlığı'],
        data.data['Fiyat'],
        data.data['Kategori'],
        data.data['İmar Durumu'],
        data.data['m²'],
        data.data['Açıklama'],
        data.data['Görsel URL'],
        data.data['Sahibinden Linki'],
        data.data['Ada/Parsel'],
        data.data['Danışman Bilgileri'],
        data.data['Danışmanın Telefon Numarası'],
        data.data['WhatsApp Link'],
        data.data['Durum']
      ];

      sheet.appendRow(newRow);

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: 'İlan başarıyla eklendi' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'batchAdd') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const listings = data.listings;

      listings.forEach(listing => {
        const newRow = [
          listing['İlan Başlığı'],
          listing['Fiyat'],
          listing['Kategori'],
          listing['İmar Durumu'],
          listing['m²'],
          listing['Açıklama'],
          listing['Görsel URL'],
          listing['Sahibinden Linki'],
          listing['Ada/Parsel'],
          listing['Danışman Bilgileri'],
          listing['Danışmanın Telefon Numarası'],
          listing['WhatsApp Link'],
          listing['Durum']
        ];
        sheet.appendRow(newRow);
      });

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: `${listings.length} ilan başarıyla eklendi` }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'updateStatus') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      // İlan başlığına göre satırı bul
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === data.title) {
          // Durum sütunu (son sütun) güncelle
          sheet.getRange(i + 1, 14).setValue(data.status);
          break;
        }
      }

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: 'Durum güncellendi' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Geçersiz işlem' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'active', message: 'Palmiye Portföy API çalışıyor' }))
    .setMimeType(ContentService.MimeType.JSON);
}
