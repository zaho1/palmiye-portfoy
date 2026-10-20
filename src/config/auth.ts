// Ofis Yetkili Danışman Listesi ve Şifre Yönetimi
export const OFFICE_AUTH_CONFIG = {
  // Ortak Ofis Şifresi
  defaultPassword: "Palmiye2026!",
  
  // Sadece Yetkili 3 Özel Hesap
  allowedUsers: [
    { email: "ilbey@palmiyeyatirim.com", name: "İlbey Faruk Nergiz" },
    { email: "zahit@palmiyeyatirim.com", name: "Nureddin Zahit Arıduru" },
    { email: "omer@palmiyeyatirim.com", name: "Ömer Nergiz" }
  ]
};