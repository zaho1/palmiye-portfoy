import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { OFFICE_AUTH_CONFIG } from '../config/auth';
import { fetchApiInfo, serverActivate, serverLogin, type ApiInfo, type LoginResult, type SessionUser } from '../lib/sheets';
import { useSettings } from '../lib/settings';

export interface LoginSession {
  email: string;
  // server: oturum jetonu, legacy: eski ortak ofis şifresi
  key: string;
  mode: 'server' | 'legacy';
  user?: SessionUser;
}

interface LoginProps {
  onLoginSuccess: (session: LoginSession, remember: boolean) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [password2, setPassword2] = useState('');
  const [first, setFirst] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [info, setInfo] = useState<ApiInfo | null | undefined>(undefined);
  const { resolvedTheme, update } = useSettings();
  const [notice] = useState(() => {
    try {
      const n = sessionStorage.getItem('palmiye_notice');
      sessionStorage.removeItem('palmiye_notice');
      return n ?? '';
    } catch {
      return '';
    }
  });

  // Sunucuda kişisel hesaplar açıksa onlarla, değilse eski ortak şifreyle girilir
  useEffect(() => {
    let alive = true;
    fetchApiInfo().then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);
  const server = !!info?.accounts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('E-posta adresinizi yazın.');
      return;
    }

    if (!server) {
      const isUserAllowed = OFFICE_AUTH_CONFIG.allowedUsers.some((u) => u.email.toLowerCase() === cleanEmail);
      if (!isUserAllowed) {
        setError('Bu e-posta yetkili danışman listesinde yok. Ofis yöneticisine yazın.');
        return;
      }
      if (password !== OFFICE_AUTH_CONFIG.defaultPassword) {
        setError('Şifre hatalı.');
        return;
      }
      onLoginSuccess({ email: cleanEmail, key: password, mode: 'legacy' }, remember);
      return;
    }

    if (first) {
      if (!invite.trim()) return setError('Size verilen davet kodunu yazın.');
      if (password.length < 8) return setError('Şifreniz en az 8 karakter olmalı.');
      if (password !== password2) return setError('İki şifre aynı değil.');
    } else if (!password) {
      return setError('Şifrenizi yazın.');
    }

    setBusy(true);
    try {
      const res: LoginResult = first ? await serverActivate(cleanEmail, invite.trim(), password) : await serverLogin(cleanEmail, password);
      if (!res.success || !res.token) {
        setError(res.message || 'Giriş yapılamadı.');
        return;
      }
      onLoginSuccess({ email: cleanEmail, key: res.token, mode: 'server', user: res.user }, remember);
    } catch {
      setError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-ground px-6 py-12 flex items-center justify-center">
      <button
        onClick={() => update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
        aria-label={resolvedTheme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
        className="absolute right-4 top-4 w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface"
      >
        {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <main className="w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center mb-10">
          <img src="/logo.png" alt="Palmiye Yatırım" className="h-16 w-auto logo-chip" />
          <p className="mt-4 text-base font-semibold">Palmiye Yatırım</p>
          <p className="text-sm text-muted">Yalova · ofis portföy paneli</p>
        </div>

        <h1 className="text-xl font-semibold">{first ? 'İlk giriş' : 'Danışman girişi'}</h1>
        <p className="text-muted mt-1 mb-8">
          {first
            ? 'Size verilen davet kodunu yazın ve kendi şifrenizi belirleyin.'
            : server
              ? 'Ofis e-postanız ve kendi şifrenizle girin.'
              : 'Ofis e-postanız ve ofis şifresiyle girin.'}
        </p>

        {notice && <p role="status" className="mb-4 rounded-xl bg-warning-bg text-warning px-4 py-3 text-sm">{notice}</p>}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">E-posta</label>
            <input id="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="username" required placeholder="ornek@palmiyeyatirim.com" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          </div>

          {first && (
            <div>
              <label htmlFor="invite" className="block text-sm font-medium mb-2">Davet kodu</label>
              <input id="invite" autoCapitalize="characters" autoComplete="one-time-code" placeholder="6 harfli kod" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} className="field tracking-widest" />
            </div>
          )}

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="password" className="text-sm font-medium">{first ? 'Yeni şifreniz' : server ? 'Şifre' : 'Ofis şifresi'}</label>
              {!first && (
                <button type="button" onClick={() => setShowForgot((v) => !v)} className="text-sm text-muted hover:text-ink underline underline-offset-2">
                  Şifremi unuttum
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={first ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                className="absolute right-0 top-0 h-10 w-11 flex items-center justify-center text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {first && <p className="mt-2 text-sm text-muted">En az 8 karakter. Bunu yalnızca siz bileceksiniz.</p>}
            {showForgot && !first && (
              <p className="mt-2 text-sm text-muted">
                {server ? 'Şifrenizi yöneticiye bildirin; size yeni bir davet kodu verir, "İlk giriş" ile yeni şifre belirlersiniz.' : 'Ofis şifresini ofis yöneticisinden isteyin. Yeni danışman hesabı da yönetici tarafından açılır.'}
              </p>
            )}
          </div>

          {first && (
            <div>
              <label htmlFor="password2" className="block text-sm font-medium mb-2">Şifre (tekrar)</label>
              <input id="password2" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} className="field" />
            </div>
          )}

          <label className="flex items-center gap-3 min-h-11 text-sm cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            Bu cihazda oturumum açık kalsın
          </label>

          {error && <p role="alert" className="text-sm text-negative">{error}</p>}

          <button type="submit" disabled={busy || info === undefined} className="w-full h-11 rounded-full bg-ink text-ground font-semibold flex items-center justify-center gap-2 hover:bg-muted transition-colors disabled:opacity-60">
            {busy ? 'Giriş yapılıyor…' : first ? 'Hesabımı etkinleştir' : 'Panele gir'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {server && (
          <button
            type="button"
            onClick={() => {
              setFirst((v) => !v);
              setError('');
              setPassword('');
              setPassword2('');
            }}
            className="mt-4 w-full min-h-11 text-sm text-muted hover:text-ink underline underline-offset-2"
          >
            {first ? 'Hesabım etkin, şifremle gireceğim' : 'İlk kez mi giriyorsunuz? Davet kodunu kullanın'}
          </button>
        )}

        <p className="text-xs text-faint mt-10">Yalnızca Palmiye Yatırım danışmanları içindir. Ortak bilgisayarda “oturumum açık kalsın” seçimini kaldırın.</p>
      </main>
    </div>
  );
}
