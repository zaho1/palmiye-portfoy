import { useMemo, useState } from 'react';
import { MessageCircle, Phone, Search } from 'lucide-react';
import type { Property } from '../../types';
import { formatPhone, phoneDigits } from '../../lib/sheets';
import { isHiddenPerson } from '../../lib/admin';
import { useDirectory } from '../../lib/people';
import { ChevronRightIcon } from './icons';

interface Props {
  properties: Property[];
  userEmail: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr');

// Ofis rehberi: herkes, aktif ilan sayısı, tek dokunuşla arama ve WhatsApp
export default function MobileTeam({ properties, userEmail }: Props) {
  const everyone = useDirectory();
  const directory = useMemo(() => everyone.filter((u) => !isHiddenPerson(u.email)), [everyone]);
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    properties.forEach((p) => {
      if (p.status !== 'Aktif') return;
      const k = p.agentName.toLocaleLowerCase('tr').trim();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [properties]);

  // Rehberde adı olmayan ilanlar (ör. sitede danışman yazmayan "Palmiye Yatırım" ilanları)
  const unassigned = useMemo(() => {
    const names = new Set(everyone.map((u) => u.name.toLocaleLowerCase('tr').trim()));
    let n = 0;
    counts.forEach((c, k) => { if (!names.has(k)) n += c; });
    return n;
  }, [counts, everyone]);

  const people = useMemo(() => {
    const key = q.toLocaleLowerCase('tr').trim();
    return directory
      .filter((u) => !key || u.name.toLocaleLowerCase('tr').includes(key) || u.phone.replace(/\D/g, '').includes(key.replace(/\D/g, '') || '¤'))
      .map((u) => {
        const agentPhone = u.phone || properties.find((p) => p.agentName === u.name && p.agentPhone)?.agentPhone || '';
        return { ...u, phone: agentPhone, active: counts.get(u.name.toLocaleLowerCase('tr').trim()) ?? 0 };
      })
      .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'tr'));
  }, [directory, q, counts, properties]);

  const iconBtn = 'w-11 h-11 rounded-full flex items-center justify-center shrink-0';

  return (
    <div className="m-top px-4 pt-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Danışmanlar</h1>
        <span className="text-[14px] text-faint num">{directory.length} kişi</span>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
        <label htmlFor="team-search" className="sr-only">Danışman ara</label>
        <input
          id="team-search"
          type="search"
          placeholder="İsim veya telefon…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field-lg pl-11 bg-surface border-transparent"
        />
      </div>

      <section className="bg-surface rounded-2xl overflow-hidden divide-y divide-rule">
        {people.map((u) => {
          const digits = phoneDigits(u.phone);
          const me = u.email.toLowerCase() === userEmail.toLowerCase();
          return (
            <div key={u.email} className="min-h-16 pl-4 pr-2 py-2 flex items-center gap-3">
              <a href={`#/danisman/${encodeURIComponent(u.name)}`} className="flex-1 min-w-0 flex items-center gap-3 active:opacity-70">
                <span className="w-11 h-11 rounded-full bg-raised flex items-center justify-center text-[15px] font-semibold shrink-0" aria-hidden="true">
                  {initials(u.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium truncate">
                    {u.name}
                    {me && <span className="text-faint font-normal"> · sen</span>}
                  </span>
                  <span className="block text-[13px] text-muted truncate num">
                    {u.active ? `${u.active} aktif ilan` : 'Aktif ilanı yok'}
                    {u.role === 'Yönetici' ? ' · Yönetici' : ''}
                  </span>
                </span>
                <ChevronRightIcon className="w-5 h-5 text-faint shrink-0" />
              </a>
              {digits && !me ? (
                <>
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" aria-label={`${u.name} WhatsApp`} className={`${iconBtn} bg-positive-bg text-positive active:opacity-80`}>
                    <MessageCircle className="w-5 h-5" />
                  </a>
                  <a href={`tel:+${digits}`} aria-label={`${u.name} ara (${formatPhone(u.phone)})`} className={`${iconBtn} bg-raised text-ink active:bg-active`}>
                    <Phone className="w-5 h-5" />
                  </a>
                </>
              ) : null}
            </div>
          );
        })}
        {!people.length && <p className="px-4 py-6 text-center text-muted">Bu aramayla eşleşen danışman yok.</p>}
        {unassigned > 0 && !q.trim() && (
          <div className="min-h-14 px-4 py-2 flex items-center gap-3 text-muted">
            <span className="w-11 h-11 rounded-full bg-raised flex items-center justify-center text-[15px] font-semibold shrink-0" aria-hidden="true">PY</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-medium truncate text-ink">Ofis (danışman atanmamış)</span>
              <span className="block text-[13px] num">{unassigned} aktif ilan</span>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
