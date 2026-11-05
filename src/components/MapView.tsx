import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { YALOVA_CENTER } from '../lib/sheets';
import { useSettings } from '../lib/settings';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  approx: boolean;
  label: string;
  sub?: string;
}

interface Props {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  // Konum seçme: haritaya tıklanan nokta
  pick?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
  label: string;
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#10b981';

// Aynı ilçe merkezine düşen yaklaşık noktalar üst üste binmesin: ilan numarasından sabit küçük kaydırma
function jitter(id: string): [number, number] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [((h % 100) / 100) * 0.008 - 0.004, (((h >> 8) % 100) / 100) * 0.008 - 0.004];
}

export default function MapView({ points, selectedId, onSelect, pick, onPick, center, zoom = 11, className = '', label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickLayer = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  const fitted = useRef(false);
  const { resolvedTheme } = useSettings();

  useEffect(() => {
    onPickRef.current = onPick;
    onSelectRef.current = onSelect;
  }, [onPick, onSelect]);

  // Haritayı bir kez kur
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { scrollWheelZoom: true, attributionControl: true }).setView(center ?? YALOVA_CENTER, center ? zoom : 10);
    m.attributionControl.setPrefix(false);
    // OpenStreetMap katmanı (anahtar gerekmez). Koyu temada index.css'teki filtreyle karartılır.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    pickLayer.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    const t = window.setTimeout(() => m.invalidateSize(), 50);
    return () => {
      window.clearTimeout(t);
      m.remove();
      map.current = null;
    };
    // center/zoom yalnızca açılışta kullanılır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // İlan noktaları. Kesin konum dolu nokta, yaklaşık konum kesikli halka.
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const accent = cssVar('--accent');
    const ink = cssVar('--ink');
    const latlngs: L.LatLngExpression[] = [];
    points.forEach((p) => {
      const [dy, dx] = p.approx ? jitter(p.id) : [0, 0];
      const pos: L.LatLngExpression = [p.lat + dy, p.lng + dx];
      latlngs.push(pos);
      const selected = p.id === selectedId;
      const mk = L.circleMarker(pos, {
        radius: selected ? 10 : p.approx ? 8 : 7,
        color: selected ? ink : accent,
        weight: selected ? 3 : 2,
        fillColor: accent,
        fillOpacity: p.approx ? 0.15 : 0.85,
        dashArray: p.approx ? '3 3' : undefined,
      });
      mk.bindTooltip(`<strong>${escapeHtml(p.label)}</strong>${p.sub ? `<br>${escapeHtml(p.sub)}` : ''}${p.approx ? '<br><em>Yaklaşık konum</em>' : ''}`, { direction: 'top', offset: [0, -6] });
      mk.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current?.(p.id);
      });
      mk.addTo(g);
    });
    if (!fitted.current && latlngs.length > 1) {
      m.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 14 });
      fitted.current = true;
    }
  }, [points, selectedId, resolvedTheme]);

  // Seçilen ilana uç
  useEffect(() => {
    const m = map.current;
    const p = points.find((x) => x.id === selectedId);
    if (m && p) m.flyTo([p.lat, p.lng], Math.max(m.getZoom(), p.approx ? 13 : 15), { duration: 0.6 });
  }, [selectedId, points]);

  // Seçme modundaki işaret
  useEffect(() => {
    const m = map.current;
    const g = pickLayer.current;
    if (!m || !g) return;
    g.clearLayers();
    if (pick) {
      L.circleMarker([pick.lat, pick.lng], { radius: 9, color: cssVar('--ink'), weight: 3, fillColor: cssVar('--accent'), fillOpacity: 0.9 }).addTo(g);
    }
  }, [pick, resolvedTheme]);

  // Bölge seçilince seçme haritası oraya kayar
  useEffect(() => {
    if (center && map.current && onPickRef.current && !pick) map.current.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  return <div ref={el} role="region" aria-label={label} className={`rounded-xl overflow-hidden z-0 ${onPick ? 'cursor-crosshair' : ''} ${className}`} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
