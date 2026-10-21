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
  status: string;
}