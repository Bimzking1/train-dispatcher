import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SimSnapshot, SimSpeed } from '../types/simulator';
import { SimulationEngine } from './engine';

export interface SimApi {
  snapshot: SimSnapshot;
  setSpeed: (v: SimSpeed) => void;
  togglePause: () => void;
  allStop: () => void;
  toggleMute: () => void;
  select: (trainId: string | null) => void;
  preview: (trainId: string, destId: string) => void;
  dispatch: (trainId: string, destId: string) => boolean;
  release: (trainId: string) => void;
  toggleSwitch: (id: string) => void;
  rotateTurntable: (id: string, angleDeg: number) => void;
}

export function useSimulation(stationId: string, initialPaused = false): SimApi {
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SimulationEngine(stationId);
  const [tick, setTick] = useState(0);
  const snapRef = useRef<SimSnapshot>(engineRef.current.snapshot());

  const refresh = useCallback(() => {
    const e = engineRef.current;
    if (e) snapRef.current = e.snapshot();
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    engineRef.current = new SimulationEngine(stationId);
    snapRef.current = engineRef.current.snapshot();
    setTick((n) => n + 1);
  }, [stationId]);

  useEffect(() => {
    if (initialPaused) engineRef.current?.setSpeed(0);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const e = engineRef.current;
      if (e) {
        e.tick(dt);
        snapRef.current = e.snapshot();
        setTick((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [initialPaused]);

  const actions = useMemo<Omit<SimApi, 'snapshot' | 'dispatch'>>(
    () => ({
      setSpeed: (v) => {
        engineRef.current?.setSpeed(v);
      },
      togglePause: () => engineRef.current?.togglePause(),
      allStop: () => engineRef.current?.setAllStop(),
      toggleMute: () => engineRef.current?.toggleMute(),
      select: (id) => {
        engineRef.current?.select(id);
        refresh();
      },
      preview: (trainId, destId) => {
        engineRef.current?.preview(trainId, destId);
        refresh();
      },
      release: (trainId) => {
        engineRef.current?.release(trainId);
        refresh();
      },
      toggleSwitch: (id) => {
        engineRef.current?.toggleSwitch(id);
        refresh();
      },
      rotateTurntable: (id, angle) => {
        engineRef.current?.rotateTurntable(id, angle);
        refresh();
      },
    }),
    [refresh],
  );

  return {
    ...actions,
    snapshot: snapRef.current,
    dispatch: (trainId, destId) => {
      const eng = engineRef.current;
      if (!eng) return false;
      const res = eng.dispatch(trainId, destId);
      refresh();
      return res.ok;
    },
  };
}

export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: never[]) => ref.current(...args)) as T, []);
}