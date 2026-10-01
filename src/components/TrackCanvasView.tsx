import { MockTrainOnTrack, Switch, Track, Turntable } from '../types/simulator';
import { MOCK_TRAINS } from '../data/mock';

const TRACKS: Track[] = [
  { id: 'M1', kind: 'main', label: 'Main 1', path: 'M0 240 H1600' },
  { id: 'M2', kind: 'main', label: 'Main 2', path: 'M0 300 H500 C560 300 540 400 620 400' },
  { id: 'M2b', kind: 'main', label: 'Main 2 (thru)', path: 'M500 300 H1600' },
  { id: 'P3', kind: 'platform', label: 'Platform 3', path: 'M620 400 H1100 C1180 400 1220 470 1300 480' },
  { id: 'P4', kind: 'platform', label: 'Platform 4', path: 'M700 400 C750 400 730 470 790 470 H1060' },
  { id: 'S1', kind: 'siding', label: 'Siding 1', path: 'M790 470 C830 470 820 540 870 540 H1020' },
];

interface Props { switches: Switch[]; turntable: Turntable; collision?: { x: number; y: number } }

export default function TrackCanvasView({ switches, turntable, collision = { x: 700, y: 400 } }: Props) {
  const spokes = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
  return (
    <svg viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full bg-slate-950" role="img" aria-label="Station track layout">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1e293b" strokeWidth="1" /></pattern>
      </defs>
      <rect width="1600" height="800" fill="url(#grid)" />

      <rect x="800" y="415" width="260" height="40" rx="4" fill="#334155" />
      <text x="930" y="440" textAnchor="middle" fontSize="14" fill="#94a3b8">Platform 3 / 4</text>
      <rect x="1020" y="528" width="14" height="24" fill="#f43f5e" />
      <text x="870" y="580" fontSize="13" fill="#64748b">Siding 1</text>

      {TRACKS.map((t) => (
        <g key={t.id} fill="none">
          <path d={t.path} stroke="#0f172a" strokeWidth="12" />
          <path d={t.path} stroke="#475569" strokeWidth="4" />
          <path d={t.path} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 10" />
        </g>
      ))}
      <text x="20" y="228" fontSize="13" fill="#64748b">Inbound West</text>
      <text x="20" y="288" fontSize="13" fill="#64748b">Main 2</text>

      <g transform={`translate(${turntable.x} ${turntable.y})`}>
        {spokes.map((a) => <line key={a} x1={turntable.radius} y1="0" x2={turntable.radius + 70} y2="0" stroke="#475569" strokeWidth="4" transform={`rotate(${a})`} />)}
        <circle r={turntable.radius} fill="#0b1220" stroke="#64748b" strokeWidth="3" />
        <circle r={turntable.radius - 10} fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 6" />
        <g style={{ transform: `rotate(${turntable.angleDeg}deg)`, transition: 'transform .6s ease' }}>
          <rect x={-turntable.radius + 6} y="-9" width={turntable.radius * 2 - 12} height="18" rx="3" fill="#38bdf8" fillOpacity=".25" stroke="#38bdf8" strokeWidth="2" />
          <line x1={-turntable.radius + 10} x2={turntable.radius - 10} y1="0" y2="0" stroke="#38bdf8" strokeWidth="2" />
        </g>
        <circle r="7" fill="#38bdf8" />
        <text y={turntable.radius + 98} textAnchor="middle" fontSize="13" fill="#64748b">TT-01</text>
      </g>

      {switches.map((s) => {
        const c = s.state === 'THRU' ? '#34d399' : '#f43f5e';
        return (
          <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
            <path d="M-12 12 L0 -14 L12 12 Z" fill="#0f172a" stroke={c} strokeWidth="2.5" />
            <circle cx="0" cy="-26" r="6" fill={c} />
            <text y="34" textAnchor="middle" fontSize="12" fill="#cbd5e1">{s.id}</text>
          </g>
        );
      })}

      {MOCK_TRAINS.map((t) => <TrainUnit key={t.trainId} train={t} />)}

      <g transform={`translate(${collision.x} ${collision.y})`}>
        {[0, 0.9].map((d) => (
          <circle key={d} r="40" fill="none" stroke="#f43f5e" strokeWidth="3" className="animate-ripple" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDelay: `${d}s` }} />
        ))}
        <circle r="38" fill="#f43f5e" fillOpacity=".12" />
        <text y="-52" textAnchor="middle" fontSize="13" fontWeight="600" fill="#f43f5e">Conflict risk</text>
      </g>
    </svg>
  );
}

function TrainUnit({ train }: { train: MockTrainOnTrack }) {
  const L = 44, G = 6;
  return (
    <g transform={`translate(${train.x} ${train.y}) rotate(${train.rotation})`}>
      {Array.from({ length: train.cars }).map((_, i) => (
        <rect key={i} x={-(i + 1) * (L + G) - L} y="-9" width={L} height="18" rx="3" fill="#1e293b" stroke={train.color} strokeWidth="2" />
      ))}
      <path d={`M${-L} -10 H8 L${L / 2 + 6} 0 L8 10 H${-L} Z`} fill={train.color} />
      <text x={-L / 2 + 2} y="4" fontSize="10" fontWeight="700" fill="#020617" textAnchor="middle">{train.trainId.split('-')[0]}</text>
    </g>
  );
}
