import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { CustomerRequest, Property } from '../../types';
import { formatPrice, relativeDay, type RequestFollowUp } from '../../lib/sheets';
import { TONE_CLASS, callLabel, isDue } from '../../lib/followup';
import { matchesFor } from '../../lib/match';
import { Thumb } from '../ui';
import { Segmented, Sheet, btnBig, btnBigSecondary } from './controls';
import { ChevronRightIcon } from './icons';
import FollowUpSheet from './FollowUpSheet';

interface Props {
  requests: CustomerRequest[];
  properties: Property[];
  userName: string;
  ready: boolean;
  onClose: (r: CustomerRequest) => void;
  onFollowUp: (r: CustomerRequest, f: RequestFollowUp) => void;
}

const title = (r: CustomerRequest) => `${[r.deal, r.kind, r.rooms].filter(Boolean).join(' ')}${r.region ? `, ${r.region}` : ''}`;

export default function MobileRequests({ requests, properties, userName, ready, onClose, onFollowUp }: Props) {
  const [who, setWho] = useState('Hepsi');
  const [showClosed, setShowClosed] = useState(false);
  const [closing, setClosing] = useState<CustomerRequest | null>(null);
  const [following, setFollowing] = useState<CustomerRequest | null>(null);
  const mineKey = userName.toLocaleLowerCase('tr');

  const scoped = useMemo(
    () => (who === 'Benimkiler' ? requests.filter((r) => r.agentName.toLocaleLowerCase('tr').includes(mineKey)) : requests),
    [requests, who, mineKey],
  );
  // Uyan ilanı olan talepler önde
  const open = useMemo(
    () =>
      scoped
        .filter((r) => r.status === 'Açık')
        .map((r) => ({ r, matches: matchesFor(r, properties) }))
        // Önce aranması gelenler, sonra uyan ilanı çok olanlar
        .sort((a, b) => Number(isDue(b.r.nextCall)) - Number(isDue(a.r.nextCall)) || b.matches.length - a.matches.length),
    [scoped, properties],
  );
  const closed = scoped.filter((r) => r.status === 'Kapandı');
  const withMatch = open.filter((o) => o.matches.length > 0).length;

  return (
    <div>
      <header className="m-top px-4 pt-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold flex-1 min-w-0">Talepler</h1>
        <a href="#/talep/yeni" className="h-11 pl-4 pr-5 rounded-full bg-ink text-ground text-[15px] font-semibold flex items-center gap-2 active:opacity-80">
          <UserPlus className="w-5 h-5" /> Yeni talep
        </a>
      </header>

      <div className="px-4 pt-3">
        <Segmented label="Hangi talepler" value={who} options={['Hepsi', 'Benimkiler']} onChange={setWho} />
        <p className="mt-3 text-[14px] text-muted num">
          {open.length} açık talep{open.length > 0 && ` · ${withMatch} tanesine uyan ilan var`}
        </p>
      </div>

      {!ready && (
        <p className="mx-4 mt-3 rounded-xl bg-warning-bg px-4 py-3 text-[14px] text-warning">
          Talepler şu an yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.
        </p>
      )}

      <div className="px-4 pt-3 space-y-3">
        {open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-control px-4 py-6 text-muted text-center">
            Açık müşteri talebi yok. Sağ üstteki "Yeni talep" ile ilkini girin.
          </div>
        ) : (
          open.map(({ r, matches }) => {
            const call = callLabel(r.nextCall);
            return (
            <article key={r.id} className="bg-surface rounded-2xl p-4">
              {r.customer && <p className="text-[14px] text-muted">{r.customer}</p>}
              <h2 className="text-[17px] font-semibold leading-6">{title(r) || 'Talep'}</h2>
              <p className="mt-1 text-[15px] text-muted num">
                {[r.maxPrice ? `En çok ${formatPrice(r.maxPrice)}` : '', r.minSize ? `en az ${r.minSize} m²` : '', r.note].filter(Boolean).join(' · ') || 'Ek ölçüt yok'}
              </p>
              <p className="mt-1 text-[13px] text-faint">{r.agentName} · {relativeDay(r.createdAt)}</p>
              {(call || r.contactNote) && (
                <p className="mt-2 text-[14px] leading-5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {call && <span className={`h-6 px-2.5 rounded-full text-[13px] font-medium inline-flex items-center ${TONE_CLASS[call.tone]}`}>{call.text}</span>}
                  {r.contactNote && <span className="text-muted min-w-0">“{r.contactNote}”{r.lastContact ? ` · ${r.lastContact}` : ''}</span>}
                </p>
              )}

              <p className={`mt-3 inline-flex h-7 px-3 rounded-full text-[14px] font-medium items-center num ${matches.length ? 'bg-positive-bg text-positive' : 'bg-raised text-muted'}`}>
                {matches.length ? `${matches.length} ilan uyuyor` : 'Şu an uyan ilan yok'}
              </p>

              {matches.length > 0 && (
                <ul className="m-hscroll mt-3 -mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1">
                  {matches.slice(0, 12).map((p) => (
                    <li key={p.id} className="snap-start shrink-0 w-44">
                      <a href={`#/ilan/${encodeURIComponent(p.id)}`} className="block rounded-xl bg-ground overflow-hidden active:opacity-80">
                        <Thumb src={p.imageUrl} alt="" className="w-full aspect-[4/3]" />
                        <div className="p-2.5">
                          <p className="text-[15px] font-semibold text-accent num">{formatPrice(p.price)}</p>
                          <p className="text-[13px] leading-[18px] line-clamp-2">{p.title}</p>
                          <p className="mt-1 text-[12px] text-faint flex items-center gap-0.5">İlanı aç <ChevronRightIcon className="w-3.5 h-3.5" /></p>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {matches.length > 12 && <p className="mt-2 text-[13px] text-faint">ve {matches.length - 12} ilan daha</p>}

              <div className="mt-3 pt-1 border-t border-rule -mb-2 flex items-center gap-4">
                <button onClick={() => setFollowing(r)} className="min-h-11 text-[15px] font-medium">Görüşme yaz</button>
                <button onClick={() => setClosing(r)} className="min-h-11 text-[15px] text-muted underline underline-offset-2">Talebi kapat</button>
              </div>
            </article>
            );
          })
        )}

        {closed.length > 0 && (
          <div>
            <button onClick={() => setShowClosed((v) => !v)} className="min-h-11 text-[15px] text-muted underline underline-offset-2">
              {showClosed ? 'Kapanan talepleri gizle' : `Kapanan talepler (${closed.length})`}
            </button>
            {showClosed && (
              <ul className="text-[15px] text-muted">
                {closed.map((r) => (
                  <li key={r.id} className="py-2.5 border-t border-rule">{[title(r), r.agentName].filter(Boolean).join(' · ')}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {following && <FollowUpSheet request={following} onSave={(f) => onFollowUp(following, f)} onClose={() => setFollowing(null)} />}

      {closing && (
        <Sheet
          title="Talep kapatılsın mı?"
          onClose={() => setClosing(null)}
          footer={
            <div className="flex gap-3">
              <button onClick={() => setClosing(null)} className={`${btnBigSecondary} flex-1`}>Vazgeç</button>
              <button
                onClick={() => {
                  onClose(closing);
                  setClosing(null);
                }}
                className={`${btnBig} flex-1`}
              >
                Kapat
              </button>
            </div>
          }
        >
          <p className="text-[15px] text-muted">
            “{title(closing) || 'Talep'}” açık taleplerden kalkar ve artık ilan eşleştirmez. Müşteri aradığını bulduysa kapatın.
          </p>
        </Sheet>
      )}
    </div>
  );
}
