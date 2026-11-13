import type { ReactNode } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useSettings, type ThemeChoice } from '../lib/settings';
import type { SyncState } from './Sidebar';
import { btnSecondary } from './Dialog';
import { isAdmin } from '../lib/admin';

interface Props {
  userName: string;
  userEmail: string;
  sync: SyncState;
  onRefresh: () => void;
  onLogout: () => void;
}

const THEMES: { id: ThemeChoice; label: string; icon: ReactNode }[] = [
  { id: 'dark', label: 'Koyu', icon: <Moon className="w-4 h-4" /> },
  { id: 'light', label: 'Açık', icon: <Sun className="w-4 h-4" /> },
  { id: 'system', label: 'Cihaza göre', icon: <Monitor className="w-4 h-4" /> },
];

export default function Settings({ userName, userEmail, sync, onRefresh, onLogout }: Props) {
  const { settings, update, reset, resolvedTheme } = useSettings();

  return (
    <div className="max-w-[1000px]">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Ayarlar</h1>
        <p className="text-muted mt-1">Bu ayarlar yalnızca bu cihazda saklanır ve kendiliğinden kaydedilir. Diğer danışmanları etkilemez.</p>
      </div>

      <Row title="Görünüm" hint={`Şu an ${resolvedTheme === 'dark' ? 'koyu' : 'açık'} tema kullanılıyor. Sol paneldeki ay/güneş düğmesiyle de hızlıca değiştirilebilir.`}>
        <p className="text-sm font-medium mb-2">Tema</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={settings.theme === t.id}
              onClick={() => update({ theme: t.id })}
              className={`h-20 rounded-lg flex flex-col items-center justify-center gap-2 text-sm transition-colors ${
                settings.theme === t.id ? 'bg-active text-ink font-medium' : 'bg-ground text-muted hover:text-ink'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="s-view" className="block text-sm font-medium mb-2">Portföy açılış görünümü</label>
            <select id="s-view" value={settings.defaultView} onChange={(e) => update({ defaultView: e.target.value as 'list' | 'grid' })} className="field">
              <option value="list">Liste</option>
              <option value="grid">Galeri (fotoğraflı)</option>
            </select>
          </div>
        </div>
      </Row>

      <Row title="Hatırlatma" hint="Fiyatı ve durumu bu süreden uzun teyit edilmeyen aktif ilanlar sarıyla işaretlenir, zilde ve sol paneldeki hızlı filtrede görünür.">
        <label htmlFor="s-stale" className="block text-sm font-medium mb-2">Teyit süresi</label>
        <select id="s-stale" value={settings.staleDays} onChange={(e) => update({ staleDays: Number(e.target.value) })} className="field max-w-[240px]">
          {[15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} gün</option>)}
        </select>
      </Row>

      <Row title="Profil" hint="Telefon numaranız yeni ilan formunda ve müşteri taleplerinde hazır gelir.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium mb-2">Ad soyad</p>
            <p className="h-10 px-3 rounded-lg bg-raised flex items-center text-sm">{userName}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">E-posta</p>
            <p className="h-10 px-3 rounded-lg bg-raised flex items-center text-sm truncate">{userEmail}</p>
          </div>
          <div>
            <label htmlFor="s-phone" className="block text-sm font-medium mb-2">Telefonunuz</label>
            <input id="s-phone" type="tel" inputMode="tel" placeholder="0555 123 45 67" value={settings.phone} onChange={(e) => update({ phone: e.target.value })} className="field num" />
          </div>
        </div>
        <p className="text-xs text-faint">Ad ve e-posta ofis hesap listesinden gelir (src/config/auth.ts); değişiklik için ofis yöneticisine yazın.</p>
      </Row>

      <Row title="Müşteriye gönderilen metin" hint="“Müşteriye gönder” ve broşürün son satırı. Ada/parsel ve ofis içi bilgiler bu metne hiçbir zaman eklenmez.">
        <label htmlFor="s-sign" className="block text-sm font-medium mb-2">İmza satırı</label>
        <input id="s-sign" value={settings.shareSignature} onChange={(e) => update({ shareSignature: e.target.value })} className="field" />
      </Row>

      {!isAdmin(userEmail) ? (
        <Row title="Veriler" hint="İlanlar ve talepler birkaç dakikada bir kendiliğinden yenilenir.">
          <button onClick={onRefresh} className={btnSecondary}>Şimdi yenile</button>
        </Row>
      ) : (
      <Row title="Bağlantı" hint="İlanlar Google Sheets'ten Apps Script ile okunur ve yazılır. Bu bölümü yalnızca yöneticiler görür.">
        <dl className="text-sm">
          <Status label="İlan tablosu" ok={!sync.error} okText="Bağlı" badText="Okunamadı" />
          <Status label="Apps Script v2" ok={sync.v2Ready} okText="Yayında" badText="Eski sürüm. Talepler, geçmiş ve ofis içi bilgiler kapalı" />
          <div className="flex items-center justify-between h-9">
            <dt className="text-muted">Son eşitleme</dt>
            <dd className="num">{sync.loadedAt ? sync.loadedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</dd>
          </div>
        </dl>
        <button onClick={onRefresh} className={btnSecondary}>Şimdi eşitle</button>
      </Row>
      )}

      <Row title="Oturum" hint="Bu cihazdaki ayarları varsayılana döndürebilir veya oturumu kapatabilirsiniz.">
        <div className="flex flex-wrap gap-2">
          <button onClick={reset} className={btnSecondary}>Ayarları sıfırla</button>
          <button onClick={onLogout} className="h-9 px-4 rounded-full border border-negative text-negative text-sm hover:bg-negative-bg transition-colors">Oturumu kapat</button>
        </div>
      </Row>
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 lg:gap-10 py-8 border-t border-rule first-of-type:border-t-0 first-of-type:pt-0">
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted mt-1">{hint}</p>
      </div>
      <div className="bg-surface rounded-xl p-5 space-y-4">{children}</div>
    </section>
  );
}

function Status({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right flex items-center gap-1.5 ${ok ? 'text-positive' : 'text-warning'}`}>
        {ok && <Check className="w-4 h-4" />} {ok ? okText : badText}
      </dd>
    </div>
  );
}
