import { useMemo, useState } from 'react';
import type { Property } from '../types';
import { REGIONS, coordsOf, formatPrice, isRent, parseSize } from '../lib/sheets';
import MapView, { type MapPoint } from './MapView';
import { Thumb } from './ui';

type Deal = 'Hepsi' | 'Satılık' | 'Kiralık';

export default function Maps({ properties }: { properties: Property[] }) {
  const [deal, setDeal] = useState<Deal>('Hepsi');
  const [region, setRegion] = useState('Hepsi');
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      properties.filter(
        (p) =>
          p.status === 'Aktif' &&
          (deal === 'Hepsi' || p.category.toLocaleLowerCase('tr').includes(deal.toLocaleLowerCase('tr'))) &&
          (region === 'Hepsi' || p.region === region),
      ),
    [properties, deal, region],
  );

  const points = useMemo<MapPoint[]>(
    () =>
      rows.flatMap((p) => {
        const c = coordsOf(p);
        return c ? [{ id: p.id, ...c, label: p.title, sub: `${formatPrice(p.price)}${isRent(p) ? ' /ay' : ''} · ${p.agentName}` }] : [];
      }),
    [rows],
  );

  const exact = points.filter((p) => !p.approx).length;
  const unplaced = rows.length - points.length;
  const selectedRow = rows.find((p) => p.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Harita</h1>
          <p className="text-muted mt-1 num">
            {points.length} aktif ilan haritada: {exact} kesin konum, {points.length - exact} yaklaşık (ilçe merkezi).
            {unplaced > 0 && ` ${unplaced} ilanın bölgesi belli değil.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 rounded-full bg-surface p-1" role="group" aria-label="Satılık veya kiralık">
            {(['Hepsi', 'Satılık', 'Kiralık'] as Deal[]).map((d) => (
              <button key={d} onClick={() => setDeal(d)} aria-pressed={deal === d} className={`px-3 rounded-full text-sm ${deal === d ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
                {d}
              </button>
            ))}
          </div>
          <label htmlFor="map-region" className="sr-only">Bölge</label>
          <select id="map-region" value={region} onChange={(e) => setRegion(e.target.value)} className="field h-9 !w-[170px]">
            <option value="Hepsi">Bütün bölgeler</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-[14px] lg:items-start">
        <div className="relative">
          <MapView points={points} selectedId={selected} onSelect={setSelected} label="İlan haritası" className="h-[360px] lg:h-[calc(100vh-210px)] min-h-[420px]" />
          <p className="mt-2 text-xs text-faint flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-accent" aria-hidden="true" /> Kesin konum</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-dashed border-accent" aria-hidden="true" /> Yaklaşık (detay sayfasından işaretlenebilir)</span>
          </p>
        </div>

        <aside className="bg-surface rounded-xl overflow-hidden lg:max-h-[calc(100vh-210px)] flex flex-col">
          {selectedRow && (
            <a href={`#/ilan/${encodeURIComponent(selectedRow.id)}`} className="block p-[14px] border-b border-rule hover:bg-active">
              <Thumb src={selectedRow.imageUrl} alt="" className="w-full aspect-[16/9] rounded-lg" />
              <p className="mt-2 text-base font-semibold text-accent num">{formatPrice(selectedRow.price)}{isRent(selectedRow) && <span className="text-faint text-sm"> /ay</span>}</p>
              <p className="font-medium">{selectedRow.title}</p>
              <p className="text-xs text-faint">{selectedRow.category} · {selectedRow.agentName} · Detayı aç</p>
            </a>
          )}
          <ul className="overflow-y-auto">
            {rows.length === 0 && <li className="p-4 text-sm text-muted">Bu filtrelerle aktif ilan yok.</li>}
            {rows.map((p) => {
              const c = coordsOf(p);
              return (
                <li key={p.id} className="border-t border-rule first:border-t-0">
                  <button
                    onClick={() => setSelected(p.id)}
                    disabled={!c}
                    aria-pressed={selected === p.id}
                    className={`w-full text-left flex items-center gap-3 px-[14px] py-2.5 transition-colors disabled:opacity-60 ${selected === p.id ? 'bg-active' : 'hover:bg-active'}`}
                  >
                    <Thumb src={p.imageUrl} alt="" className="w-12 h-12 rounded flex-none" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{p.title}</span>
                      <span className="block text-xs text-faint truncate">
                        {p.region}
                        {parseSize(p.size) ? ` · ${parseSize(p.size)} m²` : ''} · {c ? (c.approx ? 'yaklaşık konum' : 'kesin konum') : 'konum yok'}
                      </span>
                    </span>
                    <span className="text-sm text-accent num whitespace-nowrap">{formatPrice(p.price)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
