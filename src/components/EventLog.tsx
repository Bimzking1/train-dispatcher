import { ScrollText } from 'lucide-react';
import type { LogEntry } from '../types/simulator';

const TONE: Record<LogEntry['level'], string> = {
  info: 'text-slate-400',
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-rose-400',
};

const BADGE: Record<LogEntry['level'], string> = {
  info: 'bg-slate-800 text-slate-400',
  good: 'bg-emerald-400/15 text-emerald-400',
  warn: 'bg-amber-400/15 text-amber-400',
  bad: 'bg-rose-500/20 text-rose-400',
};

interface Props {
  log: LogEntry[];
}

export default function EventLog({ log }: Props) {
  return (
    <aside className="glass absolute bottom-32 right-0 top-16 z-20 flex w-80 flex-col rounded-l-xl">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <ScrollText size={15} className="text-slate-400" />
        <h2 className="font-semibold">Panel log</h2>
        <span className="ml-auto font-mono text-sm text-slate-400">{log.length}</span>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {log.length === 0 ? <li className="text-sm text-slate-600">Nothing reported yet.</li> : null}
        {log.map((l) => (
          <li key={l.id} className="flex gap-2 text-xs leading-relaxed">
            <span className={`h-fit shrink-0 rounded px-1 py-0.5 font-mono text-[10px] uppercase ${BADGE[l.level]}`}>{l.level}</span>
            <span className={TONE[l.level]}>{l.text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}