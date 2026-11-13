export type ListingStatus = 'Aktif' | 'Pasif' | 'Satıldı' | 'Silindi';

export interface Property {
  id: string;
  title: string;
  price: string | number;
  category: string;
  imarStatus?: string;
  size?: string | number;
  description?: string;
  imageUrl?: string;
  images?: string[];
  sahibindenUrl?: string;
  adaParsel?: string;
  agentName: string;
  agentPhone: string;
  whatsappUrl?: string;
  status: ListingStatus;
  // v2 sütunları: eski satırlarda boş olabilir
  region: string;
  neighborhood?: string;
  rooms?: string;
  floor?: string;
  buildingAge?: string;
  heating?: string;
  features: string[];
  oldPrice?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  history?: ActivityEntry[];
  // "Konum" sütunu: "40.6961, 29.5081"
  lat?: number;
  lng?: number;
  // Parsel ve imar kartı (boş olabilir)
  taks?: string;
  kaks?: string;
  maxFloors?: string;
  imarNote?: string;
}

// Parsel ve imar kartında düzenlenen alanlar (Sheet sütun adlarıyla eşleşir)
export interface ParcelFields {
  adaParsel: string;
  neighborhood: string;
  imarStatus: string;
  taks: string;
  kaks: string;
  maxFloors: string;
  imarNote: string;
}

// Danışmanın elle girdiği piyasa emsali ("Emsaller" sayfası)
export interface Comp {
  id: string;
  at: Date | null;
  forTitle: string;
  source: string;
  link: string;
  category: string;
  region: string;
  neighborhood: string;
  size: number;
  rooms: string;
  price: number;
  state: 'İlanda' | 'Satıldı';
  note: string;
  addedBy: string;
  addedByEmail: string;
}

export interface OwnerInfo {
  name: string;
  phone: string;
  authorization: string;
  authorizationEnd: string;
  commission: string;
  keyLocation: string;
  note: string;
}

export interface CustomerRequest {
  id: string;
  createdAt: Date | null;
  status: 'Açık' | 'Kapandı';
  agentName: string;
  deal: string;
  kind: string;
  region: string;
  rooms: string;
  maxPrice: number;
  minSize: number;
  note: string;
  customer?: string;
  // Müşteri takibi (yyyy-MM-dd); boş olabilir
  nextCall?: string;
  lastContact?: string;
  contactNote?: string;
}

export interface ActivityEntry {
  at: Date | null;
  who: string;
  action: string;
  title: string;
  detail: string;
  noteId?: string;
}
