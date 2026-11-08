// Müşteri takibi tarihleri: yyyy-MM-dd metni (Sheets'te de böyle durur)

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());

export function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

function dayDiff(s: string): number | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const a = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  const b = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** Aranması gereken gün geldi mi (bugün veya geçmiş)? */
export const isDue = (next?: string) => !!next && next <= todayStr();

export function callLabel(next?: string): { text: string; tone: 'late' | 'today' | 'soon' | 'later' } | null {
  if (!next) return null;
  const n = dayDiff(next);
  if (n === null) return null;
  if (n < 0) return { text: `${-n} gün gecikti`, tone: 'late' };
  if (n === 0) return { text: 'Bugün ara', tone: 'today' };
  if (n === 1) return { text: 'Yarın ara', tone: 'soon' };
  if (n <= 7) return { text: `${n} gün sonra ara`, tone: 'soon' };
  const [, mo, da] = next.split('-');
  return { text: `${+da}.${mo} tarihinde ara`, tone: 'later' };
}

export const TONE_CLASS: Record<'late' | 'today' | 'soon' | 'later', string> = {
  late: 'bg-negative-bg text-negative',
  today: 'bg-warning-bg text-warning',
  soon: 'bg-raised text-ink',
  later: 'bg-raised text-muted',
};
