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
}

export interface ActivityEntry {
  at: Date | null;
  who: string;
  action: string;
  title: string;
  detail: string;
}
