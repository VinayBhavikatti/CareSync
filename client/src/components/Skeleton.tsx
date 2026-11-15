export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return <div className="card" aria-hidden="true">
    <Skeleton className="mb-5 h-7 w-2/5" />
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={`mb-3 h-5 ${index === lines - 1 ? 'w-3/5' : 'w-full'}`} />)}
  </div>;
}
