import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useReduceAnimationsPreference, useSystemReducedMotion } from '../utils/animationPreferences';

export type SymbolRainSymbolType = 'cross' | 'capsule' | 'tablet' | 'heart' | 'pulse' | 'droplet';
type SymbolRainProps = { intensity?: 'calm' | 'normal'; symbolTypes?: readonly SymbolRainSymbolType[] };
type RainSymbol = { type: SymbolRainSymbolType; x: number; y: number; size: number; duration: number; delay: number; opacity: number; rotation: number; sway: number };

const SYMBOL_TYPES: SymbolRainSymbolType[] = ['cross', 'capsule', 'tablet', 'heart', 'pulse', 'droplet'];

function SymbolShape({ type }: { type: SymbolRainSymbolType }) {
  if (type === 'cross') return <svg viewBox="0 0 32 32" fill="currentColor"><path d="M12.5 4h7v8.5H28v7h-8.5V28h-7v-8.5H4v-7h8.5z" /></svg>;
  if (type === 'capsule') return <svg viewBox="0 0 36 24" fill="none"><rect x="1.5" y="1.5" width="33" height="21" rx="10.5" stroke="currentColor" strokeWidth="2.5"/><path d="M18 2v20" stroke="currentColor" strokeWidth="2"/><path d="M3 12A10.5 10.5 0 0 1 13.5 1.5H18v21h-4.5A10.5 10.5 0 0 1 3 12Z" fill="currentColor" fillOpacity=".35"/></svg>;
  if (type === 'tablet') return <svg viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="12.5" stroke="currentColor" strokeWidth="2.5"/><path d="m8 20 14-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
  if (type === 'heart') return <svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 28S3 20.2 3 11.8A7.2 7.2 0 0 1 16 7.5a7.2 7.2 0 0 1 13 4.3C29 20.2 16 28 16 28Z" /></svg>;
  if (type === 'pulse') return <svg viewBox="0 0 36 32" fill="none"><path d="M18 29S3 20.3 3 11.5A7.5 7.5 0 0 1 18 8a7.5 7.5 0 0 1 15 3.5C33 20.3 18 29 18 29Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/><path d="M7 16h6l3-5 4 10 3-5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg viewBox="0 0 28 36" fill="currentColor"><path d="M14 2C11 8 3 16 3 23a11 11 0 0 0 22 0C25 16 17 8 14 2Z"/><path d="M9 24a5 5 0 0 0 5 5" fill="none" stroke="var(--surface)" strokeOpacity=".55" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

export function SymbolRain({ intensity = 'normal', symbolTypes = SYMBOL_TYPES }: SymbolRainProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceAnimations = useReduceAnimationsPreference();
  const systemReducedMotion = useSystemReducedMotion();
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [inView, setInView] = useState(true);
  const symbols = useMemo(() => {
    const count = intensity === 'calm' ? 20 : 28;
    return Array.from({ length: count }, (_, index): RainSymbol => {
      const duration = 14 + Math.random() * 14;
      return {
        type: symbolTypes[Math.floor(Math.random() * symbolTypes.length)],
        x: 2 + Math.random() * 96,
        y: 12 + Math.random() * 72,
        size: 14 + Math.random() * 22,
        duration,
        delay: Math.random() * duration,
        opacity: .08 + Math.random() * .1,
        rotation: -24 + Math.random() * 48,
        sway: -22 + Math.random() * 44,
      };
    });
  }, [intensity, symbolTypes]);

  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (reduceAnimations) return null;
  const staticMode = systemReducedMotion;
  const running = visible && inView && !staticMode;
  return <div ref={rootRef} className="symbol-rain" aria-hidden="true" data-running={running} data-static={staticMode}>
    {symbols.map((symbol, index) => <span
      key={index}
      className={`symbol-rain-item symbol-rain-${symbol.type}${staticMode ? ' symbol-rain-static' : ''}`}
      style={{
        left: `${symbol.x}%`, top: staticMode ? `${symbol.y}%` : '-10%',
        width: `${symbol.size}px`, height: `${symbol.size}px`,
        color: symbol.type === 'heart' || symbol.type === 'pulse' ? 'var(--symbol-rose)' : 'var(--primary)',
        opacity: staticMode ? symbol.opacity : undefined,
        animationDuration: `${symbol.duration}s`, animationDelay: `${-symbol.delay}s`,
        ['--symbol-opacity' as string]: symbol.opacity,
        ['--symbol-rotation' as string]: `${symbol.rotation}deg`,
        ['--symbol-mid-rotation' as string]: `${symbol.rotation + 8}deg`,
        ['--symbol-end-rotation' as string]: `${symbol.rotation + 13}deg`,
        ['--symbol-sway' as string]: `${symbol.sway}px`,
        ['--symbol-sway-end' as string]: `${symbol.sway * -.45}px`,
      } as CSSProperties}
    ><SymbolShape type={symbol.type} /></span>)}
  </div>;
}
