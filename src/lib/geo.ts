import { useSyncExternalStore } from 'react';
import type { Property } from '../types';
import { coordsOf } from './sheets';

// Bulunduğum yer: ilanları yakınlığa göre sıralamak ve mesafe göstermek için.
// Konum yalnızca bu telefonda kullanılır, hiçbir yere gönderilmez.

export interface Position {
  lat: number;
  lng: number;
  at: number;
}

let last: Position | null = null;
let pending: Promise<Position> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export class GeoError extends Error {
  denied: boolean;
  constructor(message: string, denied: boolean) {
    super(message);
    this.denied = denied;
  }
}

/** Konumu bir kez alır; yeni alınmışsa (2 dk) aynısını verir. */
export function locate(): Promise<Position> {
  if (last && Date.now() - last.at < 120_000) return Promise.resolve(last);
  if (pending) return pending;
  pending = new Promise<Position>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('Bu telefon konum bilgisini vermiyor.', false));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        last = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
        emit();
        resolve(last);
      },
      (err) =>
        reject(
          new GeoError(
            err.code === err.PERMISSION_DENIED
              ? 'Konum izni verilmedi. Telefon ayarlarından Safari veya Chrome için konuma izin verin.'
              : 'Konum alınamadı. Açık havada tekrar deneyin.',
            err.code === err.PERMISSION_DENIED,
          ),
        ),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }).finally(() => {
    pending = null;
  });
  return pending;
}

export function useMyPosition(): Position | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => last,
  );
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** İlanın bana uzaklığı (km). Konumu işaretlenmemişse bölge merkezine göre yaklaşıktır. */
export function distanceTo(p: Property, me: { lat: number; lng: number }): { km: number; approx: boolean } | null {
  const c = coordsOf(p);
  return c ? { km: distanceKm(me, c), approx: c.approx } : null;
}

export function formatKm(km: number, approx = false): string {
  const text = km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
  return approx ? `~${text}` : text;
}

/** Harita uygulamasında yol tarifi. Konum işaretliyse tam nokta, değilse bölge/mahalle araması. */
export function directionsUrl(p: Property): string {
  if (p.lat !== undefined && p.lng !== undefined) {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
  }
  const q = [p.neighborhood, p.region !== 'Belirtilmemiş' ? p.region : '', 'Yalova'].filter(Boolean).join(' ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
