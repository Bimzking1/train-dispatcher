import { useEffect, useState } from 'react';
import { Volume2, VolumeX, OctagonAlert, Maximize, Pause } from 'lucide-react';
import { SimSpeed, StationSpec, ScoreStats } from '../types/simulator';

interface Props { station: StationSpec; speed: SimSpeed; onSpeed: (s: SimSpeed) => void; stats: ScoreStats; onAllStop: () => void; }

export default function TopStatusBar({ station, speed, onSpeed, stats, onAllStop }: Props) {
  const [secs, setSecs] = useState(14 * 3600 + 32 * 60 + 5);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    if (speed === 0) return;
    const t = setInterval(() => setSecs((s) => s + speed), 1000);
    return () => clearInterval(t);
  }, [speed]);
  const p = (n: number) => String(n).padStart(2, '0');
  const clock = `${p(Math.floor(secs / 3600) % 24)}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}`;
  const speeds: { v: SimSpeed; label: string }[] = [{ v: 1, label: '1x' }, { v: 2, label: '2x' }, { v: 5, label: '5x' }, { v: 0, label: 'Pause' }];
  const btn = 'flex h-8 items-center gap-1 rounded-md px-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400';

  return (
    <header className="glass absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold">{station.name}</span>
        <span className="rounded bg-sky-400/15 px-2 py-0.5 text-xs font-medium text-sky-400">Tier {station.tier}</span>
        <span className="font-mono text-lg tabular-nums text-emerald-400">{clock}</span>
        <div className="flex gap-1">
          {speeds.map(({ v, label }) => (
            <button key={label} onClick={() => onSpeed(v)} aria-pressed={speed === v}
              className={`${btn} ${speed === v ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {v === 0 ? <Pause size={14} /> : null}{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <Stat label="On-time" value={`${stats.onTimeRate}%`} tone="text-emerald-400" />
        <Stat label="Collision alerts" value={String(stats.collisionAlerts)} tone="text-rose-500" />
        <Stat label="Processed" value={String(stats.processed)} tone="text-slate-100" />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute audio' : 'Mute audio'} className={`${btn} bg-slate-800 hover:bg-slate-700`}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button onClick={onAllStop} className={`${btn} bg-rose-600 font-semibold hover:bg-rose-500`}><OctagonAlert size={16} /> All-Stop</button>
        <button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Toggle fullscreen" className={`${btn} bg-slate-800 hover:bg-slate-700`}>
          <Maximize size={16} />
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex items-baseline gap-2"><span className="text-slate-400">{label}</span><span className={`font-mono text-base font-semibold tabular-nums ${tone}`}>{value}</span></div>;
}
