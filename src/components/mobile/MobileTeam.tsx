import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Phone, Search, UserPlus } from 'lucide-react';
import type { Property } from '../../types';
import { addAdvisor, fetchAdvisors, fetchAllAdvisors, formatPhone, phoneDigits, setAdvisorActive, type AdvisorRow } from '../../lib/sheets';
import { isAdmin, isHiddenPerson } from '../../lib/admin';
import { directoryStore, useDirectory } from '../../lib/people';
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
  const admin = isAdmin(userEmail);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Danışman' as 'Danışman' | 'Yönetici' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<{ name: string; email: string; invite: string } | null>(null);
  const [accounts, setAccounts] = useState<AdvisorRow[] | null>(null);
  const [busyEmail, setBusyEmail] = useState('');

  const reloadAccounts = () => {
    if (!admin) return;
    fetchAllAdvisors().then(setAccounts);
  };
  useEffect(reloadAccounts, [admin]);

  const toggleActive = async (a: AdvisorRow) => {
    setBusyEmail(a.email);
    try {
      await setAdvisorActive(a.email, !a.active);
      setAccounts((prev) => (prev ?? []).map((x) => (x.email === a.email ? { ...x, active: !a.active } : x)));
      fetchAdvisors().then((rows) => rows.length && directoryStore.set(rows)).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setBusyEmail('');
    }
  };

  const submit = async () => {
    setErr('');
    if (!form.name.trim() || !form.email.trim()) return setErr('Ad ve e-posta zorunlu.');
    setBusy(true);
    try {
      const res = await addAdvisor({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
      if (!res.success || !res.invite) throw new Error(res.message || 'Eklenemedi');
      setCreated({ name: form.name.trim(), email: form.email.trim().toLowerCase(), invite: res.invite });
      reloadAccounts();
      setForm({ name: '', email: '', phone: '', role: 'Danışman' });
      setAdding(false);
      fetchAdvisors().then((rows) => rows.length && directoryStore.set(rows)).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  };

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

      {admin && (
        <section className="bg-surface rounded-2xl p-4 space-y-3">
          {created && (
            <div className="bg-raised rounded-xl p-3">
              <p className="text-[14px]">{created.name} eklendi. Davet kodu:</p>
              <p className="text-[22px] font-semibold num tracking-widest mt-1">{created.invite}</p>
              <p className="text-[13px] text-muted mt-1">Bu kodu kişiye iletin. İlk girişte "İlk kez mi giriş yapıyorsunuz?" deyip şifre belirleyecek. ({created.email})</p>
            </div>
          )}
          {/* Aktifler zaten aşağıdaki listede (ara / WhatsApp). Burada yalnızca pasif hesaplar, tekrar açabilmek için. */}
          {accounts && accounts.some((a) => !a.active) && (
            <div className="space-y-2">
              <p className="text-[13px] text-faint">Pasif hesaplar</p>
              <ul className="divide-y divide-rule">
                {accounts.filter((a) => !a.active).map((a) => (
                  <li key={a.email} className="py-2 flex items-center gap-3">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] truncate">{a.name}</span>
                      <span className="block text-[12px] text-faint truncate">{a.role}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busyEmail === a.email}
                      onClick={() => toggleActive(a)}
                      className="min-h-9 px-3 rounded-full text-[14px] font-medium bg-raised text-ink disabled:opacity-50"
                    >
                      {busyEmail === a.email ? '…' : 'Aktif yap'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} className="w-full min-h-12 flex items-center gap-3 text-left">
              <UserPlus className="w-6 h-6 text-muted" />
              <span className="text-[16px]">Danışman ekle</span>
            </button>
          ) : (
            <div className="space-y-3">
              <input className="field-lg bg-raised border-transparent" placeholder="Ad Soyad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="field-lg bg-raised border-transparent" placeholder="E-posta" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="field-lg bg-raised border-transparent" placeholder="Telefon" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="field-lg bg-raised border-transparent" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'Danışman' | 'Yönetici' })}>
                <option value="Danışman">Danışman</option>
                <option value="Yönetici">Yönetici</option>
              </select>
              {err && <p className="text-[14px] text-negative">{err}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={submit} className="flex-1 min-h-12 rounded-full bg-ink text-ground font-medium disabled:opacity-60">{busy ? 'Ekleniyor…' : 'Ekle'}</button>
                <button type="button" onClick={() => { setAdding(false); setErr(''); }} className="min-h-12 px-5 rounded-full bg-raised">Vazgeç</button>
              </div>
            </div>
          )}
        </section>
      )}

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
