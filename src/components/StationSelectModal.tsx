import { useState } from 'react';
import { Train, Gauge, Ruler, Route, ShieldAlert } from 'lucide-react';
import { StationSpec } from '../types/simulator';
import { STATIONS } from '../data/mock';

interface Props { onDispatch: (station: StationSpec) => void; }

export default function StationSelectModal({ onDispatch }: Props) {
  const [selected, setSelected] = useState<StationSpec>(STATIONS[1]);
  const [leaving, setLeaving] = useState(false);
  const go = () => { setLeaving(true); setTimeout(() => onDispatch(selected), 350); };

  return (
    <div className={`absolute inset-0 z-50 flex flex-col bg-slate-950 p-6 transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <header className="flex items-end justify-between pb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Choose your station</h1>
          <p className="mt-1 text-slate-400">Pick the yard you will run for this shift.</p>
        </div>
        <button onClick={go} className="flex items-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
          <Train size={18} /> Dispatch Station
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {STATIONS.map((s) => {
          const active = s.id === selected.id;
          return (
            <button key={s.id} onClick={() => setSelected(s)} aria-pressed={active}
              className={`glass flex min-h-0 flex-col rounded-xl p-5 text-left transition ${active ? '!border-emerald-400' : 'hover:!border-slate-600'}`}>
              <span className="w-fit rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-sky-400">Tier {s.tier}</span>
              <h2 className="mt-3 text-xl font-semibold">{s.name}</h2>
              <ul className="mt-3 space-y-1 text-sm text-slate-300">{s.layout.map((l) => <li key={l}>{l}</li>)}</ul>
              <div className="mt-auto grid grid-cols-2 gap-3 pt-5 text-sm">
                <Spec icon={<Ruler size={14} />} label="Line length" value={`${s.lineLengthM.toLocaleString()} m`} />
                <Spec icon={<Train size={14} />} label="Max trains" value={String(s.maxTrains)} />
                <Spec icon={<Route size={14} />} label="Switches" value={s.switchComplexity} />
                <div>
                  <div className="flex items-center gap-1 text-slate-400"><Gauge size={14} /> Difficulty</div>
                  <div className="mt-1 flex gap-1" aria-label={`Difficulty ${s.difficulty} of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2 w-5 rounded-sm ${n <= s.difficulty ? (s.difficulty > 3 ? 'bg-rose-500' : 'bg-amber-400') : 'bg-slate-700'}`} />)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-2 pt-4 text-sm text-slate-500"><ShieldAlert size={14} /> Selected: {selected.name}</p>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><div className="flex items-center gap-1 text-slate-400">{icon} {label}</div><div className="mt-1 font-mono text-slate-100">{value}</div></div>;
}
