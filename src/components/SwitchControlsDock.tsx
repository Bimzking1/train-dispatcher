import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { RouteValidation, Switch, Turntable } from '../types/simulator';

interface Props {
  switches: Switch[]; turntable: Turntable; onToggle: (id: string) => void; onAngle: (deg: number) => void;
  validation: RouteValidation; onConfirm: () => void;
}

export default function SwitchControlsDock({ switches, turntable, onToggle, onAngle, validation, onConfirm }: Props) {
  return (
    <footer className="glass absolute inset-x-4 bottom-4 z-20 flex h-24 items-center gap-4 rounded-xl px-4">
      <div className="flex gap-2">
        {switches.map((s) => (
          <button key={s.id} disabled={s.locked} onClick={() => onToggle(s.id)}
            className={`flex w-32 flex-col rounded-lg border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${s.state === 'THRU' ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-rose-500/60 bg-rose-500/10'} ${s.locked ? 'opacity-60' : 'hover:brightness-125'}`}>
            <span className="flex items-center justify-between font-mono text-xs text-slate-400">{s.id}{s.locked && <Lock size={12} />}</span>
            <span className={`font-mono text-sm font-semibold ${s.state === 'THRU' ? 'text-emerald-400' : 'text-rose-500'}`}>{s.state}</span>
          </button>
        ))}
        <div className="flex w-36 flex-col rounded-lg border border-sky-400/60 bg-sky-400/10 px-3 py-2">
          <span className="font-mono text-xs text-slate-400">TT-01</span>
          <span className="font-mono text-sm font-semibold text-sky-400">ANGLE {turntable.angleDeg}°</span>
          <input type="range" min={0} max={180} step={15} value={turntable.angleDeg} onChange={(e) => onAngle(Number(e.target.value))} aria-label="Turntable angle" className="h-1 accent-sky-400" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-950/60 px-4 py-3">
        {validation.clear ? <CheckCircle2 size={18} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={18} className="shrink-0 text-amber-400" />}
        <span className="truncate text-sm">{validation.label}</span>
      </div>

      <button onClick={onConfirm} disabled={!validation.clear}
        className="h-12 rounded-lg bg-emerald-400 px-6 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
        Confirm dispatch
      </button>
    </footer>
  );
}
