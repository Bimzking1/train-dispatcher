import { X, Gauge, Layers3, Route as RouteIcon, Timer, TriangleAlert, Wrench, Ruler, Flag, ArrowLeftRight, Activity } from 'lucide-react';
import type { RouteRequest, SimSnapshot, SimTrain, TrainState } from '../types/simulator';
import { playSfx } from '../audio/sfx';

const STATE_TONE: Record<TrainState, string> = {
  INBOUND: 'border-sky-400 text-sky-300',
  HOLDING: 'border-amber-400 text-amber-300',
  RUNNING: 'border-emerald-400 text-emerald-300',
  DWELL: 'border-teal-400 text-teal-300',
  REPAIRING: 'border-purple-400 text-purple-300',
  DERAILED: 'border-rose-500 text-rose-400',
  DEPARTED: 'border-slate-500 text-slate-300',
  CLEARED: 'border-slate-600 text-slate-400',
};

const REQUEST_TONE: Record<RouteRequest, string> = {
  PASS: 'border-emerald-400 text-emerald-400',
  STOP_BY: 'border-sky-400 text-sky-400',
  LAST_STOP: 'border-amber-400 text-amber-400',
  REPAIR: 'border-purple-400 text-purple-400',
};

const REQUEST_LABEL: Record<RouteRequest, string> = {
  PASS: 'Through pass',
  STOP_BY: 'Stop by request',
  LAST_STOP: 'Final stop',
  REPAIR: 'Send to repair',
};

interface Props {
  snap: SimSnapshot;
  onClose: () => void;
}

export default function TrainDetailsPanel({ snap, onClose }: Props) {
  const train = snap.trains.find((t) => t.id === snap.selection) ?? null;
  if (!train) return null;

  return (
    <section aria-label={`Details for ${train.id}`}
      className="glass absolute bottom-36 left-1/2 z-20 w-[26rem] -translate-x-1/2 rounded-xl p-4">
      <header className="flex items-start gap-3">
        <span className="mt-1 h-8 w-2 shrink-0 rounded-full" style={{ background: train.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">{train.id}</h2>
            <span className="truncate text-sm text-slate-400">{train.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400">{train.type}</span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATE_TONE[train.state]}`}>{train.state}</span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${REQUEST_TONE[train.request]}`}>{REQUEST_LABEL[train.request]}</span>
          </div>
        </div>
        <button onClick={() => { playSfx('close', 0.5); onClose(); }} aria-label="Close train details"
          className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
          <X size={15} />
        </button>
      </header>

      <div className="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
        <span className="flex items-center gap-1.5 text-xs text-slate-500"><Activity size={12} /> Status</span>
        <span className="mt-0.5 block">{train.service}</span>
      </div>

      <SpeedBar train={train} />

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Field icon={<Layers3 size={13} />} label="Consist" value={`${train.cars} cars`} />
        <Field icon={<Ruler size={13} />} label="Length" value={`${train.lengthM.toFixed(0)} m`} />
        <Field icon={<Flag size={13} />} label="Entry" value={train.entryNode} />
        <Field icon={<RouteIcon size={13} />} label="Occupied edge" value={train.path[train.edgeIndex] ?? '—'} />
        <Field icon={<ArrowLeftRight size={13} />} label="Direction" value={train.backing ? 'Reversing' : train.dir === 1 ? 'Forward' : 'Against'} />
        <Field icon={<Timer size={13} />} label="Scheduled" value={fmtSec(train.scheduledSec)} />
      </div>

      {train.holdTimer > 0 && train.patienceMax > 0 ? <PatienceBar train={train} /> : null}

      <div className="mt-3 border-t border-slate-800 pt-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Road</h3>
        {train.plan ? (
          <>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="truncate text-slate-200">{train.plan.destinationLabel}</span>
              <span className="shrink-0 font-mono text-xs text-slate-400">{Math.round(train.plan.lengthM)} m</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
              <span>Leg {Math.min(train.plan.legIndex + 1, train.plan.edges.length)} of {train.plan.edges.length}</span>
              <span className="text-slate-600">·</span>
              <span>Arrive at {Math.round(train.plan.arrivalSpeedKmh)} km/h</span>
              {train.plan.required.length ? (
                <span className="text-slate-600">·</span>
              ) : null}
              {train.plan.required.length ? <span>{train.plan.required.length} point(s) to set</span> : null}
            </div>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-slate-500">No road set.</p>
        )}
      </div>

      {train.state === 'DERAILED' ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <Wrench size={13} /> Derailed — recovery is required before this train can move.
        </p>
      ) : null}
    </section>
  );
}

function SpeedBar({ train }: { train: SimTrain }) {
  const pct = Math.min(100, (train.speedKmh / train.maxSpeedKmh) * 100);
  const brake = train.plan ? Math.max(0, train.plan.arrivalSpeedKmh - train.speedKmh) : 0;
  const nearStop = train.plan ? Math.max(0, train.speedKmh - train.plan.arrivalSpeedKmh) <= 3 : false;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="flex items-center gap-1.5 text-slate-400"><Gauge size={13} /> Speed</span>
        <span className="font-mono tabular-nums text-slate-100">
          {Math.round(train.speedKmh)} <span className="text-xs text-slate-500">/ {Math.round(train.maxSpeedKmh)} km/h</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all ${train.state === 'DERAILED' ? 'bg-rose-500' : nearStop ? 'bg-amber-400' : 'bg-sky-400'}`} style={{ width: `${pct}%` }} />
      </div>
      {brake > 0 ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-300"><TriangleAlert size={11} /> {Math.round(brake)} km/h above the arrival target — braking</p>
      ) : null}
    </div>
  );
}

function PatienceBar({ train }: { train: SimTrain }) {
  const left = Math.max(0, train.patienceMax - train.holdTimer);
  const pct = Math.max(0, Math.min(100, (left / train.patienceMax) * 100));
  const tone = left < 30 ? 'bg-rose-500' : left < 60 ? 'bg-amber-400' : 'bg-slate-500';
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="flex items-center gap-1.5 text-slate-400"><Timer size={13} /> Time held</span>
        <span className="font-mono tabular-nums text-slate-100">{Math.round(train.holdTimer)}s</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-1 text-[11px] ${left < 30 ? 'text-rose-400' : 'text-slate-500'}`}>{Math.round(left)}s of patience left</p>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1 text-[11px] text-slate-500">{icon} {label}</span>
      <span className="mt-0.5 block truncate font-mono text-sm text-slate-100">{value}</span>
    </div>
  );
}

function fmtSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}