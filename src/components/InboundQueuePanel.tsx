import { useState } from 'react';
import { ChevronLeft, ChevronRight, Gauge, Layers, CircleAlert, Route as RouteIcon, Timer, X } from 'lucide-react';
import type { Destination, RouteRequest, SimSnapshot, SimTrain } from '../types/simulator';
import { playSfx } from '../audio/sfx';

const BADGE: Record<RouteRequest, string> = {
  PASS: 'border-emerald-400 text-emerald-400',
  STOP_BY: 'border-sky-400 text-sky-400',
  LAST_STOP: 'border-amber-400 text-amber-400',
  REPAIR: 'border-purple-400 text-purple-400',
};

const SHORT: Record<RouteRequest, string> = { PASS: 'PASS', STOP_BY: 'STOP', LAST_STOP: 'LAST', REPAIR: 'FIX' };

const KIND_TONE: Record<string, string> = {
  main: 'border-sky-400/50 text-sky-300',
  platform: 'border-emerald-400/50 text-emerald-300',
  siding: 'border-amber-400/50 text-amber-300',
  staging: 'border-amber-400/50 text-amber-300',
  repair: 'border-rose-400/50 text-rose-300',
  depot: 'border-purple-400/50 text-purple-300',
};

interface Props {
  snap: SimSnapshot;
  open: boolean;
  onToggle: () => void;
  onSelect: (trainId: string) => void;
  onPreview: (trainId: string, destId: string) => void;
}

export default function InboundQueuePanel({ snap, open, onToggle, onSelect, onPreview }: Props) {
  const [picking, setPicking] = useState<string | null>(null);
  const selected = snap.trains.find((t) => t.id === snap.selection);
  const waiting = snap.trains.filter((t) => t.state === 'INBOUND' || t.state === 'HOLDING');
  const urgent = waiting.filter((t) => t.state === 'HOLDING' || t.patienceMax - t.holdTimer < 60).length;
  const alert = !open && urgent > 0;

  return (
    <>
      <aside className={`glass absolute bottom-32 left-0 top-16 z-20 flex w-96 flex-col rounded-r-xl transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="font-semibold">Inbound queue</h2>
          <span className="font-mono text-sm text-slate-400">{waiting.length} waiting</span>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-3">
          {waiting.length === 0 ? (
            <li className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-sm text-slate-500">No trains on the approach</li>
          ) : null}
          {waiting.map((t) => (
            <li key={t.id}>
              <TrainCard train={t} selected={t.id === snap.selection} onSelect={onSelect} />
              {t.id === snap.selection ? (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  {picking === t.id ? (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-400"><RouteIcon size={12} /> Choose a destination</span>
                        <button onClick={() => { playSfx('close', 0.5); setPicking(null); }} aria-label="Cancel destination pick" className="text-slate-500 hover:text-slate-200"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {snap.options.length === 0 ? (
                          <p className="col-span-2 text-xs text-slate-500">No roads accept this request.</p>
                        ) : null}
                        {snap.options.map((d) => (
                          <button key={d.id} onClick={() => { onPreview(t.id, d.id); setPicking(null); }}
                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-left text-xs text-slate-200 transition hover:border-sky-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
                            <span className="block truncate font-medium">{d.label}</span>
                            <span className={`mt-0.5 inline-block rounded border px-1 text-[10px] ${KIND_TONE[d.kind] ?? ''}`}>{d.trackLabel}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button onClick={() => { playSfx('open', 0.6); setPicking(t.id); }} disabled={t.plan !== null}
                      className="w-full rounded-md bg-slate-700 py-1.5 text-sm font-medium transition hover:bg-sky-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
                      {t.plan ? 'Road set' : 'Assign route'}
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-800 p-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Coming up</h3>
          <ul className="space-y-1">
            {snap.upcoming.length === 0 ? <li className="text-xs text-slate-600">Schedule clear</li> : null}
            {snap.upcoming.map((u) => (
              <li key={u.id} className="flex items-center justify-between font-mono text-xs text-slate-400">
                <span>{u.id} · {SHORT[u.request]}</span>
                <span className="flex items-center gap-1 text-slate-500"><Timer size={11} />{fmtDue(u.dueInSec)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="relative">
        <button onClick={onToggle} aria-label={open ? 'Collapse queue' : `Expand queue, ${urgent} urgent`} aria-pressed={!alert}
          className={`glass absolute top-20 z-20 flex h-10 w-7 items-center justify-center rounded-r-md transition-all duration-300 ${open ? 'left-96' : 'left-0'} ${alert ? 'sim-alert-pulse border-amber-400 text-amber-300' : 'text-slate-300'}`}>
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        {!open && urgent > 0 ? (
          <span className="absolute left-7 top-[4.75rem] z-30 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 font-mono text-[11px] font-bold text-slate-950 shadow-lg sim-alert-dot">
            {urgent}
          </span>
        ) : null}
      </div>
      {selected && selected.state !== 'INBOUND' && selected.state !== 'HOLDING' ? (
        <div className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs text-slate-300">
          {selected.id} · {selected.service}
        </div>
      ) : null}
    </>
  );
}

function TrainCard({ train, selected, onSelect }: { train: SimTrain; selected: boolean; onSelect: (id: string) => void }) {
  const patience = Math.max(0, train.patienceMax - train.holdTimer);
  const late = patience < 30;
  return (
    <div className={`rounded-lg border p-3 transition ${selected ? 'border-sky-400 bg-slate-800' : 'border-slate-800 bg-slate-900/60'}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono font-semibold">{train.id}</span>{' '}
          <span className="text-sm text-slate-400">{train.type}</span>
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${BADGE[train.request]}`}>{SHORT[train.request]}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
        <span className="flex items-center gap-1"><Layers size={12} />{train.cars} cars</span>
        <span className="flex items-center gap-1"><Gauge size={12} />{Math.round(train.speedKmh)} km/h</span>
        <span className={`flex items-center gap-1 ${late ? 'text-rose-400' : 'text-slate-400'}`}>
          <Timer size={12} />{train.plan ? train.destLabel || 'routed' : `${Math.round(patience)}s patience`}
        </span>
      </div>
      {train.plan ? <div className="mt-2 text-xs text-slate-400">Road set · {train.plan.destinationLabel}</div> : null}
      <button onClick={() => onSelect(train.id)}
        className="mt-3 w-full rounded-md bg-slate-700 py-1.5 text-sm font-medium transition hover:bg-sky-400 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
        {selected ? 'Choosing route' : 'Select'}
      </button>
    </div>
  );
}

function fmtDue(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export function destinationHint(d: Destination): string {
  return `${d.label} · ${d.trackLabel} · ${d.sub}`;
}

export function patienceTone(train: SimTrain): 'ok' | 'warn' | 'bad' {
  if (train.state === 'DERAILED') return 'bad';
  const left = train.patienceMax - train.holdTimer;
  if (left < 30) return 'bad';
  if (left < 60) return 'warn';
  return 'ok';
}

export function queuedWarningIcon() {
  return <CircleAlert size={13} className="text-amber-400" />;
}