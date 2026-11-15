import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './RoleBadge';
import { Button } from './Button';

export function Navbar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const navItems = [
    { to: '/today', label: '💊 Today' },
    { to: '/medicines', label: '📋 Medicines' },
    { to: '/appointments', label: '📅 Appointments' },
    { to: '/emails', label: '✉️ Emails' },
    { to: '/activity', label: '📜 Activity Log' },
  ];

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 mb-2 md:mb-0">
          {/* Logo & Care Details */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-kindred-600 text-white rounded-2xl shadow-sm">
              <span className="text-2xl" aria-hidden="true">❤️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">Kindred</span>
                <RoleBadge role={user.role} />
              </div>
              <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5">
                Care for <strong className="text-gray-700 dark:text-gray-200">{user.elderName}</strong>
              </p>
            </div>
          </div>

          {/* User Signout */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              aria-label="Sign out of Kindred"
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Accessible Navigation tabs */}
        <nav className="flex items-center gap-2 mt-3 overflow-x-auto pb-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                px-5 py-3 rounded-xl font-bold text-lg whitespace-nowrap min-h-[48px] flex items-center justify-center transition-colors
                ${isActive
                  ? 'bg-kindred-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

