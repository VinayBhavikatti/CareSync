export function BrandMark({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="46" height="46" rx="15" fill="currentColor" />
      <path d="M24 34s-11-6.6-11-14a6.4 6.4 0 0 1 11-4.4A6.4 6.4 0 0 1 35 20c0 7.4-11 14-11 14Z" stroke="white" strokeWidth="2.7" strokeLinejoin="round" />
      <path d="M31 11.8h5v5M35.7 16a12.7 12.7 0 0 0-20.1.9M17 36.2h-5v-5M12.3 32a12.7 12.7 0 0 0 20.1-.9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
