import { useEffect, useMemo, useState } from 'react';
import { REGIONS, formatPrice, parseSize, type NewRequest } from '../../lib/sheets';
import { matchesFor } from '../../lib/match';
import type { Property } from '../../types';
import { haptic, requestDraftStore } from '../../lib/personal';
import { Chip, MField, Segmented, btnBig } from './controls';
import { ChevronLeftIcon } from './icons';

interface Props {
  properties: Property[];
  defaultAgentName: string;
  ready: boolean;
  onCreate: (r: NewRequest) => void;
  onDone: () => void;
}

const KINDS = ['Daire', 'Villa / Müstakil', 'Arsa', 'Tarla / Bahçe', 'Dükkan / İşyeri'];
const ROOMS = ['1+1', '2+1', '3+1', '4+1', '5+1'];
const LAND = ['Arsa', 'Tarla / Bahçe'];

const digits = (s: string) => s.replace(/[^0-9]/g, '');
const grouped = (s: string) => (s ? Number(s).toLocaleString('tr-TR') : '');

// Müşteri talebi: tek ekran, büyük alanlar, sayı alanlarında sayısal klavye
export default function MobileNewRequest({ properties, defaultAgentName, ready, onCreate, onDone }: Props) {
  const makeForm = (): NewRequest => ({
    customer: '',
    agentName: defaultAgentName,
    deal: 'Satılık',
    kind: '',
    region: '',
    rooms: '',
    maxPrice: '',
    minSize: '',
    note: '',
  });
  // Yarım kalan talep telefonda saklanır
  const [restored] = useState(() => {
    const d = requestDraftStore.get();
    return d && Date.now() - d.savedAt < 48 * 3_600_000 ? d : null;
  });
  const [form, setForm] = useState<NewRequest>(() => ({ ...makeForm(), ...(restored?.form as Partial<NewRequest> | undefined) }));
  const [showRestored, setShowRestored] = useState(true);
  const dirty = !!(form.customer || form.kind || form.region || form.rooms || form.maxPrice || form.minSize || form.note.trim());
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (dirty) requestDraftStore.set({ savedAt: Date.now(), form: { ...form } });
      else requestDraftStore.clear();
    }, 500);
    return () => window.clearTimeout(t);
  }, [dirty, form]);
  const [editAgent, setEditAgent] = useState(false);
  const [error, setError] = useState('');
  const patch = (change: Partial<NewRequest>) => {
    setError('');
    setForm((f) => ({ ...f, ...change }));
  };
  const isLand = LAND.includes(form.kind);

  // Formdaki talebe şu an uyan ilan sayısı: kaydetmeden önce görülür
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
          rooms: isLand ? '' : form.rooms,
          maxPrice: parseInt(digits(form.maxPrice) || '0', 10),
          minSize: parseSize(form.minSize),
          note: '',
        },
        properties,
      ).length,
    [form, isLand, properties],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kind && !form.region && !form.rooms && !form.maxPrice && !form.minSize && !form.note.trim()) {
      setError('En az bir ölçüt seçin: cins, bölge, bütçe gibi.');
      return;
    }
    requestDraftStore.clear();
    haptic(20);
    onCreate({ ...form, rooms: isLand ? '' : form.rooms });
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="m-page-bar">
      <header className="m-top sticky top-0 z-30 bg-ground border-b border-rule h-14 px-2 flex items-center gap-1">
        <a href="#/talepler" aria-label="Geri" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-surface">
          <ChevronLeftIcon className="w-6 h-6" />
        </a>
        <h1 className="text-lg font-semibold">Yeni talep</h1>
      </header>

      <div className="px-4 pt-5 space-y-6">
        {restored && showRestored && dirty && (
          <div role="status" className="rounded-xl bg-surface px-4 py-3 text-[14px] flex items-center gap-3">
            <p className="flex-1 min-w-0 text-muted">Yarım kalan talebin geri geldi.</p>
            <button
              type="button"
              onClick={() => {
                requestDraftStore.clear();
                setForm(makeForm());
                setShowRestored(false);
              }}
              className="min-h-11 px-3 -mr-2 text-ink underline underline-offset-2 shrink-0"
            >
              Sıfırla
            </button>
          </div>
        )}
        <MField label="Müşteri (ad veya takma ad)" htmlFor="mr-customer">
          <input id="mr-customer" autoComplete="off" enterKeyHint="next" placeholder="Örn. Ahmet Bey, Çiftlikköy'lü" value={form.customer ?? ''} onChange={(e) => patch({ customer: e.target.value })} className="field-lg" />
        </MField>

        <MField label="İşlem">
          <Segmented label="Satılık veya kiralık" value={form.deal} options={['Satılık', 'Kiralık']} onChange={(v) => patch({ deal: v })} />
        </MField>

        <MField label="Cins">
          <div className="flex flex-wrap gap-2">
            <Chip on={form.kind === ''} onClick={() => patch({ kind: '' })}>Fark etmez</Chip>
            {KINDS.map((k) => (
              <Chip key={k} on={form.kind === k} onClick={() => patch(LAND.includes(k) ? { kind: k, rooms: '' } : { kind: k })}>{k}</Chip>
            ))}
          </div>
        </MField>

        <MField label="Bölge">
          <div className="flex flex-wrap gap-2">
            <Chip on={form.region === ''} onClick={() => patch({ region: '' })}>Fark etmez</Chip>
            {REGIONS.map((r) => <Chip key={r} on={form.region === r} onClick={() => patch({ region: r })}>{r}</Chip>)}
          </div>
        </MField>

        {!isLand && (
          <MField label="Oda sayısı">
            <div className="flex flex-wrap gap-2">
              <Chip on={form.rooms === ''} onClick={() => patch({ rooms: '' })}>Fark etmez</Chip>
              {ROOMS.map((r) => <Chip key={r} on={form.rooms === r} onClick={() => patch({ rooms: r })}>{r}</Chip>)}
            </div>
          </MField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <MField label={form.deal === 'Kiralık' ? 'En çok kira (₺)' : 'En çok fiyat (₺)'} htmlFor="mr-max">
            <input
              id="mr-max"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="2.500.000"
              value={grouped(digits(form.maxPrice))}
              onChange={(e) => patch({ maxPrice: digits(e.target.value) })}
              className="field-lg num"
            />
          </MField>
          <MField label="En az m²" htmlFor="mr-size">
            <input id="mr-size" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="100" value={form.minSize} onChange={(e) => patch({ minSize: digits(e.target.value) })} className="field-lg num" />
          </MField>
        </div>
        {form.maxPrice && <p className="-mt-4 text-[13px] text-faint num">Bütçe: {formatPrice(form.maxPrice)}</p>}

        <MField label="Not" htmlFor="mr-note">
          <textarea id="mr-note" rows={3} placeholder="Örn. Okula yakın, bahçeli olsun" value={form.note} onChange={(e) => patch({ note: e.target.value })} className="field-lg py-3 leading-6" />
          <p className="text-[13px] text-faint mt-1.5">Müşterinin telefon numarasını yazmayın; görüşme notlarını talep kartından eklersiniz.</p>
        </MField>

        <div>
          {editAgent ? (
            <MField label="Talebi alan danışman" htmlFor="mr-agent">
              <input id="mr-agent" value={form.agentName} onChange={(e) => patch({ agentName: e.target.value })} className="field-lg" />
            </MField>
          ) : (
            <p className="text-[15px] text-muted">
              Talebi alan: <span className="text-ink font-medium">{form.agentName}</span>{' '}
              <button type="button" onClick={() => setEditAgent(true)} className="min-h-11 px-2 underline underline-offset-2">değiştir</button>
            </p>
          )}
        </div>
      </div>

      <div className="m-bar">
        {error ? (
          <p role="alert" className="text-[14px] text-negative mb-2">{error}</p>
        ) : (
          <p className="text-[14px] text-muted mb-2 num">Şu an <b className="text-ink">{preview}</b> ilan uyuyor</p>
        )}
        <button type="submit" disabled={!ready} className={`${btnBig} w-full`}>Talebi kaydet</button>
        {!ready && <p className="text-[13px] text-warning mt-2">Talepler Apps Script yeni sürümü yayınlanınca kaydedilir.</p>}
      </div>
    </form>
  );
}
