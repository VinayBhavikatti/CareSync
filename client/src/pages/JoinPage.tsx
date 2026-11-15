import { useState } from 'react';
import { BellRing, Check, ClipboardPaste, HandHeart, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { BrandMark } from '../components/BrandMark';
import { SymbolRain, type SymbolRainSymbolType } from '../components/SymbolRain';
import type { Role } from '../types';
import { ROLE_LABELS } from '../types';

const ROLES: Role[] = ['ELDER', 'CARETAKER', 'FAMILY'];
const LOGIN_RAIN_SYMBOLS: SymbolRainSymbolType[] = ['cross', 'capsule', 'heart'];
const ROLE_ICONS = { ELDER: UserRound, CARETAKER: HandHeart, FAMILY: UsersRound };
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ELDER: 'Lead care',
  CARETAKER: 'Support',
  FAMILY: 'Read-only',
};

export function JoinPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRole) { setError('Please choose your role to continue.'); return; }
    if (!profileId.trim()) { setError('Please enter your Profile ID.'); return; }
    if (!passcode) { setError('Please enter your passcode.'); return; }
    setError(''); setIsLoading(true);
    try { await login(profileId.trim(), selectedRole, passcode); navigate('/today'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign in did not work. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const handlePaste = async () => {
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted.trim()) setProfileId(pasted.trim());
    } catch {
      setError('Clipboard access is blocked. You can paste your Profile ID into the field.');
    }
  };

  return <main className="login-page min-h-screen" style={{ background: 'var(--page)' }}>
    <div className="login-layout mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
      <section className="login-form-side flex items-center justify-center px-4 py-6 sm:px-8 lg:px-10">
        <div className="w-full max-w-[420px]">
          <div className="login-mobile-brand symbol-rain-host mb-4 flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 lg:hidden">
            <SymbolRain intensity="calm" symbolTypes={LOGIN_RAIN_SYMBOLS} />
            <BrandMark size={46} className="text-caresync-700 dark:text-caresync-300" />
            <div><h1 className="text-2xl font-bold tracking-tight">CareSync</h1><p className="text-lg text-muted">Care, coordinated.</p></div>
          </div>

          <Card className="login-card p-5 sm:p-6">
            <header className="mb-4">
              <p className="text-lg font-semibold text-caresync-800 dark:text-caresync-200">Shared care, made simpler</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">Welcome back</h2>
              <p className="mt-1 text-lg text-muted">Sign in to your care profile.</p>
            </header>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div>
                <label htmlFor="profile-id" className="mb-2 block text-lg font-semibold">Profile ID</label>
                <div className="flex gap-2">
                  <input id="profile-id" className="input-field min-w-0 flex-1" type="text" value={profileId} onChange={(event) => setProfileId(event.target.value)} placeholder="Enter your Profile ID" autoComplete="off" spellCheck={false} aria-describedby="profile-id-hint" />
                  <Button type="button" variant="secondary" size="sm" className="shrink-0 px-3" onClick={() => void handlePaste()} aria-label="Paste Profile ID"><ClipboardPaste size={20} aria-hidden="true" /><span>Paste</span></Button>
                </div>
                <p id="profile-id-hint" className="mt-1 text-lg text-muted">Find this in your profile setup details.</p>
              </div>

              <fieldset>
                <legend className="mb-2 text-lg font-semibold">Choose your role</legend>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((role) => {
                    const Icon = ROLE_ICONS[role];
                    const selected = selectedRole === role;
                    return <button key={role} type="button" onClick={() => { setSelectedRole(role); setError(''); }} aria-pressed={selected} className={`login-role-tile relative flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-center transition-colors ${selected ? 'border-caresync-700 bg-caresync-50 dark:border-caresync-300 dark:bg-caresync-950' : 'border-token bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>
                      {selected && <Check size={18} className="absolute right-1 top-1 text-caresync-800 dark:text-caresync-200" aria-hidden="true" />}
                      <Icon size={22} className="text-caresync-800 dark:text-caresync-200" aria-hidden="true" />
                      <span className="block text-lg font-bold">{ROLE_LABELS[role]}</span>
                      <span className="block whitespace-nowrap text-lg text-muted">{ROLE_DESCRIPTIONS[role]}</span>
                    </button>;
                  })}
                </div>
              </fieldset>

              <Input label="Passcode" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder="Enter your passcode" autoComplete="current-password" />
              {error && <div className="login-inline-error" role="alert" aria-live="polite">{error}</div>}
              <Button type="submit" fullWidth size="md" isLoading={isLoading}>Sign in</Button>
            </form>
            <div className="mt-4 border-t border-token pt-3 text-center">
              <p className="text-lg text-muted">Setting up a new care profile?</p>
              <Link to="/create-profile" className="inline-flex min-h-12 items-center font-semibold text-caresync-800 underline-offset-4 hover:underline dark:text-caresync-200">Create a care profile</Link>
            </div>
          </Card>
        </div>
      </section>

      <aside className="login-illustration symbol-rain-host relative hidden min-h-screen flex-col justify-center overflow-hidden px-10 py-12 lg:flex">
        <SymbolRain intensity="normal" symbolTypes={LOGIN_RAIN_SYMBOLS} />
        <div className="login-illustration-content mx-auto w-full max-w-lg">
          <div className="flex items-center gap-4">
            <BrandMark size={58} className="text-caresync-700 dark:text-caresync-300" />
            <div><h1 className="text-4xl font-bold tracking-tight">CareSync</h1><p className="mt-1 text-xl text-muted">Care, coordinated around you.</p></div>
          </div>
          <div className="mt-14 space-y-6">
            <div className="login-benefit"><span><BellRing size={24} aria-hidden="true" /></span><p>Never miss a dose</p></div>
            <div className="login-benefit"><span><UsersRound size={24} aria-hidden="true" /></span><p>Family stays informed</p></div>
            <div className="login-benefit"><span><ShieldCheck size={24} aria-hidden="true" /></span><p>Elders stay in control</p></div>
          </div>
          <svg className="login-illustration-mark mt-16 w-full" viewBox="0 0 420 140" aria-hidden="true">
            <path d="M10 112h77l20-31 24 43 26-69 20 42h64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".45" />
            <path d="M264 96c-13-12-28 4 0 21 28-17 13-33 0-21Z" fill="currentColor" opacity=".55" />
            <path d="M314 60h22v22h-22zM325 49v44M303 71h44" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".35" />
            <rect x="365" y="44" width="43" height="20" rx="10" fill="none" stroke="currentColor" strokeWidth="3" opacity=".4" transform="rotate(-26 365 44)" />
          </svg>
        </div>
      </aside>
    </div>
  </main>;
}
