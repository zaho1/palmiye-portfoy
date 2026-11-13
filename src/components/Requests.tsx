import { useMemo, useState } from 'react';
import type { CustomerRequest, Property } from '../types';
import { REGIONS, formatPrice, parseSize, relativeDay, type NewRequest } from '../lib/sheets';
import { matchesFor } from '../lib/match';
import { Thumb } from './ui';
import { btnPrimary, btnSecondary } from './Dialog';

interface Props {
  requests: CustomerRequest[];
  properties: Property[];
  defaultAgentName: string;
  ready: boolean;
  onCreate: (r: NewRequest) => void;
  onClose: (r: CustomerRequest) => void;
}

const KINDS = ['Daire', 'Villa / Müstakil', 'Arsa', 'Tarla / Bahçe', 'Dükkan / İşyeri'];
const ROOMS = ['1+1', '2+1', '3+1', '4+1', '5+1'];

export default function Requests({ requests, properties, defaultAgentName, ready, onCreate, onClose }: Props) {
  const empty: NewRequest = { agentName: defaultAgentName, deal: 'Satılık', kind: '', region: '', rooms: '', maxPrice: '', minSize: '', note: '' };
  const [form, setForm] = useState<NewRequest>(empty);
  const [showClosed, setShowClosed] = useState(false);
  const set = (k: keyof NewRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const open = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'Açık')
        .map((r) => ({ r, matches: matchesFor(r, properties) }))
        .sort((a, b) => b.matches.length - a.matches.length),
    [requests, properties],
  );
  const closed = requests.filter((r) => r.status === 'Kapandı');
  // Formdaki talebe şu an uyan ilan sayısı: talebi kaydetmeden önce görülür
  const preview = useMemo(
    () =>
      matchesFor(
        {
          id: '',
          createdAt: null,
          status: 'Açık',
          agentName: '',
          deal: form.deal,
          kind: form.kind,
          region: form.region,
          rooms: form.rooms,
          maxPrice: parseInt(form.maxPrice.replace(/[^0-9]/g, '') || '0', 10),
          minSize: parseSize(form.minSize),
          note: '',
        },
        properties,
      ).length,
    [form, properties],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Müşteri talepleri</h1>
        <p className="text-muted mt-1">
          Müşterinin aradığını girin; portföye uyan ilan girildiği anda burada ve ilanın sayfasında görünür.
          {open.length > 0 && <span className="text-ink"> {open.filter((o) => o.matches.length > 0).length} / {open.length} açık talebe uyan ilan var.</span>}
        </p>
      </div>

      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-[14px] lg:items-start">
        <form
          className="bg-surface rounded-xl p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(form);
            setForm(empty);
          }}
        >
          <h2 className="text-base font-semibold">Yeni talep</h2>
          <div className="grid grid-cols-2 gap-3">
            <Select id="r-deal" label="Tür" value={form.deal} onChange={set('deal')} options={['Satılık', 'Kiralık']} />
            <Select id="r-kind" label="Cins" value={form.kind} onChange={set('kind')} options={KINDS} any="Fark etmez" />
            <Select id="r-region" label="Bölge" value={form.region} onChange={set('region')} options={REGIONS} any="Fark etmez" />
            <Select id="r-rooms" label="Oda" value={form.rooms} onChange={set('rooms')} options={ROOMS} any="Fark etmez" />
            <div>
              <label htmlFor="r-max" className="block text-sm font-medium mb-2">En çok fiyat</label>
              <input id="r-max" inputMode="numeric" placeholder="₺" value={form.maxPrice} onChange={set('maxPrice')} className="field num" />
            </div>
            <div>
              <label htmlFor="r-size" className="block text-sm font-medium mb-2">En az m²</label>
              <input id="r-size" inputMode="numeric" value={form.minSize} onChange={set('minSize')} className="field num" />
            </div>
          </div>
          <div>
            <label htmlFor="r-note" className="block text-sm font-medium mb-2">Not</label>
            <input id="r-note" placeholder="Örn. Okula yakın, bahçeli olsun" value={form.note} onChange={set('note')} className="field" />
            <p className="text-xs text-faint mt-1">Müşterinin telefonunu buraya yazmayın; talebi siz takip edersiniz.</p>
          </div>
          <div>
            <label htmlFor="r-agent" className="block text-sm font-medium mb-2">Talebi alan danışman</label>
            <input id="r-agent" value={form.agentName} onChange={set('agentName')} className="field" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted num">Şu an {preview} ilan uyuyor</span>
            <button type="submit" disabled={!ready} className={`${btnPrimary} disabled:opacity-60`}>Talebi kaydet</button>
          </div>
          {!ready && <p className="text-xs text-warning">Talepler şu an kaydedilemiyor. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p>}
        </form>

        <section aria-label="Açık talepler" className="space-y-[14px] min-w-0">
          {open.length === 0 ? (
            <div className="rounded-lg border border-dashed border-control px-4 py-3 text-muted">Açık müşteri talebi yok. Soldaki formdan ilk talebi girin.</div>
          ) : (
            open.map(({ r, matches }) => (
              <article key={r.id} className="bg-surface rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">
                      {[r.deal, r.kind, r.rooms].filter(Boolean).join(' ')}
                      {r.region ? `, ${r.region}` : ''}
                    </h2>
                    <p className="text-sm text-muted num">
                      {[r.maxPrice ? `En çok ${formatPrice(r.maxPrice)}` : '', r.minSize ? `en az ${r.minSize} m²` : '', r.note].filter(Boolean).join(' · ') || 'Ek ölçüt yok'}
                    </p>
                    <p className="text-xs text-faint mt-0.5">{r.agentName} · {relativeDay(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`h-5 px-2 rounded-full text-xs font-medium flex items-center num ${matches.length ? 'bg-positive-bg text-positive' : 'bg-raised text-muted'}`}>
                      {matches.length} ilan uyuyor
                    </span>
                    <button onClick={() => onClose(r)} className={btnSecondary}>Kapat</button>
                  </div>
                </div>
                {matches.length > 0 && (
                  <ul className="mt-3">
                    {matches.slice(0, 5).map((p) => (
                      <li key={p.id} className="border-t border-rule">
                        <a href={`#/ilan/${encodeURIComponent(p.id)}`} className="flex items-center gap-3 py-2 hover:bg-active -mx-2 px-2 rounded">
                          <Thumb src={p.imageUrl} alt="" className="w-12 h-9 rounded flex-none" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">{p.title}</span>
                            <span className="block text-xs text-faint truncate">{p.id} · {p.agentName}</span>
                          </span>
                          <span className="text-sm text-accent num whitespace-nowrap">{formatPrice(p.price)}</span>
                        </a>
                      </li>
                    ))}
                    {matches.length > 5 && <li className="text-xs text-faint pt-2">ve {matches.length - 5} ilan daha</li>}
                  </ul>
                )}
              </article>
            ))
          )}

          {closed.length > 0 && (
            <div>
              <button onClick={() => setShowClosed((v) => !v)} className="text-sm text-muted hover:text-ink underline underline-offset-2">
                {showClosed ? 'Kapanan talepleri gizle' : `Kapanan talepler (${closed.length})`}
              </button>
              {showClosed && (
                <ul className="mt-2 text-sm text-muted">
                  {closed.map((r) => (
                    <li key={r.id} className="py-1.5 border-t border-rule">{[r.deal, r.kind, r.rooms, r.region].filter(Boolean).join(' · ')} · {r.agentName}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Select({ id, label, value, onChange, options, any }: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  any?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-2">{label}</label>
      <select id={id} value={value} onChange={onChange} className="field">
        {any !== undefined && <option value="">{any}</option>}
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}
