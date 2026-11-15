import { useCallback, useEffect, useState } from 'react';
import { Languages, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileApi, type ReminderLanguage } from '../api/profile';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { CardSkeleton } from '../components/Skeleton';
import { getReduceAnimationsPreference, setReduceAnimationsPreference } from '../utils/animationPreferences';

export function PreferencesPage() {
  const { user } = useAuth();
  const [language, setLanguage] = useState<ReminderLanguage>('ENGLISH');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reduceAnimations, setReduceAnimations] = useState(getReduceAnimationsPreference);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try { setLanguage((await profileApi.getLanguage(user.token)).language); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load preferences.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!user) return;
    setSaving(true); setError(''); setMessage('');
    try { await profileApi.setLanguage(user.token, language); setMessage('Reminder language saved.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the language.'); }
    finally { setSaving(false); }
  };

  return <div className="flex flex-col gap-6">
    <PageHeader title="Preferences" description="Choose how reminder messages appear for this care profile." />
    {error && <div className="error-box flex flex-wrap items-center justify-between gap-3" role="alert"><span>{error}</span><Button variant="secondary" onClick={() => void load()}>Try again</Button></div>}
    {loading ? <div role="status" aria-label="Loading preferences"><CardSkeleton lines={2} /></div> : <Card>
      <h2 className="flex items-center gap-3 text-2xl font-bold"><Languages className="text-caresync-800 dark:text-caresync-200" aria-hidden="true" /> Reminder language</h2>
      <p className="mt-2 text-lg leading-relaxed text-muted">Reminder emails use reviewed message templates. English is used if a translation is unavailable.</p>
      <label htmlFor="reminder-language" className="mt-5 block text-lg font-semibold">Choose a language</label>
      <select id="reminder-language" className="input-field mt-2" value={language} onChange={(event) => setLanguage(event.target.value as ReminderLanguage)}>
        <option value="ENGLISH">English</option><option value="HINDI">Hindi (native review needed)</option><option value="KANNADA">Kannada (native review needed)</option>
      </select>
      {user?.role === 'ELDER' ? <Button className="mt-5" onClick={() => void save()} isLoading={saving} disabled={loading}><Save size={20} aria-hidden="true" /> Save language</Button> : <p className="mt-5 rounded-xl surface-subtle p-4 text-lg">Only the elder can change this profile setting.</p>}
      {message && <p role="status" className="success-box mt-4">{message}</p>}
    </Card>}
    <Card>
      <h2 className="text-2xl font-bold">Motion and animation</h2>
      <p className="mt-2 text-lg leading-relaxed text-muted">Turn off the decorative falling healthcare symbols on this device. Your system’s reduced-motion setting is also respected.</p>
      <label htmlFor="reduce-animations" className="mt-4 flex min-h-12 cursor-pointer items-center gap-4 text-lg font-semibold">
        <input id="reduce-animations" type="checkbox" checked={reduceAnimations} onChange={(event) => { setReduceAnimations(event.target.checked); setReduceAnimationsPreference(event.target.checked); }} className="h-6 w-6 accent-caresync-700" />
        Reduce animations
      </label>
    </Card>
  </div>;
}
