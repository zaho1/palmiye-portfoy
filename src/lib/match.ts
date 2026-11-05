import type { CustomerRequest, Property } from '../types';
import { kindOf, parsePrice, parseSize } from './sheets';

const lower = (s: string) => s.toLocaleLowerCase('tr');

// Bir müşteri talebine uyan aktif ilanlar. Talepte boş bırakılan alan "fark etmez" demektir.
export function matchesRequest(p: Property, r: CustomerRequest): boolean {
  if (p.status !== 'Aktif' || r.status !== 'Açık') return false;
  if (r.deal && !lower(p.category).includes(lower(r.deal))) return false;
  if (r.kind && lower(kindOf(p.category)) !== lower(r.kind)) return false;
  if (r.region && lower(p.region) !== lower(r.region)) return false;
  if (r.rooms && p.rooms && p.rooms.replace(/\s/g, '') !== r.rooms.replace(/\s/g, '')) return false;
  if (r.maxPrice && parsePrice(p.price) > r.maxPrice) return false;
  if (r.minSize && parseSize(p.size) < r.minSize) return false;
  return true;
}

export const matchesFor = (r: CustomerRequest, properties: Property[]) => properties.filter((p) => matchesRequest(p, r));
export const requestsFor = (p: Property, requests: CustomerRequest[]) => requests.filter((r) => matchesRequest(p, r));
