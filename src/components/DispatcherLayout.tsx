import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stationSpecFor } from '../data/layouts';
import { useSimulation } from '../sim/useSimulation';
import { cueForLog, isArrival, playSfx, playSfxRepeat, setSfxMuted } from '../audio/sfx';
import type { SimSpeed } from '../types/simulator';
import TopStatusBar from './TopStatusBar';
import InboundQueuePanel from './InboundQueuePanel';
import TrackCanvasView from './TrackCanvasView';
import SwitchControlsDock from './SwitchControlsDock';
import TrainDetailsPanel from './TrainDetailsPanel';
import TurntableControlModal from './TurntableControlModal';
import QuitConfirmModal from './QuitConfirmModal';
import EventLog from './EventLog';

interface Props {
  stationId: string;
  onExit: () => void;
  onOpenChangelog?: () => void;
}

export default function DispatcherLayout({ stationId, onExit, onOpenChangelog }: Props) {
  const sim = useSimulation(stationId);
  const [queueOpen, setQueueOpen] = useState(true);
  const [turntableId, setTurntableId] = useState<string | null>(null);
  const [quitOpen, setQuitOpen] = useState(false);
  const { snapshot: snap } = sim;
  const station = stationSpecFor(stationId);
  const selected = snap.trains.find((t) => t.id === snap.selection) ?? null;
  const destId = snap.plan?.destinationId ?? null;
  const lastLog = useRef<string>('');
  const insets = useMemo(
    () => ({ left: queueOpen ? 384 : 0, top: 56, right: 320, bottom: 120 }),
    [queueOpen],
  );

  useEffect(() => {
    setTurntableId(null);
    setQuitOpen(false);
  }, [stationId]);

  useEffect(() => {
    const head = snap.log[0];
    if (!head) return;
    const token = `${stationId}:${head.id}`;
    if (token === lastLog.current) return;
    lastLog.current = token;
    const cue = cueForLog(head);
    if (!cue) return;
    if (isArrival(head)) playSfxRepeat(cue, 3, 430);
    else playSfx(cue);
  }, [snap.log, stationId]);

  useEffect(() => {
    setSfxMuted(snap.muted);
  }, [snap.muted]);

  const select = useCallback(
    (id: string | null) => {
      playSfx(id ? 'select' : 'deselect');
      sim.select(id);
    },
    [sim.select],
  );

  const preview = useCallback(
    (trainId: string, dId: string) => {
      playSfx('expand');
      sim.preview(trainId, dId);
    },
    [sim.preview],
  );

  const confirm = useCallback(() => {
    if (!selected || !destId) {
      playSfx('blocked');
      return;
    }
    playSfx(sim.dispatch(selected.id, destId) ? 'success' : 'error');
  }, [selected, destId, sim.dispatch]);

  const clear = useCallback(() => {
    if (selected) sim.release(selected.id);
    sim.select(null);
    playSfx('cancel');
  }, [selected, sim.release, sim.select]);

  const toggleSwitch = useCallback(
    (id: string) => {
      const was = snap.switches.find((s) => s.id === id)?.state;
      playSfx(was === 'THRU' ? 'toggle-off' : 'toggle-on');
      sim.toggleSwitch(id);
    },
    [snap.switches, sim.toggleSwitch],
  );

  const setSpeed = useCallback(
    (v: SimSpeed) => {
      playSfx(v === 0 ? 'pause' : 'play', 0.5);
      sim.setSpeed(v);
    },
    [sim.setSpeed],
  );

  const allStop = useCallback(() => {
    playSfx('stop');
    sim.allStop();
  }, [sim.allStop]);

  const mute = useCallback(() => {
    const next = !snap.muted;
    setSfxMuted(next);
    if (!next) playSfx('volume-change', 0.5);
    sim.toggleMute();
  }, [snap.muted, sim.toggleMute]);

  const rotateTurntable = useCallback((id: string, angle: number) => {
    playSfx('snap', 0.6);
    sim.rotateTurntable(id, angle);
  }, [sim.rotateTurntable]);

  const openTurntable = useCallback((id: string) => {
    setTurntableId(id);
    playSfx('open', 0.6);
  }, []);

  const askExit = useCallback(() => {
    setQuitOpen(true);
    playSfx('open', 0.5);
  }, []);

  const exit = useCallback(() => {
    setQuitOpen(false);
    playSfx('back');
    onExit();
  }, [onExit]);

  const cancelExit = useCallback(() => {
    setQuitOpen(false);
    playSfx('cancel');
  }, []);

  const openChangelog = useCallback(() => {
    playSfx('open');
    onOpenChangelog?.();
  }, [onOpenChangelog]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <main className="relative h-full w-full flex-1">
        <TrackCanvasView snap={snap} onSelect={select} onTurntable={openTurntable} insets={insets} />
        <TopStatusBar
          snap={snap}
          station={station}
          onSpeed={setSpeed}
          onAllStop={allStop}
          onMute={mute}
          onExit={askExit}
          onOpenChangelog={onOpenChangelog ? openChangelog : undefined}
        />
        <InboundQueuePanel
          snap={snap}
          open={queueOpen}
          onToggle={() => { playSfx(queueOpen ? 'collapse' : 'expand', 0.5); setQueueOpen((o) => !o); }}
          onSelect={select}
          onPreview={preview}
        />
        <SwitchControlsDock
          snap={snap}
          onToggleSwitch={toggleSwitch}
          onRotateTT={rotateTurntable}
          onOpenTT={openTurntable}
          onConfirm={confirm}
          onClear={clear}
        />
        <TrainDetailsPanel snap={snap} onClose={() => select(null)} />
        <EventLog log={snap.log} />
        {turntableId ? (
          <TurntableControlModal snap={snap} turntableId={turntableId}
            onRotate={rotateTurntable} onClose={() => { setTurntableId(null); playSfx('close', 0.5); }} />
        ) : null}
        {quitOpen ? <QuitConfirmModal onConfirm={exit} onCancel={cancelExit} /> : null}
        {snap.banner ? (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex justify-center">
            <span key={snap.banner.text + snap.sec} className={`sim-triple-flash rounded-full px-5 py-1.5 text-sm font-semibold tracking-wide text-white ${snap.banner.tone === 'bad' ? 'bg-rose-600' : snap.banner.tone === 'warn' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
              {snap.banner.text}
            </span>
          </div>
        ) : snap.allStop ? (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-30 flex justify-center">
            <span className="rounded-full bg-rose-600 px-4 py-1 text-xs font-semibold tracking-wide text-white">
              ALL-STOP — trains will not move until you clear it
            </span>
          </div>
        ) : null}
      </main>
    </div>
  );
}