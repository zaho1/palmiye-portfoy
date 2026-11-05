# Palmiye Portföy Paneli v2

Stack aynı (React + Vite + Tailwind v4 + lucide). Tek yeni paket **Leaflet 1.9.4** (harita); `package.json` ve `package-lock.json` güncel, Vercel kendisi kurar. Harita karoları OpenStreetMap'ten gelir, API anahtarı gerekmez. İlanlar yine yayınlanmış CSV'den okunuyor ve aynı Apps Script adresine yazılıyor.

## Kurulum sırası

1. **Kodu pushlayın** (Vercel aynı şekilde derler: `npm run build`). Panel hemen çalışır; ilanlar, filtreler, detay, satış ve pasife alma, yeni ilan ekleme bu adımla açılır.
2. **Apps Script'i güncelleyin.** Google Sheets > Uzantılar > Apps Script'i açın, eski kodu silin, `google-sheets-script.js` içeriğini yapıştırın ve kaydedin. Sonra **Dağıt > Dağıtımları yönet > kalem simgesi > Sürüm: Yeni sürüm > Dağıt** deyin. Web uygulaması adresi değişmez.
   - Bu adım yapılınca şunlar açılır: müşteri talepleri, son hareketler, ilan geçmişi ve notlar, mal sahibi bilgisi, satış kaydı, fiyat geçmişi, tarih takibi.
   - Script eksik sütunları (Bölge, Mahalle, Oda Sayısı, Kat, Bina Yaşı, Isınma, Özellikler, Konum, Eklenme Tarihi, Son Güncelleme, Eski Fiyat) ilk sayfaya kendisi ekler. "Talepler", "Hareketler", "Satışlar" ve "Mal Sahipleri" sayfalarını da kendisi oluşturur.
   - Script'teki `OFFICE_KEY`, `src/config/auth.ts` içindeki `defaultPassword` ile aynı olmalı. Şifreyi değiştirirseniz ikisini birlikte değiştirin.
3. **Danışmanlar bir kez çıkış yapıp yeniden girsin.** Ofis içi (mal sahibi) bilgileri ancak yeni girişten sonra görünür.

## Ekranlar

- **Sol panel:**
  - Yeni ilan butonu.
  - Portföy menüsü: bütün ilanlar, benim ilanlarım, favorilerim, harita, müşteri talepleri (eşleşme sayısıyla). Sayılar yanında görünür.
  - Hızlı filtreler: teyitsiz, son 7 günde eklenen, bilgisi eksik, fiyatı düşen.
  - İlan sayılarıyla bölgeler.
  - Sheets eşitleme durumu ve "şimdi eşitle".
  - Ayarlar, koyu/açık tema düğmesi, kullanıcı ve çıkış.
  - Telefonda aynı panel tam ekran menü olarak açılır.
- **Tema:** koyu, açık veya cihaza göre. Sol paneldeki ay/güneş düğmesinden ya da Ayarlar'dan değiştirilir.
- **Ayarlar:** tema, açılış görünümü (liste/galeri), bölgelerin sol panelde gösterilmesi, teyit süresi (15–90 gün), telefon numarası (yeni ilan formuna otomatik gelir), müşteri metninin imza satırı, bağlantı durumu, ayarları sıfırlama. Ayarlar cihazda saklanır.
- **Harita:** aktif ilanlar haritada, yanında liste; satılık/kiralık ve bölge filtresi var. Konumu işaretlenmiş ilan dolu nokta olarak, işaretlenmemiş olan ilçe merkezinde kesikli halka olarak görünür.
  - İlan detayında haritaya tıklanıp "Konumu kaydet" ile gerçek konum işaretlenir.
  - Yeni ilan formunda haritaya tıklanır ya da Google Maps linki yapıştırılır.
  - Konum Sheets'te "Konum" sütununa yazılır. Müşteri metnine Google Maps linki olarak, detaya yol tarifi olarak eklenir.
- **Broşür:** ilan detayındaki "Broşür" butonu logolu, A4 bir sayfa açar; "Yazdır / PDF" ile kaydedilir. Ada/parsel ve ofis içi bilgiler broşürde yer almaz.
- **Bildirim zili:** giriş yapan danışmanın işleri. Talebine uyan ilan, teyitsiz ilanları ve bilgisi eksik ilanları.
- **Favoriler:** listede ve detayda kalp simgesi. Bu cihazda saklanır.
- **Giriş:** üstte logo, altında yalnızca giriş formu. "Oturumum açık kalsın" seçeneği var (kaldırılırsa sekme kapanınca çıkış yapılır). Ayrıca şifremi unuttum bilgisi, tema düğmesi ve şifreyi göster/gizle.
- **Portföy:** özet şeridi (aktif, bu ay eklenen, bu ay satılan, 30+ gün teyitsiz, talebe uyan). Aktif / Pasif / Satılan / Silinen sekmeleri. Satılık/kiralık, cins, fiyat aralığı ve bölge filtreleri. Arama mahalle, ada/parsel, danışman ve ilan numarasında da çalışır. Altı sıralama seçeneği var. Liste ve galeri görünümü arasında geçilebilir; telefonda iki satırlı liste çıkar. "Talep eşleşti" ve "Fiyat düştü" işaretleri, teyitsiz ilan uyarısı, son hareketler ve danışman tablosu da bu ekranda.
- **Benim ilanlarım:** giriş yapan danışmanın ilanları.
- **Müşteri talepleri:** müşterinin aradığı girilir (tür, cins, bölge, oda, en çok fiyat, en az m²). Uyan ilanlar hemen listelenir, ilanın kendi sayfasında da görünür.
- **İlan detayı:** ayrı sayfa olduğu için link paylaşılabilir ve geri tuşu çalışır. Galeri klavyeyle gezilebilir.
  - "Müşteriye gönder" butonu ada/parsel ve mal sahibi bilgisini içermeyen bir metin hazırlar; metin WhatsApp'a gönderilebilir ya da kopyalanabilir.
  - "Güncel" butonu ilanın hâlâ geçerli olduğunu teyit eder. Fiyat değiştirilebilir; eski fiyat saklanır.
  - Satış penceresi gerçekleşen fiyatı, alıcıyı getiren danışmanı ve müşterinin nereden geldiğini sorar.
  - Silme ve satış işlemleri onay ister ve geri alınabilir.
  - Ofis içi kartı mal sahibi, yetki, komisyon ve anahtar bilgisini tutar.
  - Ayrıca haritada aç ve TKGM parsel sorgu linkleri ile geçmiş ve notlar bölümü var.
- **Yeni ilan:** bölümlü form. Aynı ada/parsel portföyde varsa uyarır. Fotoğraflar sıralanabilir ve kapak seçilebilir; göndermeden önce küçültülür. Eksik bilgiler kaydetmeden önce listelenir.
- **Sunum modu** (üst çubuk): müşteri yanındayken ada/parsel ve ofis içi bilgileri gizler.

## Dosyalar

| Dosya | Durum |
| --- | --- |
| `index.html` | Inter fontu, telefon tema rengi ve ana ekran simgesi |
| `src/index.css` | Renk ve yazı token'ları (Tailwind v4 `@theme`) |
| `src/types.ts` | Yeni alanlar, talep, hareket ve mal sahibi tipleri |
| `src/App.tsx` | Kabuk, yönlendirme (`#/`, `#/benim`, `#/talepler`, `#/yeni`, `#/ilan/PLM-101`) ve bütün yazma işlemleri |
| `src/lib/sheets.ts` | **Yeni.** CSV okuma, Apps Script GET/POST, biçimlendirme, bölge tespiti, fotoğraf küçültme |
| `src/lib/match.ts` | **Yeni.** Talep ↔ ilan eşleştirme |
| `src/lib/settings.tsx` | **Yeni.** Tema, kişisel ayarlar, favoriler |
| `src/components/*` | Login, Sidebar, Notifications, ListingList, ListingDetail, AddListing, Requests, Maps, MapView, Settings, Brochure, Dialog, Toast, ui |
| `google-sheets-script.js` | v2: başlık adıyla yazma, yeni sayfalar, `doGet` ile okuma |

## Bilinen sınırlar

- **Eski ilanların tarihi yok.** "Bu ay eklenen" ve "30+ gün teyitsiz" yeni eklenen ya da "Güncel"e basılan ilanlardan itibaren dolar. Eski ilanların bölgesi başlık ve açıklamadan tahmin edilir; Sheets'te "Bölge" sütununu doldurmak daha doğru sonuç verir.
- **İlan numarası satır sırasından gelir** (PLM-101 = ilk satır). Sheets'te satır silmeyin; silmek için paneldeki "Sil"i kullanın.
- **Güvenlik:** şifre tarayıcıya giden kodun içinde, ilan CSV'si de herkese açık. Ada/parsel bu yüzden link bilen herkese açıktır. Mal sahibi bilgileri yayınlanmayan sayfada tutulur ve şifre ister, ama şifre koddan okunabildiği için gerçek bir koruma sayılmaz. Gerçek koruma için sunucu tarafı giriş gerekir (örn. Vercel fonksiyonu + Google hesabı).
- **Fotoğraflar** Sheets hücresine base64 olarak yazılıyor (hücre sınırı 50.000 karakter). Küçültme bunu hafifletir ama çok fotoğraflı ilanlarda sınır aşılabilir. Kalıcı çözüm fotoğrafları Google Drive'a veya Vercel Blob'a yükleyip hücreye sadece linki yazmaktır.
