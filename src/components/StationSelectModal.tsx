import { useState } from 'react';
import { BookOpen, TrainFront, Ruler, Route, Gauge, ShieldAlert, Wrench, CircleDot, Layers3 } from 'lucide-react';
import { STATION_SPECS } from '../data/layouts';
import { StationSpec } from '../types/simulator';
import { playSfx } from '../audio/sfx';

interface Props {
  onStart: (stationId: string) => void;
  onOpenChangelog?: () => void;
}

export default function StationSelectModal({ onStart, onOpenChangelog }: Props) {
  const [selected, setSelected] = useState<StationSpec>(STATION_SPECS[1]);
  const [leaving, setLeaving] = useState(false);
  const go = () => {
    playSfx('start');
    setLeaving(true);
    setTimeout(() => onStart(selected.id), 320);
  };

  return (
    <div className={`glass absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 border-0 p-6 transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <header className="flex w-full max-w-6xl flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Choose your station</h1>
          <p className="mt-2 text-lg text-slate-400">Pick the yard you will run for this shift. Every train you accept needs a road.</p>
        </div>
        <div className="flex items-center gap-3">
          {onOpenChangelog ? (
            <button onClick={() => { playSfx('open'); onOpenChangelog(); }} aria-label="Open changelog"
              className="flex h-14 items-center gap-2 rounded-xl bg-slate-800 px-5 text-base font-medium text-slate-300 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
              <BookOpen size={18} /> Changelog
            </button>
          ) : null}
          <button onClick={go} className="flex h-14 items-center gap-2 rounded-xl bg-emerald-400 px-7 text-lg font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            <TrainFront size={20} /> Dispatch Station
          </button>
        </div>
      </header>

      <div className="grid w-full max-w-6xl auto-rows-min grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        {STATION_SPECS.map((s) => {
          const active = s.id === selected.id;
          return (
            <button key={s.id} onClick={() => { playSfx('select'); setSelected(s); }} aria-pressed={active}
              className={`glass flex flex-col rounded-2xl p-7 text-left transition ${active ? '!border-emerald-400' : 'hover:!border-slate-600'}`}>
              <span className="w-fit rounded bg-slate-800 px-2.5 py-1 text-sm font-medium text-sky-400">Tier {s.tier}</span>
              <h2 className="mt-4 text-2xl font-semibold lg:text-3xl">{s.name}</h2>
              <p className="mt-1.5 text-base text-slate-400">{s.subtitle}</p>
              <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-slate-300">
                {s.layout.map((l) => (
                  <li key={l} className="flex items-center gap-1.5"><CircleDot size={13} className="text-slate-500" />{l}</li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-slate-800 pt-4 text-sm">
                <Spec icon={<Ruler size={14} />} label="Line length" value={`${s.lineLengthM.toLocaleString()} m`} />
                <Spec icon={<TrainFront size={14} />} label="Max trains" value={String(s.maxTrains)} />
                <Spec icon={<Route size={14} />} label="Switches" value={s.switchComplexity} />
                <Spec icon={<Layers3 size={14} />} label="Destinations" value={String(s.platformTracks + s.sidings + s.repairBays + s.mainLines)} />
                <Spec icon={<Wrench size={14} />} label="Turntables" value={String(s.turntables)} />
                <div>
                  <div className="flex items-center gap-1 text-slate-400"><Gauge size={14} /> Difficulty</div>
                  <div className="mt-1 flex gap-1" aria-label={`Difficulty ${s.difficulty} of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2 w-4 rounded-sm ${n <= s.difficulty ? (s.difficulty > 3 ? 'bg-rose-500' : 'bg-amber-400') : 'bg-slate-700'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="flex w-full max-w-6xl items-center gap-2 border-t border-slate-800 pt-5 text-base text-slate-500">
        <ShieldAlert size={16} /> Selected: {selected.name} · {selected.blurb}
      </p>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[13px] text-slate-400">{icon} {label}</div>
      <div className="mt-0.5 font-mono text-base text-slate-100">{value}</div>
    </div>
  );
}