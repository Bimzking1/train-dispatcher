export type StationTier = 1 | 2 | 3;

export type TrainType = 'Express' | 'Freight' | 'Commuter' | 'Shuttle';

export type RouteRequest = 'PASS' | 'STOP_BY' | 'LAST_STOP' | 'REPAIR';

export type SwitchState = 'THRU' | 'DIVERGENT';

export type SwitchRole = 'toe' | 'thru' | 'diverge';

export type TrackKind = 'main' | 'platform' | 'siding' | 'repair' | 'staging' | 'depot' | 'approach';

export type SimSpeed = 0 | 1 | 2 | 5;

export type NodeKind = 'portal_in' | 'portal_out' | 'switch' | 'buffer' | 'merge' | 'tt_port';

export type TrainState =
  | 'INBOUND'
  | 'HOLDING'
  | 'RUNNING'
  | 'DWELL'
  | 'REPAIRING'
  | 'DERAILED'
  | 'DEPARTED'
  | 'CLEARED';

export type IssueLevel = 'block' | 'warn';

export interface Vec {
  x: number;
  y: number;
}

export interface Polyline {
  pts: Vec[];
  cum: number[];
  lengthM: number;
}

export interface StationSpec {
  id: string;
  name: string;
  tier: StationTier;
  subtitle: string;
  blurb: string;
  mainLines: number;
  platformTracks: number;
  sidings: number;
  repairBays: number;
  turntables: number;
  lineLengthM: number;
  maxTrains: number;
  switchComplexity: 'Low' | 'Medium' | 'High';
  difficulty: number;
  layout: string[];
}

export interface TrackNode {
  id: string;
  kind: NodeKind;
  pos: Vec;
  label?: string;
  sub?: string;
}

export interface TrackEdge {
  id: string;
  from: string;
  to: string;
  kind: TrackKind;
  label?: string;
  role?: SwitchRole;
  speedLimitKmh: number;
  line: Polyline;
  d: string;
}

export interface SwitchDef {
  id: string;
  nodeId: string;
  pos: Vec;
  toe: string;
  thru: string;
  diverge: string;
  state: SwitchState;
  locked: boolean;
  lockedBy: string | null;
  label: string;
}

export interface TurntablePort {
  id: string;
  nodeId: string;
  angleDeg: number;
  role: 'lead' | 'stall';
  name: string;
}

export interface Turntable {
  id: string;
  pos: Vec;
  radius: number;
  portRadius: number;
  angleDeg: number;
  targetDeg: number | null;
  moving: boolean;
  speedLimitKmh: number;
  ports: TurntablePort[];
}

export interface Destination {
  id: string;
  nodeId: string;
  label: string;
  kind: TrackKind;
  sub: string;
  accepts: RouteRequest[];
  trackLabel: string;
  capacityM: number;
}

export interface Yard {
  spec: StationSpec;
  width: number;
  height: number;
  nodes: Record<string, TrackNode>;
  edges: Record<string, TrackEdge>;
  edgeList: TrackEdge[];
  switches: SwitchDef[];
  turntables: Turntable[];
  entries: string[];
  exits: string[];
  destinations: Destination[];
  entryLanes: { nodeId: string; label: string; laneY: number }[];
}

export interface BridgeEdge extends TrackEdge {
  turntableId: string;
  portA: string;
  portB: string;
}

export interface RoutePlan {
  trainId: string;
  fromNode: string;
  toNode: string;
  destinationId: string;
  destinationLabel: string;
  inbound: string[];
  onward: string[];
  edges: string[];
  nodes: string[];
  legIndex: number;
  required: { switchId: string; state: SwitchState }[];
  blocks: Issue[];
  warns: Issue[];
  lengthM: number;
  arrivalSpeedKmh: number;
  ok: boolean;
}

export interface Issue {
  level: IssueLevel;
  code: string;
  text: string;
  nodeId?: string;
  switchId?: string;
  edgeId?: string;
}

export interface TrainSpec {
  id: string;
  type: TrainType;
  cars: number;
  lengthM: number;
  maxSpeedKmh: number;
  accel: number;
  brake: number;
  color: string;
  accent: string;
  name: string;
}

export interface SimTrain {
  id: string;
  name: string;
  spec: TrainSpec;
  type: TrainType;
  request: RouteRequest;
  cars: number;
  lengthM: number;
  maxSpeedKmh: number;
  accel: number;
  brake: number;
  color: string;
  accent: string;

  state: TrainState;
  speedKmh: number;

  path: string[];
  nodes: string[];
  edgeIndex: number;
  distM: number;
  stopEdge: number;
  dir: 1 | -1;
  service: string;
  backing: boolean;

  x: number;
  y: number;
  rot: number;

  entryNode: string;
  entryY: number;
  scheduledSec: number;
  arrivedSec: number | null;

  holdTimer: number;
  patience: number;
  patienceMax: number;

  plan: RoutePlan | null;
  destLabel: string;
  dwell: number;
  serviceLeft: number;

  cars1: { x: number; y: number; rot: number }[];
  blink: number;
  smoke: number;
}

export interface ScoreStats {
  onTimeRate: number;
  collisionAlerts: number;
  processed: number;
  score: number;
  incidents: number;
  derailments: number;
  held: number;
  repairs: number;
  late: number;
}

export interface LogEntry {
  id: number;
  sec: number;
  level: 'info' | 'good' | 'warn' | 'bad';
  text: string;
}

export interface CrashFx {
  id: number;
  x: number;
  y: number;
  t: number;
  text: string;
  kind: 'derail' | 'collision';
}

export interface SignalAspect {
  nodeId: string;
  pos: Vec;
  rot: number;
  state: 'danger' | 'clear';
}

export interface SimSnapshot {
  sec: number;
  speed: SimSpeed;
  yard: Yard;
  trains: SimTrain[];
  switches: SwitchDef[];
  turntables: Turntable[];
  stats: ScoreStats;
  log: LogEntry[];
  crashes: CrashFx[];
  selection: string | null;
  plan: RoutePlan | null;
  options: Destination[];
  upcoming: { id: string; type: TrainType; name: string; request: RouteRequest; dueInSec: number }[];
  signals: SignalAspect[];
  allStop: boolean;
  muted: boolean;
  banner: { text: string; tone: 'bad' | 'warn' | 'good' } | null;
}