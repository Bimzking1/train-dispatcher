import { ArrowLeft, Plus, Wrench, Zap } from 'lucide-react';
import { CHANGELOG } from '../data/changelog';
import { playSfx } from '../audio/sfx';

export default function ChangelogPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="glass absolute inset-0 z-50 flex flex-col p-6">
      <header className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>
          <p className="mt-1 text-slate-400">Every release, what it added, and what it fixed.</p>
        </div>
        <button onClick={() => { playSfx('back'); onBack(); }}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-3 font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
          <ArrowLeft size={18} /> Back
        </button>
      </header>

      <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
        {CHANGELOG.map((e) => (
          <li key={e.version} className="glass rounded-xl p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded bg-sky-400/15 px-2 py-0.5 font-mono text-xs font-semibold text-sky-400">v{e.version}</span>
              <h2 className="text-xl font-semibold">{e.title}</h2>
              <span className="font-mono text-xs text-slate-500">{e.date} · {e.time}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{e.summary}</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Group icon={<Plus size={13} />} tone="text-emerald-400" title="Added" items={e.added} />
              <Group icon={<Zap size={13} />} tone="text-sky-400" title="Changed" items={e.changed} />
              <Group icon={<Wrench size={13} />} tone="text-amber-400" title="Fixed" items={e.fixed} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Group({ icon, tone, title, items }: { icon: React.ReactNode; tone: string; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>{icon} {title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}