import { useMemo } from 'react';
import { Lock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { SimSnapshot } from '../types/simulator';

interface Props {
  snap: SimSnapshot;
  onToggleSwitch: (id: string) => void;
  onRotateTT: (id: string, angle: number) => void;
  onOpenTT: (id: string) => void;
  onConfirm: () => void;
  onClear: () => void;
}

export default function SwitchControlsDock({ snap, onToggleSwitch, onRotateTT, onOpenTT, onConfirm, onClear }: Props) {
  const { plan, switches, turntables, selection } = snap;
  const hasPlan = !!plan;
  const routeOk = hasPlan && plan.ok;
  const blocks = plan?.blocks ?? [];
  const warns = plan?.warns ?? [];
  const message = useMemo(() => {
    if (!selection) return 'Select a train from the queue to assign it a road.';
    if (!hasPlan) return 'Previewing a route will show required points, locks and any conflicts.';
    if (blocks.length > 0) return blocks[0].text;
    if (warns.length > 0) return warns[0].text;
    return routeOk ? 'Route is valid and safe to dispatch.' : 'No valid road for this destination.';
  }, [selection, hasPlan, routeOk, blocks, warns]);

  return (
    <footer className="glass absolute inset-x-4 bottom-4 z-20 flex min-h-24 flex-wrap items-center gap-4 rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {switches.map((s) => {
          const thru = s.state === 'THRU';
          const tone = thru ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-400' : 'border-rose-500/60 bg-rose-500/10 text-rose-500';
          return (
            <button key={s.id} disabled={s.locked} onClick={() => onToggleSwitch(s.id)}
              className={`flex w-36 flex-col rounded-lg border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${tone} ${s.locked ? 'opacity-60' : 'hover:brightness-110'}`}>
              <span className="flex items-center justify-between font-mono text-xs text-slate-400">{s.label || s.id}{s.locked && <Lock size={12} />}</span>
              <span className="font-mono text-sm font-semibold">{s.state}</span>
            </button>
          );
        })}
        {turntables.map((tt) => {
          const angle = Math.round(tt.targetDeg ?? tt.angleDeg);
          return (
            <button key={tt.id} type="button" onClick={() => onOpenTT(tt.id)}
              aria-haspopup="dialog" aria-label={`${tt.id} turntable controls, currently ${Math.round(tt.angleDeg)} degrees`}
              className="flex w-44 flex-col rounded-lg border border-sky-400/60 bg-sky-400/10 px-3 py-2 text-left transition hover:border-sky-400 hover:bg-sky-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
              <span className="font-mono text-xs text-slate-400">{tt.id}</span>
              <span className="font-mono text-sm font-semibold text-sky-400">ANGLE {Math.round(tt.angleDeg)}° → {angle}°</span>
              <span className="mt-1 text-[11px] text-slate-400">Click for rotation dial</span>
              {tt.moving ? (
                <span className="mt-1 flex items-center gap-1 text-xs text-sky-300"><Loader2 size={11} className="animate-spin" /> rotating</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-slate-950/60 px-4 py-3">
        {routeOk ? <CheckCircle2 size={18} className="shrink-0 text-emerald-400" /> : blocks.length > 0 ? <AlertTriangle size={18} className="shrink-0 text-rose-500" /> : warns.length > 0 ? <AlertTriangle size={18} className="shrink-0 text-amber-400" /> : <AlertTriangle size={18} className="shrink-0 text-slate-500" />}
        <span className="truncate text-sm">{message}</span>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onClear} disabled={!selection}
          className="h-11 rounded-lg bg-slate-800 px-4 font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/50 disabled:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
          Clear road
        </button>
        {hasPlan ? (
          <button onClick={onConfirm} disabled={!routeOk}
            className="h-11 rounded-lg bg-emerald-400 px-6 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            Confirm dispatch
          </button>
        ) : null}
      </div>
    </footer>
  );
}