import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { OFFICE_AUTH_CONFIG } from '../config/auth';
import { useSettings } from '../lib/settings';

interface LoginProps {
  onLoginSuccess: (email: string, password: string, remember: boolean) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const { resolvedTheme, update } = useSettings();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const isUserAllowed = OFFICE_AUTH_CONFIG.allowedUsers.some((u) => u.email.toLowerCase() === cleanEmail);

    if (!isUserAllowed) {
      setError('Bu e-posta yetkili danışman listesinde yok. Ofis yöneticisine yazın.');
      return;
    }
    if (password !== OFFICE_AUTH_CONFIG.defaultPassword) {
      setError('Şifre hatalı.');
      return;
    }
    onLoginSuccess(cleanEmail, password, remember);
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

        <h1 className="text-xl font-semibold">Danışman girişi</h1>
        <p className="text-muted mt-1 mb-8">Ofis e-postanız ve ofis şifresiyle girin.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">E-posta</label>
            <input id="email" type="email" autoComplete="username" required placeholder="ornek@palmiyeyatirim.com" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="password" className="text-sm font-medium">Ofis şifresi</label>
              <button type="button" onClick={() => setShowForgot((v) => !v)} className="text-sm text-muted hover:text-ink underline underline-offset-2">
                Şifremi unuttum
              </button>
            </div>
            <div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field pr-12" />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                className="absolute right-0 top-0 h-10 w-11 flex items-center justify-center text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {showForgot && <p className="mt-2 text-sm text-muted">Ofis şifresini ofis yöneticisinden isteyin. Yeni danışman hesabı da yönetici tarafından açılır.</p>}
          </div>

          <label className="flex items-center gap-3 min-h-11 text-sm cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            Bu cihazda oturumum açık kalsın
          </label>

          {error && <p role="alert" className="text-sm text-negative">{error}</p>}

          <button type="submit" className="w-full h-11 rounded-full bg-ink text-ground font-semibold flex items-center justify-center gap-2 hover:bg-muted transition-colors">
            Panele gir
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-xs text-faint mt-10">Yalnızca Palmiye Yatırım danışmanları içindir. Ortak bilgisayarda “oturumum açık kalsın” seçimini kaldırın.</p>
      </main>
    </div>
  );
}
