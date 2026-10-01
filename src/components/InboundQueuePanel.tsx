import { ChevronLeft, ChevronRight, Gauge, Clock, Layers } from 'lucide-react';
import { RouteRequest, Train } from '../types/simulator';

const BADGE: Record<RouteRequest, string> = {
  PASS: 'border-emerald-400 text-emerald-400',
  STOP_BY: 'border-sky-400 text-sky-400',
  LAST_STOP: 'border-amber-400 text-amber-400',
  REPAIR: 'border-purple-400 text-purple-400',
};

interface Props { trains: Train[]; open: boolean; onToggle: () => void; selectedId: string | null; onSelect: (id: string) => void; }

export default function InboundQueuePanel({ trains, open, onToggle, selectedId, onSelect }: Props) {
  return (
    <>
      <aside className={`glass absolute bottom-32 left-0 top-16 z-20 flex w-80 flex-col rounded-r-xl transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="font-semibold">Inbound queue</h2>
          <span className="font-mono text-sm text-slate-400">{trains.length} waiting</span>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-3">
          {trains.map((t) => {
            const sel = t.id === selectedId;
            return (
              <li key={t.id}>
                <div className={`rounded-lg border p-3 transition ${sel ? 'border-sky-400 bg-slate-800' : 'border-slate-800 bg-slate-900/60'}`}>
                  <div className="flex items-center justify-between">
                    <div><span className="font-mono font-semibold">{t.id}</span> <span className="text-sm text-slate-400">{t.type}</span></div>
                    <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${BADGE[t.request]}`}>{t.request}</span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1"><Layers size={12} />{t.cars} cars</span>
                    <span className="flex items-center gap-1"><Gauge size={12} />{t.speedKmh} km/h</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{t.scheduledArrival}</span>
                  </div>
                  <button onClick={() => onSelect(t.id)} className="mt-3 w-full rounded-md bg-slate-700 py-1.5 text-sm font-medium transition hover:bg-sky-400 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
                    {sel ? 'Choosing route…' : 'Assign route'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
      <button onClick={onToggle} aria-label={open ? 'Collapse queue' : 'Expand queue'}
        className={`glass absolute top-20 z-20 flex h-10 w-7 items-center justify-center rounded-r-md transition-all duration-300 ${open ? 'left-80' : 'left-0'}`}>
        {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </>
  );
}
