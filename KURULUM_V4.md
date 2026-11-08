# v4 kurulum: kişisel hesaplar, bildirimler, müşteri takibi (ofis yöneticisi için)

Bu adımlar bir kez yapılır. Her aşama kendi başına güvenlidir; yeni sürüm yayınlanana kadar eski giriş (ortak şifre) çalışmaya devam eder.

## 1. Apps Script'i güncelle (5 dk)

1. Google Sheets'i aç → **Uzantılar → Apps Script**.
2. Eski kodun tamamını sil, repodaki `google-sheets-script.js` dosyasının içeriğini yapıştır, kaydet.
3. Dosyanın başındaki `ADVISORS` listesine ofisteki herkesi ekle: `['e-posta', 'Ad Soyad', 'telefon', 'Danışman']` (yönetici için `'Yönetici'`).
4. Üstteki fonksiyon seçiciden **kurulum**'u seçip **Çalıştır**. Google izin ister (e-tablo ve harici istek): izin ver.
5. Aynı şekilde **installTriggers**'ı çalıştır (sabah 09:00 özet bildirimi için).
6. **Dağıt → Dağıtımları yönet → kalem → Sürüm: Yeni sürüm → Dağıt**. Adres değişmez.

Sonuç: Sheets'te **Danışmanlar** sayfası oluşur. Her kişinin yanında 6 harfli **Davet Kodu** vardır. Her danışmana kendi kodunu özelden gönder (herkese aynı mesajla değil).

## 2. Danışmanlar ilk girişini yapar

Uygulamada **İlk kez mi giriyorsunuz?** düğmesine basar, e-postasını ve davet kodunu yazar, kendi şifresini belirler. Kod kullanılınca silinir. Şifreyi yalnızca kendisi bilir (Sheets'te şifre değil, tek yönlü özet durur).

- Şifresini unutan: `davetYenile` fonksiyonundaki e-postayı değiştirip çalıştır; yeni kod üretir.
- Telefonunu kaybeden / ayrılan: `Danışmanlar` sayfasında **Aktif** sütununa `Hayır` yaz. Bir dakika içinde tüm oturumları kapanır.
- Yeni danışman: `Danışmanlar` sayfasına satır ekle (veya `ADVISORS` + `kurulum`), davet kodunu kendin yaz.

## 3. Zorunlu girişi aç (herkes etkinleştirdikten sonra)

1. Herkesin ilk girişini yaptığından emin ol (Danışmanlar sayfasında **Şifre Özeti** dolu olmalı).
2. Editörde **zorunluGirisiAc**'ı çalıştır. Bundan sonra eski ortak şifre ve şifresiz okuma kapanır.
3. Sheets'te **Dosya → Paylaş → Web'de yayınla** bölümünden yayını durdur (CSV bağlantısı herkese açıktır; artık gerekmiyor).
4. Geri dönmek gerekirse **zorunluGirisiKapat**.

## 4. Bildirimler (Vercel ayarı, 5 dk)

1. Vercel → proje **palmiye-portfoy** → **Settings → Environment Variables**. Üç değişken ekle (Production + Preview): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET` (değerleri sohbette sana verdim; kimseyle paylaşma, repoya yazma).
2. **Deployments → son dağıtım → Redeploy** (değişkenler yeni dağıtımda geçerli olur).
3. Apps Script'in başında `PUSH_URL` ve `PUSH_SECRET` satırlarını doldur: `PUSH_URL = 'https://palmiye-portfoy.vercel.app/api/send'`, `PUSH_SECRET` Vercel'dekiyle aynı. Yeni sürüm olarak yeniden dağıt.
4. Telefonda: uygulama → **Ben** → **Bildirimleri aç** → **Deneme gönder**. iPhone'da önce uygulama ana ekrana eklenmiş olmalı (iOS 16.4 ve üstü).

## Hangi bildirimler gider

- Müşterine uyan yeni ilan eklendi (talebi açan danışmana).
- Müşterine uyan ilanın fiyatı düştü.
- Her sabah 09:00 (pazar hariç): bugün aranacak müşteri ve teyit bekleyen ilan sayısı.
- İsteğe bağlı **Ofis haberleri**: yeni eklenen ilan ve satışlar (herkes kendi telefonunda açıp kapatır).
