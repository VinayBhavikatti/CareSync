import { useEffect, useState } from 'react';

const STORAGE_KEY = 'caresync_reduce_animations';
const CHANGE_EVENT = 'caresync-animation-preference-changed';

export function getReduceAnimationsPreference(): boolean {
  try { return window.localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
}

export function setReduceAnimationsPreference(reduce: boolean) {
  try { window.localStorage.setItem(STORAGE_KEY, String(reduce)); }
  catch { /* The in-memory event still updates this tab if storage is unavailable. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useReduceAnimationsPreference() {
  const [reduce, setReduce] = useState(getReduceAnimationsPreference);
  useEffect(() => {
    const refresh = () => setReduce(getReduceAnimationsPreference());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(CHANGE_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  return reduce;
}

export function useSystemReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const refresh = () => setReduce(query.matches);
    query.addEventListener?.('change', refresh);
    return () => query.removeEventListener?.('change', refresh);
  }, []);
  return reduce;
}
