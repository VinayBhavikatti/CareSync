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
import { SummaryPage } from './pages/SummaryPage';
import { PreferencesPage } from './pages/PreferencesPage';
import { Navbar } from './components/Navbar';
import { DemoClockControl } from './components/DemoClockControl';
import { BrandMark } from './components/BrandMark';

const InsightsPage = React.lazy(() => import('./pages/InsightsPage').then((module) => ({ default: module.InsightsPage })));

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
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <div className="app-main-column lg:ml-72">
        <DemoClockControl />
        <main id="main-content" tabIndex={-1} className="page-content">{children}</main>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page)' }}>
    <div className="text-center"><BrandMark size={56} className="mx-auto mb-4 text-caresync-700 dark:text-caresync-300" /><p className="text-xl text-muted">Loading CareSync...</p></div>
  </div>;
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
      <Route path="/insights" element={<PrivateLayout><React.Suspense fallback={<LoadingScreen />}><InsightsPage /></React.Suspense></PrivateLayout>} />
      <Route path="/summary" element={<PrivateLayout><SummaryPage /></PrivateLayout>} />
      <Route path="/preferences" element={<PrivateLayout><PreferencesPage /></PrivateLayout>} />
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
  // Light is the default; respect an explicit saved theme preference.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', localStorage.getItem('caresync_theme') === 'dark');
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

