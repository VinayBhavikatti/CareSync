import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { JoinPage } from './pages/JoinPage';
import { CreateProfilePage } from './pages/CreateProfilePage';
import { TodayPage } from './pages/TodayPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { EmailLogPage } from './pages/EmailLogPage';
import { Navbar } from './components/Navbar';
import { DemoClockControl } from './components/DemoClockControl';

/** Redirect to /today if already logged in, otherwise show the public page */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/today" replace />;
  return <>{children}</>;
}

/** Require authentication and render layout with persistent Navbar */
function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <DemoClockControl />
      <Navbar />
      <main className="flex-1 pb-16">{children}</main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-kindred-600 rounded-3xl mb-4 animate-pulse">
          <span className="text-4xl">❤️</span>
        </div>
        <p className="text-xl text-gray-500 dark:text-gray-400">Loading Kindred…</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <JoinPage />
          </PublicRoute>
        }
      />
      <Route
        path="/create-profile"
        element={
          <PublicRoute>
            <CreateProfilePage />
          </PublicRoute>
        }
      />

      {/* Authenticated routes with navigation bar */}
      <Route
        path="/today"
        element={
          <PrivateLayout>
            <TodayPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/dashboard"
        element={<Navigate to="/today" replace />}
      />
      <Route
        path="/medicines"
        element={
          <PrivateLayout>
            <MedicinesPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/appointments"
        element={
          <PrivateLayout>
            <AppointmentsPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/emails"
        element={
          <PrivateLayout>
            <EmailLogPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/activity"
        element={
          <PrivateLayout>
            <AuditLogPage />
          </PrivateLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Sync dark mode with system preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) =>
      document.documentElement.classList.toggle('dark', dark);
    apply(mq.matches);
    mq.addEventListener('change', (e) => apply(e.matches));
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

