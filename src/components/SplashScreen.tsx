import { useEffect, useState } from 'react';

const HOLD_MS = 2200;
const TOTAL_MS = 3000;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shown = entered && !leaving;

  useEffect(() => {
    const enter = requestAnimationFrame(() => setEntered(true));
    const fade = setTimeout(() => setLeaving(true), HOLD_MS);
    const done = setTimeout(onDone, TOTAL_MS);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className={`absolute inset-0 z-[60] flex flex-col items-center justify-center gap-9 bg-slate-950 transition-opacity duration-700 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.18),transparent_62%)] transition-opacity duration-1000 ${shown ? 'opacity-100' : 'opacity-0'}`} />
      <img src="/logo.jpg" alt="Station Dispatcher"
        className={`relative h-56 w-56 rounded-[3rem] object-cover shadow-2xl shadow-sky-500/25 ring-1 ring-white/20 transition-all duration-1000 ease-out sm:h-72 sm:w-72 sm:rounded-[3.5rem] lg:h-96 lg:w-96 ${shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} />
      <div className={`relative text-center transition-all duration-700 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl lg:text-7xl">Station Dispatcher</h1>
        <p className="mt-3 text-sm uppercase tracking-[0.3em] text-sky-400/80 sm:text-base">Signals · Switches · Timing</p>
      </div>
      <div className={`h-1 w-64 overflow-hidden rounded-full bg-slate-800 transition-opacity duration-500 sm:w-96 ${shown ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ animation: `splash-fill ${TOTAL_MS}ms linear forwards` }} />
      </div>
    </div>
  );
}