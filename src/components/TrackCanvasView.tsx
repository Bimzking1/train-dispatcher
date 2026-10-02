import { useMemo } from 'react';
import { Lock, TriangleAlert, Wrench, Minus, Plus, Maximize2 } from 'lucide-react';
import { useCanvasView, type ViewInsets } from '../hooks/useCanvasView';
import { playSfx } from '../audio/sfx';
import type { SimSnapshot, SimTrain, TrackKind, Vec } from '../types/simulator';

const KIND_RAIL: Record<TrackKind, string> = {
  main: '#4b5563',
  approach: '#3b4557',
  platform: '#4b5563',
  siding: '#4b5563',
  staging: '#4b5563',
  repair: '#4b5563',
  depot: '#4b5563',
};

const KIND_GLOW: Record<TrackKind, string> = {
  main: '#38bdf8',
  approach: '#64748b',
  platform: '#34d399',
  siding: '#f59e0b',
  staging: '#fbbf24',
  repair: '#fb7185',
  depot: '#c084fc',
};

interface Props {
  snap: SimSnapshot;
  onSelect: (trainId: string) => void;
  onTurntable?: (turntableId: string) => void;
  insets?: ViewInsets;
}

const NO_INSETS: ViewInsets = { left: 0, top: 0, right: 0, bottom: 0 };
const FIELD_PAD = 4000;

export default function TrackCanvasView({ snap, onSelect, onTurntable, insets = NO_INSETS }: Props) {
  const { yard, plan, selection } = snap;
  const { left, top, right, bottom } = insets;
  const canvas = useCanvasView(yard.width, yard.height, { left, top, right, bottom });
  const fieldW = yard.width + FIELD_PAD * 2;
  const fieldH = yard.height + FIELD_PAD * 2;
  const planEdges = useMemo(() => new Set(plan?.edges ?? []), [plan]);
  const onwardEdges = useMemo(() => new Set(plan?.onward ?? []), [plan]);
  const issueNodes = useMemo(() => {
    const map = new Map<string, 'block' | 'warn'>();
    for (const i of [...(plan?.blocks ?? []), ...(plan?.warns ?? [])]) {
      if (!i.nodeId) continue;
      if (i.level === 'block' || !map.has(i.nodeId)) map.set(i.nodeId, i.level);
    }
    return map;
  }, [plan]);

  const planTone = !plan ? '#34d399' : plan.ok ? '#34d399' : '#fb7185';
  const u = Math.min(Math.max(yard.width / 2000, 1), 2);

  return (
    <div ref={canvas.wrapRef} {...canvas.handlers}
      onDoubleClick={(e) => canvas.zoomAtClient(1.6, e.clientX, e.clientY)}
      className={`absolute inset-0 overflow-hidden bg-slate-950 ${canvas.dragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none select-none`}>
      <div style={{ transform: `translate(${canvas.view.tx - FIELD_PAD * canvas.view.scale}px, ${canvas.view.ty - FIELD_PAD * canvas.view.scale}px) scale(${canvas.view.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
    <svg width={fieldW} height={fieldH} className="block" role="img" aria-label={`${yard.spec.name} track layout`}>
      <defs>
        <pattern id="sim-grid" width={40 * u} height={40 * u} patternUnits="userSpaceOnUse">
          <path d={`M${40 * u} 0H0V${40 * u}`} fill="none" stroke="#1e293b" strokeWidth={u} />
        </pattern>
        <filter id="sim-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={fieldW} height={fieldH} fill="#020617" />
      <rect width={fieldW} height={fieldH} fill="url(#sim-grid)" />

      <g transform={`translate(${FIELD_PAD} ${FIELD_PAD})`}>
      {yard.edgeList.map((e) => {
        const claimed = planEdges.has(e.id);
        const onward = onwardEdges.has(e.id);
        return (
          <g key={e.id} fill="none">
            <path d={e.d} stroke="#0b1220" strokeWidth={13} strokeLinecap="round" />
            <path d={e.d} stroke={KIND_RAIL[e.kind]} strokeWidth={7} strokeLinecap="round" />
            {e.speedLimitKmh <= 25 ? (
              <path d={e.d} stroke={KIND_GLOW[e.kind]} strokeOpacity={0.35} strokeWidth={2.5} strokeDasharray="1 9" strokeLinecap="round" />
            ) : null}
            {claimed ? (
              <path d={e.d} stroke={planTone} strokeWidth={3.5} strokeLinecap="round"
                strokeDasharray={onward ? "18 12" : undefined} strokeOpacity={0.95} className="sim-route" />
            ) : null}
          </g>
        );
      })}

      {yard.destinations.map((d) => {
        const n = yard.nodes[d.nodeId];
        if (!n) return null;
        const clash = plan?.destinationId === d.id;
        return (
          <g key={d.id} transform={`translate(${n.pos.x} ${n.pos.y})`}>
            <circle r={7 * u} fill="none" stroke={KIND_GLOW[d.kind]} strokeWidth={2 * u} strokeOpacity={clash ? 1 : 0.45} />
            <text x="0" y={-22 * u} textAnchor="middle" fontSize={17 * u} fontWeight="600" fill={clash ? planTone : '#94a3b8'}>
              {d.label}
            </text>
            <text x="0" y={38 * u} textAnchor="middle" fontSize={13 * u} fill="#64748b">{d.trackLabel}</text>
          </g>
        );
      })}

      {snap.switches.map((s) => {
        const thru = s.state === 'THRU';
        const tone = s.locked ? '#94a3b8' : thru ? '#34d399' : '#fb7185';
        return (
          <g key={s.id} transform={`translate(${s.pos.x} ${s.pos.y})`} className="sim-switch">
            <path d={`M${-13 * u} ${14 * u} L0 ${-15 * u} L${13 * u} ${14 * u} Z`} fill="#0b1220" stroke={tone} strokeWidth={2.5 * u} />
            <circle cx="0" cy={-27 * u} r={5.5 * u} fill={tone} />
            <text y={40 * u} textAnchor="middle" fontSize={14 * u} fontWeight="600" fill="#cbd5e1">{s.label}</text>
            {s.locked ? <Lock x={17 * u} y={-32 * u} size={13 * u} color="#94a3b8" /> : null}
          </g>
        );
      })}

      {snap.turntables.map((tt) => {
        const angle = tt.targetDeg ?? tt.angleDeg;
        const locked = tt.moving;
        return (
          <g key={tt.id} transform={`translate(${tt.pos.x} ${tt.pos.y})`} className="sim-turntable"
            style={{ cursor: onTurntable && !locked ? 'pointer' : 'default' }}
            onClick={onTurntable && !locked ? () => onTurntable(tt.id) : undefined}>
            <circle r={tt.radius + 10} fill="transparent" />
            {tt.ports.map((p) => (
              <line key={p.id} x1={0} y1={0} x2={tt.portRadius} y2={0} transform={`rotate(${p.angleDeg})`} stroke="#334155" strokeWidth="3" />
            ))}
            <circle r={tt.radius} fill={locked ? '#0b1220' : '#111c33'} stroke={locked ? '#475569' : '#38bdf8'} strokeWidth="3" />
            <circle r={tt.radius - 12} fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 7" />
            <g style={{ transform: `rotate(${angle}deg)`, transition: tt.moving ? 'transform 1.1s linear' : 'none' }}>
              <rect x={-tt.radius + 7} y={-9} width={tt.radius * 2 - 14} height={18} rx="3"
                fill="#38bdf8" fillOpacity={0.28} stroke="#38bdf8" strokeWidth="2" />
            </g>
            <circle r="6" fill="#38bdf8" />
            <text y={tt.radius + 34 * u} textAnchor="middle" fontSize={14 * u} fontWeight="600" fill={locked ? '#64748b' : '#bae6fd'}>
              {tt.id} · {Math.round(angle)}°
            </text>
            {tt.moving ? (
              <g transform={`translate(0 ${-tt.radius - 38 * u})`}>
                <circle r={11 * u} fill="#0f172a" stroke="#38bdf8" strokeWidth={2 * u} />
                <path d={`M${-4 * u} ${-4 * u} L${4 * u} 0 L${-4 * u} ${4 * u}`} fill="none" stroke="#38bdf8" strokeWidth={2 * u} />
              </g>
            ) : null}
          </g>
        );
      })}

      {snap.signals.map((s) => (
        <g key={s.nodeId} transform={`translate(${s.pos.x} ${s.pos.y}) rotate(${s.rot})`}>
          <rect x={-10 * u} y={-10 * u} width={20 * u} height={20 * u} rx="3" fill="#0b1220" stroke="#334155" strokeWidth={2 * u} />
          <circle cx="0" cy="0" r={5.5 * u} fill={s.state === 'clear' ? '#34d399' : '#f43f5e'} />
        </g>
      ))}

      {[...issueNodes].map(([nodeId, level]) => {
        const n = yard.nodes[nodeId];
        if (!n) return null;
        return (
          <g key={nodeId} transform={`translate(${n.pos.x} ${n.pos.y})`} className="sim-issue">
            <circle r={15 * u} fill="none" stroke={level === 'block' ? '#fb7185' : '#fbbf24'} strokeWidth={2.5 * u} />
          </g>
        );
      })}

      {snap.trains.map((t) => (
        <TrainUnit key={t.id} train={t} selected={selection === t.id} onSelect={onSelect} />
      ))}

      {snap.crashes.map((c) => (
        <g key={c.id} transform={`translate(${c.x} ${c.y})`} className="sim-crash">
          {[0, 0.9].map((d) => (
            <circle key={d} r="34" fill="none" stroke="#f43f5e" strokeWidth="3"
              style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${d}s` }} />
          ))}
          <circle r="30" fill="#f43f5e" fillOpacity={0.14} />
          <text y="-44" textAnchor="middle" fontSize="15" fontWeight="600" fill="#f43f5e">{c.text}</text>
        </g>
      ))}

      {snap.banner ? (
        <g transform={`translate(${yard.width / 2} 70)`}>
          <rect x="-190" y="-26" width="380" height="44" rx="10" fill="#0f172a" fillOpacity={0.92} stroke="#334155" />
          <text y="4" textAnchor="middle" fontSize="18" fontWeight="600" fill={bannerTone(snap.banner.tone)}>{snap.banner.text}</text>
        </g>
      ) : null}
      </g>
    </svg>
      </div>

      <div className="glass absolute bottom-32 right-4 z-20 flex flex-col items-center gap-1 rounded-lg p-1">
        <ZoomBtn label="Zoom in" onClick={() => { playSfx('progress-step', 0.45); canvas.zoomBy(1.25); }}>
          <Plus size={16} />
        </ZoomBtn>
        <ZoomBtn label="Zoom out" onClick={() => { playSfx('progress-step', 0.45); canvas.zoomBy(0.8); }}>
          <Minus size={16} />
        </ZoomBtn>
        <ZoomBtn label="Fit layout" onClick={() => { playSfx('collapse', 0.5); canvas.reset(); }}>
          <Maximize2 size={16} />
        </ZoomBtn>
        <span className="font-mono text-[10px] text-slate-400">{Math.round(canvas.view.scale * 100)}%</span>
      </div>
    </div>
  );
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-200 transition hover:bg-sky-400 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
      {children}
    </button>
  );
}

function bannerTone(tone: 'bad' | 'warn' | 'good'): string {
  return tone === 'bad' ? '#fb7185' : tone === 'warn' ? '#fbbf24' : '#34d399';
}

function TrainUnit({ train, selected, onSelect }: { train: SimTrain; selected: boolean; onSelect: (id: string) => void }) {
  const wrecked = train.state === 'DERAILED';
  const held = train.state === 'HOLDING';
  return (
    <g onClick={() => onSelect(train.id)} className="sim-train" style={{ cursor: 'pointer' }}>
      {train.cars1.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
          <rect x="-21" y="-9" width="42" height="18" rx="3"
            fill={wrecked ? '#450a0a' : '#1e293b'} stroke={wrecked ? '#f43f5e' : train.color} strokeWidth="2" />
          {i % 2 === 0 ? <rect x="-14" y="-5" width="9" height="10" rx="2" fill={train.accent} fillOpacity={0.55} /> : null}
        </g>
      ))}
      <g transform={`translate(${train.x} ${train.y}) rotate(${train.rot})`}>
        <path d="M-8 -10 H9 L19 0 L9 10 H-8 Z" fill={wrecked ? '#7f1d1d' : train.color} stroke={wrecked ? '#f43f5e' : '#020617'} strokeWidth="1.5" />
        <text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="700" fill="#020617">{train.id.split('-')[0]}</text>
        <circle cx="16" cy="0" r="2.4" fill={wrecked ? '#f43f5e' : '#fef9c3'} filter="url(#sim-glow)" />
      </g>
      {selected ? (
        <g transform={`translate(${train.x} ${train.y})`}>
          <circle r="24" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="5 5" />
          <text y="-30" textAnchor="middle" fontSize="14" fontWeight="700" fill="#e2e8f0">{train.id}</text>
        </g>
      ) : null}
      {held && !wrecked ? (
        <g transform={`translate(${train.x + 26} ${train.y - 26})`}>
          <circle r="9" fill="#0f172a" stroke="#fbbf24" strokeWidth="2" />
          <TriangleAlert x={-7} y={-7} size={14} color="#fbbf24" />
        </g>
      ) : null}
      {wrecked ? (
        <g transform={`translate(${train.x} ${train.y})`}>
          <Wrench x={-26} y={-10} size={18} color="#f43f5e" />
        </g>
      ) : null}
    </g>
  );
}

export function trackKindTone(kind: TrackKind): string {
  return KIND_GLOW[kind];
}

export function nodePos(yard: SimSnapshot['yard'], nodeId: string): Vec | undefined {
  return yard.nodes[nodeId]?.pos;
}