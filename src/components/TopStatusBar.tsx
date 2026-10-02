import { Volume2, VolumeX, OctagonAlert, Pause, Play, LogOut, Gauge, BookOpen } from 'lucide-react';
import { clockOf } from '../sim/engine';
import type { ScoreStats, SimSnapshot, SimSpeed, StationSpec } from '../types/simulator';

interface Props {
  snap: SimSnapshot;
  station: StationSpec;
  onSpeed: (s: SimSpeed) => void;
  onAllStop: () => void;
  onMute: () => void;
  onExit: () => void;
  onOpenChangelog?: () => void;
}

const SPEEDS: { v: SimSpeed; label: string }[] = [
  { v: 1, label: '1x' },
  { v: 2, label: '2x' },
  { v: 5, label: '5x' },
];

export default function TopStatusBar({ snap, station, onSpeed, onAllStop, onMute, onExit, onOpenChangelog }: Props) {
  const { stats } = snap;
  const btn = 'flex h-8 items-center gap-1 rounded-md px-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400';

  return (
    <header className="glass absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold">{station.name}</span>
        <span className="rounded bg-sky-400/15 px-2 py-0.5 text-xs font-medium text-sky-400">Tier {station.tier}</span>
        <span className="font-mono text-lg tabular-nums text-emerald-400">{clockOf(snap.sec)}</span>
        <div className="flex items-center gap-1">
          {SPEEDS.map(({ v, label }) => (
            <button key={v} onClick={() => onSpeed(v)} aria-pressed={snap.speed === v}
              className={`${btn} ${snap.speed === v ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {label}
            </button>
          ))}
          <button onClick={() => onSpeed(0)} aria-pressed={snap.speed === 0} aria-label={snap.speed === 0 ? 'Resume' : 'Pause'}
            className={`${btn} ${snap.speed === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {snap.speed === 0 ? <Play size={14} /> : <Pause size={14} />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <Stat label="On-time" value={`${Math.round(stats.onTimeRate)}%`} tone="text-emerald-400" />
        <Stat label="Collisions" value={String(stats.collisionAlerts)} tone="text-rose-500" />
        <Stat label="Processed" value={String(stats.processed)} tone="text-slate-100" />
        <Stat label="Held" value={String(stats.held)} tone="text-amber-400" />
        <Stat label="Score" value={String(stats.score)} tone="text-sky-400" />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onMute} aria-label={snap.muted ? 'Unmute audio' : 'Mute audio'} className={`${btn} bg-slate-800 hover:bg-slate-700`}>
          {snap.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button onClick={onAllStop} className={`${btn} bg-rose-600 font-semibold hover:bg-rose-500`}>
          <OctagonAlert size={16} /> All-Stop
        </button>
        {onOpenChangelog ? (
          <button onClick={onOpenChangelog} className={`${btn} bg-slate-800 hover:bg-slate-700`} aria-label="Open changelog">
            <BookOpen size={16} />
          </button>
        ) : null}
        <button onClick={onExit} className={`${btn} bg-slate-800 hover:bg-slate-700`} aria-label="Change station">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono text-base font-semibold tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

export function speedLabel(v: SimSpeed): string {
  return v === 0 ? 'Paused' : `${v}x`;
}

export function statsTone(stats: ScoreStats): string {
  if (stats.collisionAlerts > 0) return 'text-rose-500';
  return stats.onTimeRate >= 80 ? 'text-emerald-400' : 'text-amber-400';
}

export const SpeedIcon = Gauge;