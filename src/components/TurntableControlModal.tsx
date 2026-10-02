import { useEffect } from 'react';
import { X, Loader2, TriangleAlert } from 'lucide-react';
import type { SimSnapshot } from '../types/simulator';
import { playSfx } from '../audio/sfx';

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

interface Props {
  snap: SimSnapshot;
  turntableId: string;
  onRotate: (id: string, angleDeg: number) => void;
  onClose: () => void;
}

export default function TurntableControlModal({ snap, turntableId, onRotate, onClose }: Props) {
  const tt = snap.turntables.find((t) => t.id === turntableId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!tt) return null;

  const current = Math.round(tt.targetDeg ?? tt.angleDeg);
  const occupied = snap.trains.some(
    (t) => t.state !== 'CLEARED' && Math.hypot(t.x - tt.pos.x, t.y - tt.pos.y) < tt.radius + 80,
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${tt.id} turntable controls`}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-2xl rounded-2xl p-7">
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-semibold">{tt.id}</h2>
            <p className="mt-1 text-lg text-slate-300">
              Deck at <span className="font-mono font-semibold text-sky-400">{Math.round(tt.angleDeg)}°</span>
              {tt.targetDeg !== null ? <span className="font-mono text-slate-500"> → {Math.round(tt.targetDeg)}°</span> : null}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close turntable controls"
            className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            <X size={22} />
          </button>
        </header>

        <div className="mt-5 flex items-center justify-center py-2">
          <TurntableDial angleDeg={tt.targetDeg ?? tt.angleDeg} radius={tt.radius} portRadius={tt.portRadius} moving={tt.moving} />
        </div>

        <p className="mt-2 text-center text-base text-slate-400">Max {Math.round(tt.speedLimitKmh)} km/h over the deck</p>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {ANGLES.map((a) => (
            <button key={a} onClick={() => { playSfx('snap', 0.6); onRotate(tt.id, a); }}
              aria-pressed={Math.abs(current - a) < 2}
              className={`rounded-lg border px-2 py-3 font-mono text-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${Math.abs(current - a) < 2 ? 'border-sky-400 bg-sky-400 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-sky-300'}`}>
              {a}°
            </button>
          ))}
        </div>

        {tt.moving ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-base text-sky-300"><Loader2 size={15} className="animate-spin" /> rotating the deck</p>
        ) : occupied ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-base text-amber-300"><TriangleAlert size={15} /> deck obstructed — rotation refused</p>
        ) : null}
      </div>
    </div>
  );
}

function TurntableDial({ angleDeg, radius, portRadius, moving }: { angleDeg: number; radius: number; portRadius: number; moving: boolean }) {
  const size = radius * 2 + 24;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="block">
      <circle r={radius} fill="#0b1220" stroke={moving ? '#38bdf8' : '#475569'} strokeWidth="3" />
      <circle r={radius - 12} fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 7" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <line x1="0" y1="0" x2={portRadius} y2="0" stroke={Math.abs(angleDeg - a) < 2 ? '#38bdf8' : '#334155'} strokeWidth={Math.abs(angleDeg - a) < 2 ? 4 : 3} />
        </g>
      ))}
      <g style={{ transform: `rotate(${angleDeg}deg)`, transition: moving ? 'transform 1.1s linear' : 'none', transformOrigin: 'center', transformBox: 'view-box' }}>
        <rect x={-radius + 7} y={-9} width={radius * 2 - 14} height={18} rx="3" fill="#38bdf8" fillOpacity={0.28} stroke="#38bdf8" strokeWidth="2" />
      </g>
      <circle r="6" fill="#38bdf8" />
    </svg>
  );
}