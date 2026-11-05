import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { CustomerRequest, Property } from '../types';
import { isIncomplete, isStale } from '../lib/sheets';
import { matchesFor } from '../lib/match';
import { useSettings } from '../lib/settings';

interface Props {
  properties: Property[];
  requests: CustomerRequest[];
  userName: string;
}

// Zil: danışmanın bugün yapması gerekenler. Her madde ilgili filtreye götürür.
export default function Notifications({ properties, requests, userName }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();

  const items = useMemo(() => {
    const key = userName.toLocaleLowerCase('tr');
    const mine = properties.filter((p) => p.status === 'Aktif' && p.agentName.toLocaleLowerCase('tr').includes(key));
    const myRequests = requests.filter((r) => r.status === 'Açık' && r.agentName.toLocaleLowerCase('tr').includes(key));
    const matched = myRequests.filter((r) => matchesFor(r, properties).length > 0).length;
    const stale = mine.filter((p) => isStale(p, settings.staleDays)).length;
    const incomplete = mine.filter(isIncomplete).length;
    return [
      matched > 0 && { href: '#/talepler', text: `Aldığınız ${matched} müşteri talebine uyan ilan var.` },
      stale > 0 && { href: '#/?filtre=teyitsiz', text: `${stale} ilanınız ${settings.staleDays} gündür teyit edilmedi. Mal sahibiyle görüşüp “Güncel”e basın.` },
      incomplete > 0 && { href: '#/?filtre=eksik', text: `${incomplete} ilanınızda ada/parsel, fotoğraf veya metrekare eksik.` },
    ].filter(Boolean) as { href: string; text: string }[];
  }, [properties, requests, userName, settings.staleDays]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={items.length ? `Bildirimler, ${items.length} yeni` : 'Bildirimler'}
        className="relative w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface"
      >
        <Bell className="w-4 h-4" />
        {items.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-warning" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[320px] max-w-[calc(100vw-32px)] bg-raised rounded-xl p-2 shadow-[0_12px_28px_rgba(0,0,0,.35)]">
          <p className="px-3 pt-2 pb-1 text-sm font-semibold">Yapılacaklar</p>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted">Bekleyen iş yok. İlanlarınız güncel.</p>
          ) : (
            <ul>
              {items.map((it) => (
                <li key={it.href}>
                  <a href={it.href} onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm hover:bg-active">
                    {it.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
