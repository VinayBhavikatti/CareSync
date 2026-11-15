import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import type { Role } from '../types';
import { ROLE_LABELS } from '../types';

const ROLES: Role[] = ['ELDER', 'CARETAKER', 'FAMILY'];

const ROLE_ICONS: Record<Role, string> = {
  ELDER: '👴',
  CARETAKER: '🧑‍⚕️',
  FAMILY: '👨‍👩‍👧',
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ELDER: 'Full access and control',
  CARETAKER: 'Add medicines & log doses',
  FAMILY: 'View updates only',
};

export function JoinPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [profileId, setProfileId] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Please select your role to continue.');
      return;
    }
    if (!profileId.trim()) {
      setError('Please enter your Profile ID.');
      return;
    }
    if (!passcode) {
      setError('Please enter your passcode.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(profileId.trim(), selectedRole, passcode);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-kindred-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-kindred-600 rounded-3xl mb-4 shadow-lg">
            <span className="text-4xl">❤️</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Kindred</h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 mt-2">
            Your family care companion
          </p>
        </div>

        {/* Login Card */}
        <div className="card shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>

            {/* Profile ID */}
            <Input
              label="Profile ID"
              hint="This was given to you when the profile was created."
              type="text"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="Paste your Profile ID here"
              autoComplete="off"
              spellCheck={false}
            />

            {/* Role selection */}
            <div className="flex flex-col gap-2">
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Who are you?
              </span>
              <div className="grid grid-cols-1 gap-3">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => { setSelectedRole(role); setError(''); }}
                    className={`
                      flex items-center gap-4 min-h-[64px] px-4 py-3 rounded-xl border-2 text-left
                      transition-all duration-150 font-medium text-lg
                      focus-visible:ring-4 focus-visible:ring-kindred-500 focus-visible:outline-none
                      ${selectedRole === role
                        ? 'border-kindred-600 bg-kindred-50 dark:bg-kindred-900/30 dark:border-kindred-400'
                        : 'border-gray-200 dark:border-gray-600 hover:border-kindred-300 dark:hover:border-kindred-600 bg-white dark:bg-gray-800'
                      }
                    `}
                    aria-pressed={selectedRole === role}
                  >
                    <span className="text-3xl">{ROLE_ICONS[role]}</span>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{ROLE_LABELS[role]}</div>
                      <div className="text-base text-gray-500 dark:text-gray-400">{ROLE_DESCRIPTIONS[role]}</div>
                    </div>
                    {selectedRole === role && (
                      <span className="ml-auto text-kindred-600 dark:text-kindred-400 text-2xl">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Passcode */}
            <Input
              label="Passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              autoComplete="current-password"
            />

            {/* Error */}
            {error && (
              <div className="error-box" role="alert" aria-live="polite">
                <strong>⚠️ </strong>{error}
              </div>
            )}

            {/* Submit */}
            <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
              Sign In
            </Button>
          </form>

          {/* Create profile link */}
          <div className="mt-6 text-center border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-lg text-gray-500 dark:text-gray-400">
              New to Kindred?{' '}
              <Link
                to="/create-profile"
                className="text-kindred-600 dark:text-kindred-400 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-kindred-500 rounded"
              >
                Create a care profile
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

