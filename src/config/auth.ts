// Ofis Yetkili Danışman Listesi ve Şifre Yönetimi
export const OFFICE_AUTH_CONFIG = {
  // Ortak Ofis Şifresi
  defaultPassword: "Palmiye2026!",
  
  // Sadece Yetkili 3 Özel Hesap
  allowedUsers: [
    // phone: Danışman Paneli'ndeki Ara / WhatsApp butonları için
    { email: "ilbey@palmiyeyatirim.com", name: "İlbey Faruk Nergiz", phone: "0535 014 77 69" },
    { email: "zahit@palmiyeyatirim.com", name: "Nureddin Zahit Arıduru", phone: "0505 146 59 49" },
    { email: "omer@palmiyeyatirim.com", name: "Ömer Nergiz", phone: "0532 465 03 15" }
  ]
};