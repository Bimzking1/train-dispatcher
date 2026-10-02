import type {
  CrashFx,
  Destination,
  Issue,
  LogEntry,
  RoutePlan,
  RouteRequest,
  ScoreStats,
  SignalAspect,
  SimSnapshot,
  SimSpeed,
  SimTrain,
  TrainSpec,
  TrainType,
  Turntable,
} from '../types/simulator';
import { getYard } from '../data/layouts';
import { headingAt, pointAt, PX_PER_M } from './geometry';
import { buildGraph, turntableAlignments, turntableLive, type Graph } from './graph';
import { emptyOcc, planRoute, type Occ } from './routing';

const KMH = 3.6;
const HOLD_M = 6;
const DWELL_SEC = 13;
const REPAIR_SEC = 26;
const CRASH_PX = 17;
const LATE_HOLD_SEC = 40;

export const TRAIN_SPECS: Record<TrainType, TrainSpec> = {
  Express: { id: 'express', type: 'Express', cars: 6, lengthM: 148, maxSpeedKmh: 200, accel: 0.7, brake: 1.0, color: '#38bdf8', accent: '#e0f2fe', name: 'Express' },
  Commuter: { id: 'commuter', type: 'Commuter', cars: 4, lengthM: 96, maxSpeedKmh: 130, accel: 0.95, brake: 1.2, color: '#34d399', accent: '#d1fae5', name: 'Commuter' },
  Freight: { id: 'freight', type: 'Freight', cars: 9, lengthM: 262, maxSpeedKmh: 80, accel: 0.22, brake: 0.45, color: '#f59e0b', accent: '#fef3c7', name: 'Freight' },
  Shuttle: { id: 'shuttle', type: 'Shuttle', cars: 2, lengthM: 48, maxSpeedKmh: 60, accel: 1.1, brake: 1.5, color: '#c084fc', accent: '#f3e8ff', name: 'Shuttle' },
};

export const REQUEST_META: Record<RouteRequest, { label: string; short: string; blurb: string; tone: string }> = {
  PASS: { label: 'Pass through', short: 'PASS', blurb: 'Run straight through, no stop.', tone: 'sky' },
  STOP_BY: { label: 'Stop by', short: 'STOP', blurb: 'Berth at a platform, dwell, then continue on.', tone: 'emerald' },
  LAST_STOP: { label: 'Final destination', short: 'LAST', blurb: 'Take the road and stand there.', tone: 'amber' },
  REPAIR: { label: 'Needs repair', short: 'FIX', blurb: 'Stall it in a workshop road.', tone: 'rose' },
};

interface Spawn {
  id: string;
  type: TrainType;
  request: RouteRequest;
  scheduledSec: number;
}

interface Schedule {
  types: TrainType[];
  requests: RouteRequest[];
  gap: number;
  first: number;
}

const SCHEDULES: Record<string, Schedule> = {
  local: {
    types: ['Commuter', 'Express', 'Freight', 'Shuttle', 'Commuter', 'Express', 'Freight', 'Shuttle', 'Express', 'Commuter'],
    requests: ['PASS', 'STOP_BY', 'LAST_STOP', 'REPAIR', 'PASS', 'STOP_BY', 'LAST_STOP', 'REPAIR', 'PASS', 'STOP_BY'],
    gap: 150,
    first: 16,
  },
  grand: {
    types: ['Express', 'Commuter', 'Commuter', 'Freight', 'Shuttle', 'Express', 'Commuter', 'Freight', 'Shuttle', 'Express', 'Commuter', 'Shuttle'],
    requests: ['STOP_BY', 'PASS', 'STOP_BY', 'LAST_STOP', 'REPAIR', 'PASS', 'STOP_BY', 'LAST_STOP', 'REPAIR', 'PASS', 'STOP_BY', 'LAST_STOP'],
    gap: 165,
    first: 14,
  },
  freight: {
    types: ['Freight', 'Freight', 'Express', 'Commuter', 'Freight', 'Shuttle', 'Freight', 'Express', 'Freight', 'Commuter', 'Freight', 'Shuttle'],
    requests: ['PASS', 'LAST_STOP', 'REPAIR', 'PASS', 'LAST_STOP', 'LAST_STOP', 'REPAIR', 'PASS', 'LAST_STOP', 'PASS', 'LAST_STOP', 'REPAIR'],
    gap: 200,
    first: 12,
  },
};

function freshStats(): ScoreStats {
  return { onTimeRate: 100, collisionAlerts: 0, processed: 0, score: 1200, incidents: 0, derailments: 0, held: 0, repairs: 0, late: 0 };
}

function shortId(type: TrainType, n: number): string {
  const code: Record<TrainType, string> = { Express: 'EX', Commuter: 'CM', Freight: 'FR', Shuttle: 'SH' };
  return `${code[type]}-${100 + ((n * 7) % 89)}`;
}

function wrap360(a: number): number {
  return (((a % 360) + 360) % 360);
}

function signedDelta(a: number): number {
  const v = wrap360(a);
  return v > 180 ? v - 360 : v;
}

function pad(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

export function clockOf(sec: number): string {
  const s = Math.floor(sec) + 14 * 3600 + 32 * 60;
  return `${pad((s / 3600) % 24)}:${pad((s / 60) % 60)}:${pad(s % 60)}`;
}

export class SimulationEngine {
  readonly stationId: string;
  yard = getYard('local');
  graph: Graph;
  trains: SimTrain[] = [];
  stats = freshStats();
  log: LogEntry[] = [];
  crashes: CrashFx[] = [];
  selection: string | null = null;
  selectedDest: string | null = null;
  sec = 0;
  speed: SimSpeed = 1;
  muted = false;
  allStop = false;

  private schedule: Spawn[] = [];
  private spawnIdx = 0;
  private spawnEdgeId = '';
  private logId = 1;
  private fxId = 1;
  private occ: Occ = emptyOcc();
  private stuck = new Map<string, number>();
  private lateClears = 0;
  private realSec = 0;
  private banner: { text: string; tone: 'bad' | 'warn' | 'good'; until: number } | null = null;
  private serial = 0;

  constructor(stationId: string) {
    this.stationId = stationId;
    this.yard = getYard(stationId);
    this.graph = buildGraph(this.yard);
    this.spawnEdgeId = this.spawnEdge();
    this.schedule = this.buildSchedule();
    const tt = this.yard.turntables.length;
    this.pushLog('info', `${this.yard.spec.name} in service · ${this.yard.switches.length} point${this.yard.switches.length === 1 ? '' : 's'} · ${tt} turntable${tt === 1 ? '' : 's'} · ${Math.round(this.yard.spec.lineLengthM)} m of route`);
    this.pushLog('info', `First movement signalled in ${this.schedule[0]?.scheduledSec ?? 0}s — set its road before it arrives.`);
  }

  private buildSchedule(): Spawn[] {
    const plan = SCHEDULES[this.stationId] ?? SCHEDULES.local;
    const out: Spawn[] = [];
    for (let i = 0; i < plan.types.length; i++) {
      out.push({
        id: shortId(plan.types[i], i + 1),
        type: plan.types[i],
        request: plan.requests[i % plan.requests.length],
        scheduledSec: plan.first + i * plan.gap,
      });
    }
    return out;
  }

  private get entryNode(): string {
    return this.yard.entries[0];
  }

  private spawnEdge(): string {
    const e = this.yard.edgeList.find((x) => x.from === this.entryNode);
    return e ? e.id : this.yard.edgeList[0].id;
  }

  train(id: string | null | undefined): SimTrain | undefined {
    return id ? this.trains.find((t) => t.id === id) : undefined;
  }

  switchDef(id: string) {
    return this.yard.switches.find((s) => s.id === id);
  }

  turntable(id: string): Turntable | undefined {
    return this.yard.turntables.find((t) => t.id === id);
  }

  setSpeed(v: SimSpeed) {
    this.speed = v;
    if (v !== 0) this.allStop = false;
  }

  togglePause() {
    this.setSpeed(this.speed === 0 ? 1 : 0);
  }

  setAllStop() {
    this.allStop = true;
    this.speed = 0;
    this.pushLog('bad', 'ALL-STOP asserted — the whole layout is frozen');
    this.flash('All-Stop asserted', 'bad');
  }

  toggleMute() {
    this.muted = !this.muted;
  }

  select(trainId: string | null) {
    this.selection = trainId;
    if (!trainId) {
      this.selectedDest = null;
      return;
    }
    const t = this.train(trainId);
    this.selectedDest = t ? this.firstReachable(t)?.id ?? null : null;
  }

  preview(trainId: string, destId: string) {
    this.selection = trainId;
    this.selectedDest = destId;
  }

  routable(t: SimTrain): boolean {
    return (t.state === 'INBOUND' || t.state === 'HOLDING') && !t.plan;
  }

  options(t: SimTrain | undefined): Destination[] {
    if (!t) return [];
    return this.yard.destinations.filter((d) => d.accepts.includes(t.request));
  }

  private firstReachable(t: SimTrain): Destination | undefined {
    const opts = this.options(t);
    for (const d of opts) {
      const p = this.routeFor(t.id, d.id);
      if (p?.ok) return d;
    }
    return opts[0];
  }

  routeFor(trainId: string, destId: string | null): RoutePlan | null {
    const t = this.train(trainId);
    if (!t || !destId) return null;
    const dest = this.yard.destinations.find((d) => d.id === destId);
    if (!dest) return null;
    return planRoute({
      yard: this.yard,
      graph: this.graph,
      train: t,
      fromNode: this.entryNode,
      dest,
      approachEdges: [],
      switches: this.yard.switches,
      occ: this.occ,
      turntableIssue: this.turntableHint(this.entryNode, dest),
      ignorePoints: true,
    });
  }

  private turntableHint(from: string, dest: Destination): Issue | null {
    for (const tt of this.yard.turntables) {
      if (tt.moving) {
        return { level: 'warn', code: 'turntable', text: `${tt.id} is still turning` };
      }
      if (this.servesWith(tt, tt.angleDeg, from, dest)) continue;
      const wanted: number[] = [];
      for (const a of turntableAlignments(tt)) {
        if (this.servesWith(tt, a, from, dest)) wanted.push(a);
      }
      if (wanted.length) {
        const label = wanted.map((a) => `${Math.round(a)}°`).join(' or ');
        return { level: 'warn', code: 'turntable', text: `${tt.id} must be turned to ${label} to open the road to ${dest.label}` };
      }
    }
    return null;
  }

  private servesWith(tt: Turntable, angle: number, from: string, dest: Destination): boolean {
    const keep = { angle: tt.angleDeg, moving: tt.moving, target: tt.targetDeg };
    tt.angleDeg = angle;
    tt.moving = false;
    tt.targetDeg = null;
    const found = graphHas(buildGraph(this.yard), from, dest.nodeId);
    tt.angleDeg = keep.angle;
    tt.moving = keep.moving;
    tt.targetDeg = keep.target;
    this.graph = buildGraph(this.yard);
    return found;
  }

  dispatch(trainId: string, destId: string): { ok: boolean; plan: RoutePlan | null } {
    const t = this.train(trainId);
    const dest = this.yard.destinations.find((d) => d.id === destId);
    if (!t || !dest) return { ok: false, plan: null };
    if (!this.routable(t)) {
      this.pushLog('warn', `${t.id} is already under way — its route can no longer be changed`);
      return { ok: false, plan: null };
    }
    if (!dest.accepts.includes(t.request)) {
      this.pushLog('warn', `${dest.label} cannot accept a ${REQUEST_META[t.request].short} movement`);
      this.flash(`${dest.label} rejected ${t.id}`, 'warn');
      return { ok: false, plan: null };
    }
    const plan = this.routeFor(trainId, destId);
    if (!plan) return { ok: false, plan: null };
    if (!plan.ok) {
      for (const b of plan.blocks.slice(0, 4)) this.pushLog('bad', `${t.id}: ${b.text}`);
      this.flash(`No route for ${t.id}`, 'bad');
      return { ok: false, plan };
    }
    for (const r of plan.required) {
      const sw = this.switchDef(r.switchId);
      if (!sw) continue;
      sw.state = r.state;
      sw.locked = true;
      sw.lockedBy = t.id;
    }
    t.plan = plan;
    t.path = [...plan.edges];
    t.nodes = [...plan.nodes];
    t.edgeIndex = 0;
    t.stopEdge = t.request === 'PASS' ? -1 : plan.legIndex - 1;
    t.dir = 1;
    t.destLabel = dest.label;
    t.state = 'RUNNING';
    t.service = `running to ${dest.label}`;
    if (t.arrivedSec === null) t.arrivedSec = this.sec;
    t.holdTimer = 0;
    this.selection = trainId;
    this.selectedDest = null;
    const pts = plan.required.map((r) => `${r.switchId} ${r.state === 'THRU' ? 'N' : 'R'}`).join(', ') || 'no points';
    this.pushLog('good', `${t.id} → ${dest.label} · ${Math.round(plan.lengthM)} m · ${pts}`);
    if (plan.warns.length) this.pushLog('warn', `${t.id}: ${plan.warns[0].text}`);
    return { ok: true, plan };
  }

  release(trainId: string) {
    const t = this.train(trainId);
    if (!t || !t.plan) return;
    const atEntry = t.path[t.edgeIndex] === this.spawnEdgeId && t.edgeIndex === 0;
    if (!atEntry && t.state === 'RUNNING') {
      this.pushLog('warn', `${t.id} has already entered the layout — the road cannot be cancelled`);
      return;
    }
    this.unlock(t.id);
    t.plan = null;
    t.path = [this.spawnEdge()];
    t.nodes = [this.entryNode, this.graph.edges[this.spawnEdge()].to];
    t.edgeIndex = 0;
    t.distM = Math.min(t.distM, 0);
    t.stopEdge = -1;
    t.destLabel = '';
    t.service = 'held at the entry signal';
    t.state = 'HOLDING';
    t.speedKmh = 0;
    this.pushLog('info', `${t.id} cancelled and held at the entry signal`);
  }

  private unlock(trainId: string) {
    for (const sw of this.yard.switches) {
      if (sw.lockedBy !== trainId) continue;
      sw.locked = false;
      sw.lockedBy = null;
    }
  }

  toggleSwitch(id: string) {
    const sw = this.switchDef(id);
    if (!sw) return;
    if (sw.locked) {
      this.pushLog('warn', `${sw.id} is locked by ${sw.lockedBy} — the approach is not clear`);
      this.flash(`${sw.id} locked`, 'warn');
      return;
    }
    sw.state = sw.state === 'THRU' ? 'DIVERGENT' : 'THRU';
    this.pushLog('info', `${sw.id} thrown ${sw.state === 'THRU' ? 'normal' : 'reverse'}`);
  }

  rotateTurntable(id: string, angleDeg: number) {
    const tt = this.turntable(id);
    if (!tt) return;
    const target = wrap360(Math.round(angleDeg / 45) * 45);
    if (Math.abs(signedDelta(target - tt.angleDeg)) < 0.5) return;
    const clash = this.trains.find(
      (t) => t.state !== 'CLEARED' && Math.hypot(t.x - tt.pos.x, t.y - tt.pos.y) < tt.radius + 80,
    );
    if (clash) {
      this.pushLog('bad', `${id} refused — ${clash.id} is standing on the deck`);
      this.flash(`${id} obstructed by ${clash.id}`, 'bad');
      return;
    }
    tt.targetDeg = target;
    tt.moving = true;
    this.pushLog('info', `${id} turning to ${Math.round(target)}°`);
  }

  tick(dtReal: number) {
    const raw = Math.min(0.2, Math.max(0, dtReal));
    this.realSec += raw;
    if (this.banner && this.realSec > this.banner.until) this.banner = null;
    for (const c of this.crashes) c.t += raw;
    if (this.crashes.length) this.crashes = this.crashes.filter((c) => c.t < 3.4);
    if (this.allStop || this.speed === 0) {
      this.refreshPoses();
      return;
    }
    const dt = raw * this.speed;
    this.sec += dt;
    this.spawnDue();
    this.stepTurntables(dt);
    this.rebuildOccupancy();
    for (const t of this.trains) this.stepTrain(t, dt);
    this.detectCollisions();
    this.breakDeadlocks(dt);
    this.rebuildOccupancy();
    for (const t of this.trains) {
      if (!this.routable(t)) continue;
      t.holdTimer += dt;
      if (t.holdTimer > t.patience) {
        t.holdTimer = 0;
        this.stats.late++;
        this.stats.incidents++;
        this.derail(t, 'held at the entry signal past its patience limit');
      }
    }
    this.stats.held = this.trains.filter((t) => this.routable(t)).length;
    if (this.banner && this.sec > this.banner.until) this.banner = null;
  }

  private refreshPoses() {
    for (const t of this.trains) this.syncPose(t);
  }

  private stepTurntables(dt: number) {
    let moved = false;
    for (const tt of this.yard.turntables) {
      if (tt.targetDeg === null) continue;
      const d = signedDelta(tt.targetDeg - tt.angleDeg);
      const step = 12 * dt;
      if (Math.abs(d) <= step) {
        tt.angleDeg = wrap360(tt.targetDeg);
        tt.targetDeg = null;
        tt.moving = false;
        this.pushLog('good', `${tt.id} locked on ${Math.round(tt.angleDeg)}°`);
      } else {
        tt.angleDeg = wrap360(tt.angleDeg + Math.sign(d) * step);
        moved = true;
      }
    }
    if (moved) this.graph = buildGraph(this.yard);
  }

  private spawnDue() {
    while (this.spawnIdx < this.schedule.length) {
      const s = this.schedule[this.spawnIdx];
      if (this.sec < s.scheduledSec) return;
      const live = this.trains.filter((t) => t.state !== 'CLEARED').length;
      if (live >= this.yard.spec.maxTrains) return;
      const waiting = this.trains.filter((t) => this.routable(t)).length;
      if (waiting >= 2) return;
      this.spawnIdx++;
      this.spawn(s);
    }
  }

  private spawn(s: Spawn) {
    if (this.train(s.id)) return;
    const spec = TRAIN_SPECS[s.type];
    const serial = ++this.serial;
    const edgeId = this.spawnEdge();
    const edge = this.graph.edges[edgeId];
    const patience = 150 + ((serial * 41) % 90);
    const lane = this.yard.entryLanes[0];
    let start = -(spec.lengthM + 30);
    for (const o of this.trains) {
      if (o.state === 'CLEARED' || o.path[o.edgeIndex] !== edgeId) continue;
      start = Math.min(start, o.distM - o.lengthM - 34);
    }
    const t: SimTrain = {
      id: s.id,
      spec,
      type: s.type,
      request: s.request,
      cars: spec.cars,
      lengthM: spec.lengthM,
      maxSpeedKmh: spec.maxSpeedKmh,
      accel: spec.accel,
      brake: spec.brake,
      color: spec.color,
      accent: spec.accent,
      name: `${spec.name} ${s.id}`,
      state: 'INBOUND',
      speedKmh: 0,
      path: [edgeId],
      nodes: [edge.from, edge.to],
      edgeIndex: 0,
      distM: start,
      stopEdge: -1,
      dir: 1,
      service: 'approaching',
      backing: false,
      x: edge.line.pts[0].x,
      y: edge.line.pts[0].y,
      rot: 0,
      entryNode: lane?.nodeId ?? edge.from,
      entryY: lane?.laneY ?? edge.line.pts[0].y,
      scheduledSec: s.scheduledSec,
      arrivedSec: null,
      holdTimer: 0,
      patience,
      patienceMax: patience,
      plan: null,
      destLabel: '',
      dwell: 0,
      serviceLeft: 0,
      cars1: [],
      blink: (serial * 0.17) % 1,
      smoke: (serial * 0.11) % 1,
    };
    this.syncPose(t);
    this.trains.push(t);
    this.pushLog('info', `${t.name} approaching — ${REQUEST_META[s.request].short}: ${REQUEST_META[s.request].label.toLowerCase()}`);
  }

  private stepTrain(t: SimTrain, dt: number) {
    t.blink = (t.blink + dt * 2.2) % 1;
    t.smoke = (t.smoke + dt * 1.1) % 1;

    if (t.state === 'DWELL' || t.state === 'REPAIRING') {
      t.speedKmh = 0;
      const total = t.state === 'REPAIRING' ? REPAIR_SEC : DWELL_SEC;
      t.dwell += dt;
      t.serviceLeft = Math.max(0, total - t.dwell);
      this.syncPose(t);
      if (t.dwell >= total) this.endService(t);
      return;
    }
    if (t.state === 'DEPARTED') {
      t.speedKmh = 0;
      t.holdTimer += dt;
      if (t.holdTimer > 2.4) {
        t.state = 'CLEARED';
        this.unlock(t.id);
      }
      return;
    }
    if (t.state === 'DERAILED') {
      t.speedKmh = 0;
      t.holdTimer += dt;
      if (t.holdTimer > 24) {
        t.state = 'CLEARED';
        t.service = 'wreck cleared';
        this.pushLog('info', `${t.id} cut away — the road is clear again`);
      }
      return;
    }
    if (t.state === 'CLEARED') {
      t.speedKmh = 0;
      return;
    }

    const g = this.graph;
    const edgeId = t.path[t.edgeIndex];
    const edge = g.edges[edgeId];
    if (!edge) {
      this.derail(t, 'lost the road ahead');
      return;
    }
    if (edgeId.includes('~bridge') && !this.bridgeLive(edgeId)) {
      this.derail(t, 'rolled onto a turntable that was not locked');
      return;
    }

    const len = edge.line.lengthM;
    if (t.state === 'HOLDING' && t.plan && this.gapAhead(t) > 0.4 && this.edgeAheadFree(t) && !this.nodeBlockedAhead(t)) {
      t.state = 'RUNNING';
      t.service = `running to ${t.destLabel}`;
      this.pushLog('good', `${t.id} released — proceeding towards ${t.destLabel}`);
    }
    const limit = Math.min(t.maxSpeedKmh, edge.speedLimitKmh, this.approachLimit(t)) / KMH;
    const stop = Math.min(this.stopDistance(t), this.gapAhead(t));
    const brakeCap = stop < 1e6 ? Math.sqrt(Math.max(0, 2 * t.brake * Math.max(0, stop - 0.35))) : 1e6;
    const v = t.speedKmh / KMH;
    const target = Math.min(limit, brakeCap);
    let nv = Math.min(target, v + t.accel * dt);
    if (target < v) nv = Math.max(target, v - t.brake * dt);
    if (stop <= 0.35) nv = 0;
    t.speedKmh = Math.max(0, nv * KMH);

    let move = nv * dt;
    let guard = 0;
    while (guard++ < 64) {
      const cur = g.edges[t.path[t.edgeIndex]];
      if (!cur) break;
      const room = cur.line.lengthM - t.distM;
      if (room > 0.06 && move < room) {
        t.distM += move;
        move = 0;
        break;
      }
      move -= room;
      t.distM = cur.line.lengthM;
      if (t.edgeIndex >= t.path.length - 1) {
        move = 0;
        break;
      }
      if (t.stopEdge >= 0 && t.edgeIndex >= t.stopEdge) {
        move = 0;
        break;
      }
      const nextId = t.path[t.edgeIndex + 1];
      if (nextId.includes('~bridge') && !this.bridgeLive(nextId)) {
        t.edgeIndex++;
        this.derail(t, 'the turntable moved under the route');
        return;
      }
      const atNode = this.nodeBlockedAhead(t);
      if (atNode) {
        this.syncPose(t);
        this.hold(t, `held at the junction — ${atNode} is fouling ${t.nodes[t.edgeIndex + 1]}`);
        return;
      }
      const holder = nextId === this.spawnEdgeId ? undefined : this.occ.edge.get(nextId);
      if (holder && holder !== t.id) {
        this.syncPose(t);
        this.hold(t, `held at the signal — ${nextId} is occupied by ${holder}`);
        return;
      }
      t.edgeIndex++;
      t.distM = 0;
    }

    this.syncPose(t);
    if (t.speedKmh < 0.05 && this.stopDistance(t) <= 0.35) this.arriveStop(t);
    else this.checkQueue(t);
  }

  private checkQueue(t: SimTrain) {
    if (t.speedKmh > 0.5 || !t.plan || t.state === 'HOLDING' || t.state === 'DERAILED') return;
    const edgeId = t.path[t.edgeIndex];
    const edge = this.graph.edges[edgeId];
    if (!edge || t.distM > edge.line.lengthM - 0.5) return;
    const leader = this.trains.find(
      (o) =>
        o !== t &&
        o.state !== 'CLEARED' &&
        o.state !== 'DERAILED' &&
        o.path[o.edgeIndex] === edgeId &&
        o.distM > t.distM &&
        o.distM - t.distM < o.lengthM + 26,
    );
    if (leader) this.hold(t, `queued behind ${leader.id} on ${edgeId}`);
  }

  private nodeBlockedAhead(t: SimTrain): string | null {
    const nodeId = t.nodes[t.dir === 1 ? t.edgeIndex + 1 : t.edgeIndex];
    const p = nodeId ? this.yard.nodes[nodeId]?.pos : undefined;
    if (!p) return null;
    const cur = t.path[t.edgeIndex];
    for (const o of this.trains) {
      if (o === t || o.state === 'CLEARED' || o.state === 'DEPARTED' || o.state === 'DERAILED') continue;
      if (o.path[o.edgeIndex] === cur && o.dir === t.dir) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) < 26) return o.id;
    }
    return null;
  }

  private edgeAheadFree(t: SimTrain): boolean {
    const next = t.path[t.edgeIndex + 1];
    if (!next) return true;
    if (next === this.spawnEdgeId) return true;
    const holder = this.occ.edge.get(next);
    return !holder || holder === t.id;
  }

  private gapAhead(t: SimTrain): number {
    const edgeId = t.path[t.edgeIndex];
    const edge = this.graph.edges[edgeId];
    if (!edge) return 1e6;
    let best = 1e6;
    for (const o of this.trains) {
      if (o === t || o.state === 'CLEARED' || o.state === 'DERAILED') continue;
      if (o.path[o.edgeIndex] !== edgeId) continue;
      if (o.distM <= t.distM) continue;
      const ahead = o.distM - t.distM - o.lengthM - 9;
      if (ahead < best) best = ahead;
    }
    return Math.max(0, best);
  }

  private approachLimit(t: SimTrain): number {
    if (!t.plan || t.stopEdge < 0) return 1e6;
    const speed = t.plan.arrivalSpeedKmh || 45;
    const away = this.stopDistance(t);
    return away > 220 ? speed : Math.max(speed, 12 + away * 0.35);
  }

  private bridgeLive(edgeId: string): boolean {
    const tt = this.turntable(edgeId.split('~')[0]);
    return !!tt && !!turntableLive(tt);
  }

  private hold(t: SimTrain, why: string) {
    if (t.state === 'HOLDING') return;
    t.state = 'HOLDING';
    t.speedKmh = 0;
    t.service = t.plan ? `held on route · ${t.destLabel}` : 'held · no route set';
    this.pushLog('warn', `${t.id} ${why}`);
  }

  private arriveStop(t: SimTrain) {
    if (!t.plan) {
      this.hold(t, 'holding at the entry signal — no road set');
      return;
    }
    const atPathEnd = t.stopEdge < 0 && t.edgeIndex >= t.path.length - 1 && this.stopDistance(t) <= 0.35;
    if (atPathEnd) {
      if (t.backing) {
        t.backing = false;
        this.withdrawRoad(t);
      } else {
        this.complete(t);
      }
      return;
    }
    const atDest = t.stopEdge >= 0 && t.stopEdge === t.edgeIndex && this.stopDistance(t) <= 0.35;
    if (!atDest) {
      this.hold(t, `stopped short of ${t.destLabel} at ${t.path[t.edgeIndex]}`);
      return;
    }
    if (t.backing) {
      t.backing = false;
      this.withdrawRoad(t);
      return;
    }
    const dest = this.yard.destinations.find((d) => d.id === t.plan?.destinationId);
    if (t.request === 'STOP_BY') {
      t.state = 'DWELL';
      t.dwell = 0;
      t.serviceLeft = DWELL_SEC;
      t.service = `dwelling at ${dest?.label ?? 'platform'}`;
      this.pushLog('good', `${t.id} berthed at ${dest?.label ?? 'the platform'}`);
      return;
    }
    if (t.request === 'REPAIR') {
      t.state = 'REPAIRING';
      t.dwell = 0;
      t.serviceLeft = REPAIR_SEC;
      t.service = `under repair at ${dest?.label ?? 'workshop'}`;
      this.stats.repairs++;
      this.pushLog('good', `${t.id} stabled in ${dest?.label ?? 'the workshop'} for repair`);
      return;
    }
    t.state = 'DWELL';
    t.dwell = 0;
    t.holdTimer = 0;
    t.serviceLeft = DWELL_SEC;
    t.service = `final stand at ${dest?.label ?? 'siding'}`;
    this.pushLog('good', `${t.id} stabled at its final stand, ${dest?.label ?? 'siding'}`);
  }

  private endService(t: SimTrain) {
    const plan = t.plan;
    if (!plan) {
      t.state = 'RUNNING';
      return;
    }
    if (t.request === 'STOP_BY') {
      t.state = 'RUNNING';
      t.stopEdge = -1;
      t.service = `continuing to ${this.yard.exits[0] ?? 'the exit'}`;
      this.pushLog('info', `${t.id} dwell complete — running on to the exit`);
      return;
    }
    const inbound = plan.inbound.length ? plan.inbound : [this.spawnEdgeId];
    const edges = [...inbound].reverse();
    const nodes = [...plan.nodes].reverse();
    if (edges[edges.length - 1] === this.spawnEdgeId) {
      edges.pop();
      nodes.pop();
    }
    const reversePath = edges.length ? edges : [this.spawnEdgeId];
    if (this.reverseRoadBusy(t, reversePath) && t.holdTimer < 90) {
      t.holdTimer += 6;
      t.dwell = DWELL_SEC - 6;
      t.state = 'DWELL';
      t.service = `waiting to run round from ${t.destLabel}`;
      return;
    }
    t.path = reversePath;
    t.nodes = nodes.length ? nodes : [this.entryNode, this.graph.edges[this.spawnEdgeId].to];
    t.edgeIndex = 0;
    t.distM = 0;
    t.stopEdge = -1;
    t.dir = -1;
    t.state = 'RUNNING';
    t.service = `running round from ${t.destLabel}`;
    this.pushLog('info', `${t.id} running round from ${t.destLabel}`);
  }

  private reverseRoadBusy(t: SimTrain, reversePath: string[]): boolean {
    const busy = new Set(reversePath);
    for (const o of this.trains) {
      if (o === t || o.state === 'CLEARED' || o.state === 'DEPARTED') continue;
      const live = o.state === 'DERAILED' ? o.path.slice(o.edgeIndex) : o.path;
      if (live.some((id) => busy.has(id))) return true;
    }
    return false;
  }

  private laneClearance(self: SimTrain): number {
    let start = -(self.lengthM + 30);
    for (const o of this.trains) {
      if (o === self || o.state === 'CLEARED' || o.path[o.edgeIndex] !== this.spawnEdgeId) continue;
      start = Math.min(start, o.distM - o.lengthM - 34);
    }
    return start;
  }

  private complete(t: SimTrain) {
    t.state = 'DEPARTED';
    const waited = t.holdTimer;
    t.holdTimer = 0;
    t.speedKmh = 0;
    t.service = 'cleared the layout';
    this.stats.processed++;
    const late = waited > LATE_HOLD_SEC;
    if (late) {
      this.lateClears++;
      this.stats.late++;
    }
    const total = this.stats.processed;
    this.stats.onTimeRate = Math.max(0, Math.round(((total - this.lateClears) / total) * 100));
    this.stats.score = Math.max(
      0,
      1200 + this.stats.processed * 55 + this.stats.onTimeRate * 4 - this.stats.incidents * 220 - this.stats.derailments * 160 + this.stats.repairs * 25,
    );
    this.unlock(t.id);
    this.pushLog('good', `${t.id} cleared the layout${late ? ` · held ${Math.round(waited)}s` : ' on time'}`);
    this.flash(`${t.id} cleared`, 'good');
  }

  private derail(t: SimTrain, why: string) {
    if (t.state === 'DERAILED') return;
    t.state = 'DERAILED';
    t.holdTimer = 0;
    t.speedKmh = 0;
    t.service = 'derailed';
    this.stats.derailments++;
    this.stats.incidents++;
    this.crashes.push({ id: this.fxId++, x: t.x, y: t.y, t: 0, text: `${t.id} derailed — ${why}`, kind: 'derail' });
    this.unlock(t.id);
    this.pushLog('bad', `${t.id} DERAILED: ${why}`);
    this.flash(`${t.id} derailed`, 'bad');
  }

  private detectCollisions() {
    const live = this.trains.filter((t) => t.state === 'RUNNING' || t.state === 'INBOUND' || t.state === 'HOLDING');
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        let overlap = false;
        if (a.path[a.edgeIndex] === b.path[b.edgeIndex] && a.dir === b.dir) {
          const ahead = a.distM >= b.distM ? a : b;
          const behind = ahead === a ? b : a;
          overlap = ahead.distM - behind.distM < ahead.lengthM + 9;
        }
        if (gap > CRASH_PX && !overlap) continue;
        this.crash(a, b);
      }
    }
  }

  private crash(a: SimTrain, b: SimTrain) {
    this.stats.incidents++;
    this.stats.collisionAlerts++;
    for (const t of [a, b]) {
      if (t.state === 'DERAILED') continue;
      t.state = 'DERAILED';
      t.speedKmh = 0;
      t.service = 'derailed in a collision';
      this.stats.derailments++;
      this.unlock(t.id);
    }
    this.crashes.push({
      id: this.fxId++,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      t: 0,
      text: `Collision · ${a.id} × ${b.id}`,
      kind: 'collision',
    });
    this.pushLog('bad', `COLLISION · ${a.id} × ${b.id} — conflicting roads were accepted`);
    this.flash(`Collision · ${a.id} × ${b.id}`, 'bad');
  }

  private rebuildOccupancy() {
    this.occ = emptyOcc();
    for (const t of this.trains) {
      if (t.state === 'CLEARED') continue;
      const edgeId = t.path[t.edgeIndex];
      if (edgeId && edgeId !== this.spawnEdgeId && this.graph.edges[edgeId]) {
        this.occ.edge.set(edgeId, t.id);
        this.occ.dirs.set(edgeId, this.dirAt(t, t.edgeIndex));
      }
      const node = t.nodes[t.edgeIndex];
      if (node) this.occ.node.set(node, t.id);
      if (!t.plan) continue;
      for (let j = t.edgeIndex; j < t.path.length; j++) {
        const id = t.path[j];
        if (id === this.spawnEdgeId) continue;
        if (!this.occ.claimed.has(id)) {
          this.occ.claimed.set(id, t.id);
          this.occ.dirs.set(id, this.dirAt(t, j));
        }
      }
    }
  }

  private dirAt(t: SimTrain, index: number): number {
    const edge = this.graph.edges[t.path[index]];
    if (!edge) return 1;
    const from = t.nodes[index];
    if (from === edge.from) return 1;
    if (from === edge.to) return -1;
    return 1;
  }

  private breakDeadlocks(dt: number) {
    for (const t of this.trains) {
      if (t.state !== 'HOLDING' || !t.plan) {
        if (t.state !== 'HOLDING') this.stuck.delete(t.id);
        continue;
      }
      const held = (this.stuck.get(t.id) ?? 0) + dt;
      this.stuck.set(t.id, held);
      if (held < 45) continue;
      this.stuck.delete(t.id);
      if (t.path[t.edgeIndex] === this.spawnEdgeId && t.edgeIndex === 0) this.withdrawRoad(t);
      else this.backOff(t);
    }
  }

  private withdrawRoad(t: SimTrain) {
    if (!t.plan && !t.backing && t.path.length === 1 && t.path[0] === this.spawnEdgeId) return;
    this.unlock(t.id);
    const lane = this.graph.edges[this.spawnEdgeId];
    const onLane = t.path[t.edgeIndex] === this.spawnEdgeId;
    const reversed = onLane && this.dirAt(t, t.edgeIndex) === -1;
    const start = this.laneClearance(t);
    if (reversed) {
      t.nodes = [lane.to, this.entryNode];
      t.distM = lane.line.lengthM - start;
    } else {
      t.nodes = [this.entryNode, lane.to];
      t.distM = onLane && t.distM >= 0 ? t.distM : start;
    }
    t.path = [this.spawnEdgeId];
    t.edgeIndex = 0;
    t.plan = null;
    t.stopEdge = -1;
    t.backing = false;
    t.dir = 1;
    t.destLabel = '';
    t.speedKmh = 0;
    t.service = 'road withdrawn — waiting at the entry';
    this.pushLog('warn', `${t.id} is deadlocked — the road was withdrawn to the entry signal`);
  }

  private backOff(t: SimTrain) {
    const back = t.path[t.edgeIndex - 1];
    if (t.edgeIndex > 0) {
      const holder = this.occ.edge.get(back);
      if (holder && holder !== t.id) {
        this.pushLog('warn', `${t.id} cannot back off — ${back} is occupied by ${holder}`);
        return;
      }
    }
    const remaining = this.graph.edges[t.path[t.edgeIndex]]?.line.lengthM ?? 0;
    const slice = t.path.slice(0, t.edgeIndex + 1).reverse();
    const nodes = t.nodes.slice(0, t.edgeIndex + 2).reverse();
    t.path = slice.length ? slice : [this.spawnEdgeId];
    t.nodes = nodes.length ? nodes : [this.entryNode, this.graph.edges[this.spawnEdgeId].to];
    t.edgeIndex = 0;
    t.distM = Math.max(0, Math.min(remaining, remaining - t.distM));
    t.stopEdge = -1;
    t.dir = (t.dir === 1 ? -1 : 1) as 1 | -1;
    t.backing = true;
    t.state = 'RUNNING';
    t.speedKmh = 0;
    t.service = 'backing off to the entry';
    this.pushLog('warn', `${t.id} is deadlocked — backing off towards the entry signal`);
  }

  private stopDistance(t: SimTrain): number {
    const g = this.graph;
    const edge = g.edges[t.path[t.edgeIndex]];
    if (!edge) return 0;
    if (!t.plan) return Math.max(0, HOLD_M - t.distM);
    const here = Math.max(0, edge.line.lengthM - t.distM);
    if (t.stopEdge < 0) {
      let d = here;
      for (let j = t.edgeIndex + 1; j < t.path.length; j++) d += g.edges[t.path[j]]?.line.lengthM ?? 0;
      return d;
    }
    if (t.stopEdge < t.edgeIndex) return 0;
    let d = here;
    for (let j = t.edgeIndex + 1; j <= t.stopEdge; j++) d += g.edges[t.path[j]]?.line.lengthM ?? 0;
    return d;
  }

  private poseOnEdge(t: SimTrain, index: number, alongM: number): { x: number; y: number; rot: number } {
    const edge = this.graph.edges[t.path[index]];
    if (!edge) return { x: t.x, y: t.y, rot: t.rot };
    const line = edge.line;
    const forward = this.dirAt(t, index) === 1;
    const d = forward ? alongM : line.lengthM - alongM;
    const pts = line.pts;
    const last = pts.length - 1;
    if (d < 0 || d > line.lengthM) {
      const head = forward ? pts[0] : pts[last];
      const other = forward ? (pts[1] ?? head) : (pts[last - 1] ?? head);
      const dx = other.x - head.x;
      const dy = other.y - head.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = forward ? (d * PX_PER_M) / len : (-d * PX_PER_M) / len;
      const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
      return { x: head.x + dx * off, y: head.y + dy * off, rot };
    }
    const p = pointAt(line, d);
    const rot = headingAt(line, d) + (forward ? 0 : 180);
    return { x: p.x, y: p.y, rot: rot > 180 ? rot - 360 : rot < -180 ? rot + 360 : rot };
  }

  private syncPose(t: SimTrain) {
    const edge = this.graph.edges[t.path[t.edgeIndex]];
    if (!edge) return;
    const pose = this.poseOnEdge(t, t.edgeIndex, t.distM);
    t.x = pose.x;
    t.y = pose.y;
    t.rot = pose.rot;
    const carLen = t.lengthM / t.cars;
    const gapM = carLen * 0.12;
    t.cars1 = [];
    for (let i = 0; i < t.cars; i++) {
      t.cars1.push(this.bodyPoint(t, (i + 1) * (carLen + gapM)));
    }
  }

  private bodyPoint(t: SimTrain, backM: number): { x: number; y: number; rot: number } {
    const g = this.graph;
    let e = t.edgeIndex;
    let d = t.distM - backM;
    let guard = 0;
    while (d < 0 && e > 0 && guard++ < 64) {
      e--;
      d += g.edges[t.path[e]]?.line.lengthM ?? 0;
    }
    if (!g.edges[t.path[e]]) return { x: t.x, y: t.y, rot: t.rot };
    return this.poseOnEdge(t, e, d);
  }

  private signals(): SignalAspect[] {
    const out: SignalAspect[] = [];
    for (const sw of this.yard.switches) {
      let clear = false;
      for (const t of this.trains) {
        if (t.state === 'CLEARED' || t.state === 'DERAILED') continue;
        if (t.plan && t.plan.required.some((r) => r.switchId === sw.id)) clear = true;
      }
      const holder = this.occ.node.get(sw.nodeId);
      if (holder) clear = false;
      const next = this.graph.edges[sw.thru];
      let rot = 0;
      if (next) {
        const a = next.line.pts[0];
        const z = next.line.pts[next.line.pts.length - 1];
        rot = (Math.atan2(z.y - a.y, z.x - a.x) * 180) / Math.PI;
      }
      out.push({ nodeId: sw.nodeId, pos: sw.pos, rot, state: clear ? 'clear' : 'danger' });
    }
    return out;
  }

  private upcoming() {
    return this.schedule.slice(this.spawnIdx, this.spawnIdx + 3).map((s) => ({
      id: s.id,
      type: s.type,
      name: TRAIN_SPECS[s.type].name,
      request: s.request,
      dueInSec: Math.max(0, Math.round(s.scheduledSec - this.sec)),
    }));
  }

  snapshot(): SimSnapshot {
    const sel = this.train(this.selection);
    const plan = sel && this.selectedDest ? this.routeFor(sel.id, this.selectedDest) : null;
    return {
      sec: this.sec,
      speed: this.speed,
      yard: this.yard,
      trains: this.trains.map((t) => ({ ...t, cars1: t.cars1.map((c) => ({ ...c })) })),
      switches: this.yard.switches.map((s) => ({ ...s, pos: { ...s.pos } })),
      turntables: this.yard.turntables.map((t) => ({ ...t, pos: { ...t.pos }, ports: t.ports.map((p) => ({ ...p })) })),
      stats: { ...this.stats },
      log: this.log.slice(0, 80).map((l) => ({ ...l })),
      crashes: this.crashes.map((c) => ({ ...c })),
      selection: this.selection,
      plan,
      options: this.options(sel),
      upcoming: this.upcoming(),
      signals: this.signals(),
      allStop: this.allStop,
      muted: this.muted,
      banner: this.banner ? { text: this.banner.text, tone: this.banner.tone } : null,
    };
  }

  private pushLog(level: LogEntry['level'], text: string) {
    this.log.unshift({ id: this.logId++, sec: this.sec, level, text });
    if (this.log.length > 140) this.log.length = 140;
  }

  private flash(text: string, tone: 'bad' | 'warn' | 'good') {
    this.banner = { text, tone, until: this.realSec + 3.4 };
  }
}

function graphHas(g: Graph, from: string, to: string): boolean {
  if (from === to) return true;
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const link of g.adj[cur] ?? []) {
      if (seen.has(link.to)) continue;
      if (link.to === to) return true;
      seen.add(link.to);
      queue.push(link.to);
    }
  }
  return false;
}