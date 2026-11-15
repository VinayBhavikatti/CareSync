import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Activity, CalendarDays, ChartNoAxesCombined, ChevronDown, FileText, HeartPulse, Mail, Moon, MoreHorizontal, Settings, Sun, Tablets, LogOut, House } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './RoleBadge';
import { Button } from './Button';
import { BrandMark } from './BrandMark';

const items = [
  { to: '/today', label: 'Today', Icon: House },
  { to: '/medicines', label: 'Medicines', Icon: Tablets },
  { to: '/appointments', label: 'Appointments', Icon: CalendarDays },
  { to: '/insights', label: 'Insights', Icon: ChartNoAxesCombined },
  { to: '/summary', label: 'Care summary', Icon: FileText },
  { to: '/emails', label: 'Email log', Icon: Mail },
  { to: '/activity', label: 'Activity', Icon: Activity },
  { to: '/preferences', label: 'Preferences', Icon: Settings },
];

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('caresync_theme') === 'dark');
  const toggle = () => setDark((current) => {
    const next = !current;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('caresync_theme', next ? 'dark' : 'light');
    return next;
  });
  return { dark, toggle };
}

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { dark, toggle } = useTheme();
  if (!user) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-lg font-semibold transition-colors ${isActive ? 'bg-caresync-50 text-caresync-900 ring-1 ring-caresync-200 dark:bg-caresync-900/40 dark:text-caresync-100 dark:ring-caresync-700' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`;
  const mobileLinkClass = ({ isActive }: { isActive: boolean }) => `flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-lg font-semibold ${isActive ? 'text-caresync-800 dark:text-caresync-200' : 'text-muted'}`;
  const extraItems = items.slice(2);
  const isExtraActive = extraItems.some((item) => item.to === location.pathname);

  return <>
    <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-72 flex-col px-4 py-6 lg:flex">
      <Link to="/today" className="mb-8 flex items-center gap-3 rounded-xl p-2 text-current no-underline">
        <BrandMark className="text-caresync-700 dark:text-caresync-400" />
        <span><span className="block text-2xl font-bold tracking-tight">CareSync</span><span className="block text-base text-muted">Shared care workspace</span></span>
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Main navigation">
        {items.map(({ to, label, Icon }) => <NavLink key={to} to={to} className={linkClass}>
          <Icon size={22} strokeWidth={2} aria-hidden="true" /><span>{label}</span>
        </NavLink>)}
      </nav>
      <div className="mt-auto rounded-xl border border-token p-4 text-base text-muted">
        <HeartPulse className="mb-2 text-caresync-700 dark:text-caresync-300" size={22} aria-hidden="true" />
        A shared record for everyone supporting {user.elderName}.
      </div>
    </aside>
    <div className="app-topbar sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:ml-72 lg:px-10">
      <div className="min-w-0">
        <p className="truncate text-base text-muted">Care profile</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-xl font-bold">{user.elderName}</span>
          <RoleBadge role={user.role} className="min-h-8 px-3 py-1 text-base" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} aria-pressed={dark}>
          {dark ? <Sun size={22} aria-hidden="true" /> : <Moon size={22} aria-hidden="true" />}<span className="hidden sm:inline">{dark ? 'Light theme' : 'Dark theme'}</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={logout} aria-label="Sign out">
          <LogOut size={20} aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </div>
    <nav className="mobile-tabs fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t px-2 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))] lg:hidden" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }} aria-label="Mobile navigation">
      {items.slice(0, 2).map(({ to, label, Icon }) => <NavLink key={to} to={to} className={mobileLinkClass}>
        <Icon size={22} aria-hidden="true" /><span>{label}</span>
      </NavLink>)}
      <button type="button" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((open) => !open)} className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-lg font-semibold ${isExtraActive ? 'text-caresync-800 dark:text-caresync-200' : 'text-muted'}`}>
        {moreOpen ? <ChevronDown size={22} aria-hidden="true" /> : <MoreHorizontal size={22} aria-hidden="true" />}<span>More</span>
      </button>
    </nav>
    {moreOpen && <div id="mobile-more-menu" className="fixed inset-x-3 bottom-20 z-40 grid grid-cols-2 gap-2 rounded-2xl border p-3 shadow-xl lg:hidden" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
      {extraItems.map(({ to, label, Icon }) => <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className={linkClass}>
        <Icon size={21} aria-hidden="true" /><span>{label}</span>
      </NavLink>)}
    </div>}
  </>;
}
