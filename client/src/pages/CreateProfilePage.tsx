import { useState } from 'react';
import { Check, Copy, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { BrandMark } from '../components/BrandMark';
import { Card } from '../components/Card';
import { authApi } from '../api/auth';

export function CreateProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', elderPasscode: '', caretakerPasscode: '', familyPasscode: '', elderEmail: '', caretakerEmail: '', familyEmail: '' });
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!form.name.trim()) { setError('Please enter the elder’s name.'); return; }
    if (!form.elderPasscode || !form.caretakerPasscode || !form.familyPasscode) { setError('Set a passcode for the elder, caretaker, and family.'); return; }
    setIsLoading(true);
    try { const result = await authApi.createProfile(form); setCreatedId(result.profileId); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create the profile. Please try again.'); }
    finally { setIsLoading(false); }
  };
  const copyId = async () => { await navigator.clipboard.writeText(createdId); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };

  return <main className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: 'var(--page)' }}>
    <div className="w-full max-w-2xl">
      <div className="mb-6 flex flex-col items-center text-center"><BrandMark size={56} className="mb-3 text-caresync-700 dark:text-caresync-400" /><h1 className="text-3xl font-bold">CareSync</h1><p className="mt-1 text-lg text-muted">Create a shared care profile</p></div>
      {createdId ? <Card className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><Check size={30} aria-hidden="true" /></div>
        <h2 className="text-3xl font-bold">Profile created</h2>
        <p className="mt-2 text-lg text-muted">Save this Profile ID. Everyone in the care profile will need it to sign in.</p>
        <div className="mt-5 break-all rounded-xl surface-subtle p-4 text-left font-mono text-lg">{createdId}</div>
        <Button variant="secondary" fullWidth className="mt-4" onClick={() => void copyId()}>{copied ? <><Check size={20} aria-hidden="true" /> Copied</> : <><Copy size={20} aria-hidden="true" /> Copy Profile ID</>}</Button>
        <Button fullWidth className="mt-3" onClick={() => navigate('/')}>Go to sign in</Button>
      </Card> : <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div><h2 className="flex items-center gap-2 text-2xl font-bold"><UsersRound aria-hidden="true" /> About the elder</h2><p className="mt-1 text-lg text-muted">The elder remains at the centre of this profile.</p></div>
          <Input label="Elder’s full name" type="text" value={form.name} onChange={update('name')} placeholder="e.g. Ramesh Kumar" autoComplete="name" />
          <hr className="border-token" />
          <div><h2 className="text-2xl font-bold">Set passcodes</h2><p className="mt-1 text-lg text-muted">Share each passcode only with the right person. Use at least 4 characters.</p></div>
          <Input label="Elder passcode" hint="For the elder" type="password" value={form.elderPasscode} onChange={update('elderPasscode')} placeholder="Minimum 4 characters" autoComplete="new-password" />
          <Input label="Caretaker passcode" hint="For nurses or home helpers" type="password" value={form.caretakerPasscode} onChange={update('caretakerPasscode')} placeholder="Minimum 4 characters" autoComplete="new-password" />
          <Input label="Family passcode" hint="For family members (view only)" type="password" value={form.familyPasscode} onChange={update('familyPasscode')} placeholder="Minimum 4 characters" autoComplete="new-password" />
          <hr className="border-token" />
          <div><h2 className="text-2xl font-bold">Email addresses <span className="text-lg font-normal text-muted">(optional)</span></h2><p className="mt-1 text-lg text-muted">Used for medicine and appointment reminders.</p></div>
          <Input label="Elder’s email" type="email" value={form.elderEmail} onChange={update('elderEmail')} placeholder="elder@example.com" autoComplete="email" />
          <Input label="Caretaker’s email" type="email" value={form.caretakerEmail} onChange={update('caretakerEmail')} placeholder="caretaker@example.com" autoComplete="email" />
          <Input label="Family email" type="email" value={form.familyEmail} onChange={update('familyEmail')} placeholder="family@example.com" autoComplete="email" />
          {error && <div className="error-box" role="alert" aria-live="polite">{error}</div>}
          <Button type="submit" fullWidth size="lg" isLoading={isLoading}>Create profile</Button>
          <p className="text-center text-lg text-muted">Already have a profile? <Link to="/" className="font-semibold text-caresync-900 underline-offset-4 hover:underline dark:text-caresync-100">Sign in</Link></p>
        </form>
      </Card>}
    </div>
  </main>;
}
