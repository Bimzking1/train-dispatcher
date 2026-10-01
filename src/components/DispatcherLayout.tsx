import { useState } from 'react';
import { SimSpeed, StationSpec, Switch, Turntable } from '../types/simulator';
import { INBOUND_TRAINS, INITIAL_STATS, INITIAL_SWITCHES } from '../data/mock';
import TopStatusBar from './TopStatusBar';
import InboundQueuePanel from './InboundQueuePanel';
import TrackCanvasView from './TrackCanvasView';
import SwitchControlsDock from './SwitchControlsDock';

export default function DispatcherLayout({ station }: { station: StationSpec }) {
  const [speed, setSpeed] = useState<SimSpeed>(1);
  const [queueOpen, setQueueOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>('RE-317');
  const [switches, setSwitches] = useState<Switch[]>(INITIAL_SWITCHES);
  const [turntable, setTurntable] = useState<Turntable>({ id: 'TT-01', x: 1300, y: 560, radius: 80, angleDeg: 45 });

  const toggle = (id: string) => setSwitches((sw) => sw.map((s) => (s.id === id && !s.locked ? { ...s, state: s.state === 'THRU' ? 'DIVERGENT' : 'THRU' } : s)));
  const clear = switches.find((s) => s.id === 'W-02')?.state === 'DIVERGENT';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <main className="relative h-full w-full flex-1">
        <TrackCanvasView switches={switches} turntable={turntable} />
        <TopStatusBar station={station} speed={speed} onSpeed={setSpeed} stats={INITIAL_STATS} onAllStop={() => setSpeed(0)} />
        <InboundQueuePanel trains={INBOUND_TRAINS} open={queueOpen} onToggle={() => setQueueOpen((o) => !o)} selectedId={selectedId} onSelect={setSelectedId} />
        <SwitchControlsDock
          switches={switches} turntable={turntable} onToggle={toggle} onAngle={(a) => setTurntable((t) => ({ ...t, angleDeg: a }))}
          validation={{ label: clear ? 'Route: Inbound West -> Platform 3 [Path Clear]' : 'Route: Inbound West -> Platform 3 [Conflict at W-02]', clear }}
          onConfirm={() => undefined}
        />
      </main>
    </div>
  );
}
