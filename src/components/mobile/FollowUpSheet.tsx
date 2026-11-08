import { useState } from 'react';
import type { CustomerRequest } from '../../types';
import type { RequestFollowUp } from '../../lib/sheets';
import { inDays, todayStr } from '../../lib/followup';
import { Chip, MField, Sheet, btnBig, btnBigSecondary } from './controls';

const OPTIONS: { label: string; days: number }[] = [
  { label: 'Yarın', days: 1 },
  { label: '3 gün sonra', days: 3 },
  { label: '1 hafta', days: 7 },
  { label: '2 hafta', days: 14 },
  { label: '1 ay', days: 30 },
];

export const requestLabel = (r: CustomerRequest) =>
  `${[r.deal, r.kind, r.rooms].filter(Boolean).join(' ') || 'Talep'}${r.region ? `, ${r.region}` : ''}`;

// Görüşme sonrası: ne konuşuldu, ne zaman tekrar aranacak
export default function FollowUpSheet({ request, onSave, onClose }: { request: CustomerRequest; onSave: (f: RequestFollowUp) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [next, setNext] = useState(request.nextCall ?? '');
  const [pick, setPick] = useState(false);

  const save = () => {
    const f: RequestFollowUp = { nextCall: next, lastContact: todayStr() };
    if (note.trim()) f.contactNote = note.trim();
    onSave(f);
    onClose();
  };

  return (
    <Sheet
      title="Görüşme"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className={`${btnBigSecondary} flex-1`}>Vazgeç</button>
          <button onClick={save} className={`${btnBig} flex-[2]`}>Kaydet</button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-[16px] font-semibold">{request.customer ? `${request.customer} · ` : ''}{requestLabel(request)}</p>
          {request.contactNote && (
            <p className="mt-1 text-[14px] text-muted">
              Son not{request.lastContact ? ` (${request.lastContact})` : ''}: {request.contactNote}
            </p>
          )}
        </div>

        <MField label="Ne konuştunuz?" htmlFor="fu-note">
          <textarea id="fu-note" rows={3} placeholder="Örn. Bütçeyi 3,5 milyona çıkardı, hafta sonu gezmek istiyor" value={note} onChange={(e) => setNote(e.target.value)} className="field-lg py-3 leading-6" />
        </MField>

        <MField label="Ne zaman tekrar aransın?">
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((o) => (
              <Chip key={o.label} on={next === inDays(o.days)} onClick={() => { setPick(false); setNext(inDays(o.days)); }}>{o.label}</Chip>
            ))}
            <Chip on={pick} onClick={() => setPick(true)}>Tarih seç</Chip>
            <Chip on={next === '' && !pick} onClick={() => { setPick(false); setNext(''); }}>Hatırlatma yok</Chip>
          </div>
          {pick && (
            <input type="date" aria-label="Arama tarihi" min={todayStr()} value={next} onChange={(e) => setNext(e.target.value)} className="field-lg mt-3 num" />
          )}
        </MField>
      </div>
    </Sheet>
  );
}
