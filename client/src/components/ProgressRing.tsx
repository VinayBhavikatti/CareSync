import { useEffect, useState } from 'react';

export function ProgressRing({ value, label, size = 112 }: { value: number; label: string; size?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const progress = Math.max(0, Math.min(100, value));
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  return <svg role="img" aria-label={`${label}: ${Math.round(progress)}%`} width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
    <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--line)" strokeWidth="9" />
    <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={ready ? circumference * (1 - progress / 100) : circumference} className="progress-ring-value" transform="rotate(-90 50 50)" />
    <text x="50" y="48" textAnchor="middle" className="fill-current" fontSize="21" fontWeight="700">{Math.round(progress)}%</text>
    <text x="50" y="66" textAnchor="middle" className="fill-current" fontSize="17">{label}</text>
  </svg>;
}
