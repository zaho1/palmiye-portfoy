# Google Sheets API Kurulum Talimatları

## 1. Google Apps Script Oluşturma

1. Google Sheets dosyanızı açın
2. Üst menüden **Extensions > Apps Script** seçeneğine tıklayın
3. Açılan sayfada, `google-sheets-script.js` dosyasındaki kodu kopyalayıp yapıştırın
4. Proje adını (örn: "Palmiye Portföy API") kaydedin

## 2. Web App Olarak Deploy Etme

1. Apps Script editöründe sağ üstteki **Deploy > New deployment** butonuna tıklayın
2. Açılan pencerede **Web app** seçeneğini seçin
3. Aşağıdaki ayarları yapın:
   - **Description**: "Palmiye Portföy API v1"
   - **Execute as**: "Me" (sizin hesabınız)
   - **Who has access**: "Anyone" (Herkes - bu çok önemli!)
4. **Deploy** butonuna tıklayın
5. Web app URL'sini kopyalayın (şu formatda olacaktır: `https://script.google.com/macros/s/.../exec`)

## 3. Projenize URL'yi Ekleyin

1. `src/App.tsx` dosyasını açın
2. `AddListingForm` fonksiyonunda şu satırı bulun:
   ```javascript
   const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxZ_5kZ_7kZ_7kZ_7kZ_7kZ_7kZ_7kZ/exec';
   ```
3. Bu URL'yi kopyaladığınız gerçek URL ile değiştirin

## 4. Test Etme

- Siteyi açın
- "Yeni İlan Ekle" butonuna tıklayın
- Formu doldurun ve gönderin
- Google Sheets dosyanızı kontrol edin - yeni ilanın eklendiğini görmelisiniz

## Önemli Notlar

- "Who has access" mutlaka "Anyone" olmalı, aksi takdirde CORS hatası alırsınız
- İlk deploy sırasında Google size yetki isteyebilir - izin verin
- Google Sheets'inizdeki sütun sırası şöyle olmalı:
  1. İlan Başlığı
  2. Fiyat
  3. Kategori
  4. İmar Durumu
  5. m²
  6. Açıklama
  7. Görsel URL
  8. Sahibinden Linki
  9. Ada/Parsel
  10. Danışman Bilgileri
  11. Danışmanın Telefon Numarası
  12. WhatsApp Link
  13. Durum
