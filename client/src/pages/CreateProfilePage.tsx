import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { authApi } from '../api/auth';

export function CreateProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    elderPasscode: '',
    caretakerPasscode: '',
    familyPasscode: '',
    elderEmail: '',
    caretakerEmail: '',
    familyEmail: '',
  });
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) { setError('Please enter the elder\'s name.'); return; }
    if (!form.elderPasscode) { setError('Please set a passcode for the elder.'); return; }
    if (!form.caretakerPasscode) { setError('Please set a passcode for the caretaker.'); return; }
    if (!form.familyPasscode) { setError('Please set a passcode for family members.'); return; }

    setIsLoading(true);
    try {
      const result = await authApi.createProfile(form);
      setCreatedId(result.profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyId = async () => {
    await navigator.clipboard.writeText(createdId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-kindred-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="card shadow-lg text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Profile Created!</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
              Save this Profile ID — everyone will need it to sign in.
            </p>

            <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 mb-4 font-mono text-lg break-all text-left">
              {createdId}
            </div>

            <Button
              variant="secondary"
              fullWidth
              onClick={copyId}
              className="mb-4"
            >
              {copied ? '✓ Copied!' : '📋 Copy Profile ID'}
            </Button>

            <Button fullWidth onClick={() => navigate('/')}>
              Go to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-kindred-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-start justify-center p-4 py-8">
      <div className="w-full max-w-lg">

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-kindred-600 rounded-2xl mb-3 shadow-lg">
            <span className="text-3xl">❤️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Kindred</h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">Create a care profile</p>
        </div>

        <div className="card shadow-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">About the elder</h2>
              <p className="text-base text-gray-500 dark:text-gray-400">The elder is at the centre of this profile.</p>
            </div>

            <Input
              label="Elder's Full Name"
              type="text"
              value={form.name}
              onChange={update('name')}
              placeholder="e.g. Ramesh Kumar"
              autoComplete="name"
            />

            <hr className="border-gray-200 dark:border-gray-700" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Set Passcodes</h2>
              <p className="text-base text-gray-500 dark:text-gray-400">Share each passcode only with the right person. Use at least 4 characters.</p>
            </div>

            <Input
              label="👴 Elder Passcode"
              hint="Only for the elder"
              type="password"
              value={form.elderPasscode}
              onChange={update('elderPasscode')}
              placeholder="Minimum 4 characters"
              autoComplete="new-password"
            />

            <Input
              label="🧑‍⚕️ Caretaker Passcode"
              hint="For nurses or home helpers"
              type="password"
              value={form.caretakerPasscode}
              onChange={update('caretakerPasscode')}
              placeholder="Minimum 4 characters"
              autoComplete="new-password"
            />

            <Input
              label="👨‍👩‍👧 Family Passcode"
              hint="For family members (view only)"
              type="password"
              value={form.familyPasscode}
              onChange={update('familyPasscode')}
              placeholder="Minimum 4 characters"
              autoComplete="new-password"
            />

            <hr className="border-gray-200 dark:border-gray-700" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Email Addresses <span className="text-base font-normal text-gray-400">(optional)</span></h2>
              <p className="text-base text-gray-500 dark:text-gray-400">Used for medication and appointment reminders.</p>
            </div>

            <Input label="Elder's Email" type="email" value={form.elderEmail} onChange={update('elderEmail')} placeholder="elder@example.com" autoComplete="email" />
            <Input label="Caretaker's Email" type="email" value={form.caretakerEmail} onChange={update('caretakerEmail')} placeholder="caretaker@example.com" autoComplete="email" />
            <Input label="Family Email" type="email" value={form.familyEmail} onChange={update('familyEmail')} placeholder="family@example.com" autoComplete="email" />

            {error && (
              <div className="error-box" role="alert" aria-live="polite">
                <strong>⚠️ </strong>{error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
              Create Profile
            </Button>

            <div className="text-center">
              <Link to="/" className="text-kindred-600 dark:text-kindred-400 text-lg font-semibold hover:underline">
                ← Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

