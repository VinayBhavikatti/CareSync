import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { RoleBadge } from '../components/RoleBadge';
import { Card } from '../components/Card';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const greeting = getGreeting();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-kindred-600 rounded-2xl">
              <span className="text-2xl">❤️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Kindred</h1>
              <p className="text-base text-gray-500 dark:text-gray-400 leading-tight">Care for {user.elderName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RoleBadge role={user.role} />
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Greeting */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {greeting}, {user.role === 'ELDER' ? user.elderName.split(' ')[0] : 'there'} 👋
          </h2>
          <p className="text-xl text-gray-500 dark:text-gray-400 mt-1">
            {user.role === 'ELDER'
              ? 'Here is your health overview for today.'
              : user.role === 'CARETAKER'
              ? `You are viewing ${user.elderName}'s care profile.`
              : `You are viewing ${user.elderName}'s health updates.`}
          </p>
        </div>

        {/* Phase placeholder cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            title="💊 Medications"
            subtitle="Today's schedule"
            className="cursor-not-allowed opacity-70"
          >
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Medication management coming in Phase 2.
            </p>
          </Card>

          <Card
            title="📅 Appointments"
            subtitle="Upcoming visits"
            className="cursor-not-allowed opacity-70"
          >
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Appointment management coming in Phase 2.
            </p>
          </Card>

          <Card
            title="📊 Insights"
            subtitle="Adherence & refills"
            className="cursor-not-allowed opacity-70"
          >
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Adherence insights coming in Phase 3.
            </p>
          </Card>

          <Card
            title="📋 Audit Log"
            subtitle="Who changed what"
            className="cursor-not-allowed opacity-70"
          >
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Audit log coming in Phase 3.
            </p>
          </Card>
        </div>

        {/* Profile info */}
        <Card title="Your Profile" className="bg-kindred-50 dark:bg-kindred-900/20 border-kindred-200 dark:border-kindred-800">
          <dl className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <dt className="text-lg text-gray-600 dark:text-gray-400">Elder's Name</dt>
              <dd className="text-lg font-semibold text-gray-900 dark:text-white">{user.elderName}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-lg text-gray-600 dark:text-gray-400">Your Role</dt>
              <dd><RoleBadge role={user.role} /></dd>
            </div>
            <div className="flex justify-between items-start gap-4">
              <dt className="text-lg text-gray-600 dark:text-gray-400 shrink-0">Profile ID</dt>
              <dd className="text-base font-mono text-gray-700 dark:text-gray-300 break-all text-right">{user.profileId}</dd>
            </div>
          </dl>
        </Card>

      </main>
    </div>
  );
}

