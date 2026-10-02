import type {
  Destination,
  NodeKind,
  RouteRequest,
  StationSpec,
  SwitchDef,
  SwitchRole,
  SwitchState,
  TrackEdge,
  TrackKind,
  TrackNode,
  Turntable,
  TurntablePort,
  Vec,
  Yard,
} from '../types/simulator';
import { curvePts, dist, pathThrough, polyline, smoothPath, straightPts } from './geometry';

export interface EdgeOpts {
  kind: TrackKind;
  label?: string;
  role?: SwitchRole;
  speed?: number;
  line?: Vec[];
}

const DEFAULT_SPEED: Record<TrackKind, number> = {
  main: 160,
  approach: 100,
  platform: 45,
  siding: 55,
  staging: 45,
  repair: 20,
  depot: 20,
};

export class YardBuilder {
  spec!: StationSpec;
  width = 2000;
  height = 1000;
  nodes: Record<string, TrackNode> = {};
  edges: Record<string, TrackEdge> = {};
  edgeList: TrackEdge[] = [];
  switches: SwitchDef[] = [];
  turntables: Turntable[] = [];
  entries: string[] = [];
  exits: string[] = [];
  destinations: Destination[] = [];
  entryLanes: { nodeId: string; label: string; laneY: number }[] = [];
  notes: { x: number; y: number; text: string; tone?: 'normal' | 'warn' }[] = [];

  size(width: number, height: number) {
    this.width = width;
    this.height = height;
    return this;
  }

  meta(spec: StationSpec) {
    this.spec = spec;
    return this;
  }

  node(id: string, x: number, y: number, opts: Partial<TrackNode> = {}) {
    if (this.nodes[id]) throw new Error(`duplicate node ${id}`);
    this.nodes[id] = { id, kind: (opts.kind ?? 'merge') as NodeKind, pos: { x, y }, label: opts.label, sub: opts.sub };
    return id;
  }

  pos(id: string): Vec {
    const n = this.nodes[id];
    if (!n) throw new Error(`missing node ${id}`);
    return n.pos;
  }

  edge(id: string, from: string, to: string, opts: EdgeOpts) {
    if (this.edges[id]) throw new Error(`duplicate edge ${id}`);
    const a = this.pos(from);
    const b = this.pos(to);
    const line = polyline(opts.line ?? straightPts(a, b));
    const e: TrackEdge = {
      id,
      from,
      to,
      kind: opts.kind,
      label: opts.label,
      role: opts.role,
      speedLimitKmh: opts.speed ?? DEFAULT_SPEED[opts.kind],
      line,
      d: smoothPath(line.pts),
    };
    this.edges[id] = e;
    this.edgeList.push(e);
    return id;
  }

  curve(id: string, from: string, to: string, bend: number, opts: EdgeOpts) {
    const a = this.pos(from);
    const b = this.pos(to);
    return this.edge(id, from, to, { ...opts, line: curvePts(a, b, bend) });
  }

  track(id: string, from: string, to: string, via: Vec[], opts: EdgeOpts) {
    const a = this.pos(from);
    const b = this.pos(to);
    const pts = [a, ...via, b];
    return this.edge(id, from, to, { ...opts, line: pathThrough(pts) });
  }

  switchNode(id: string, x: number, y: number, label?: string) {
    return this.node(id, x, y, { kind: 'switch', label });
  }

  turnout(id: string, nodeId: string, toe: string, thru: string, diverge: string, label?: string) {
    const n = this.nodes[nodeId];
    if (!n) throw new Error(`missing turnout node ${nodeId}`);
    n.kind = 'switch';
    const sw: SwitchDef = {
      id,
      nodeId,
      pos: n.pos,
      toe,
      thru,
      diverge,
      state: 'THRU' as SwitchState,
      locked: false,
      lockedBy: null,
      label: label ?? id,
    };
    this.switches.push(sw);
    return id;
  }

  buffer(id: string, x: number, y: number, label?: string) {
    return this.node(id, x, y, { kind: 'buffer', label });
  }

  portalIn(id: string, x: number, y: number, label: string, lanes = 1) {
    this.node(id, x, y, { kind: 'portal_in', label });
    this.entries.push(id);
    this.entryLanes.push({ nodeId: id, label, laneY: y });
    void lanes;
    return id;
  }

  portalOut(id: string, x: number, y: number, label: string) {
    this.node(id, x, y, { kind: 'portal_out', label });
    this.exits.push(id);
    return id;
  }

  dest(
    id: string,
    nodeId: string,
    label: string,
    kind: TrackKind,
    sub: string,
    accepts: RouteRequest[],
    trackLabel: string,
    capacityM = 700,
  ) {
    const d: Destination = { id, nodeId, label, kind, sub, accepts, trackLabel, capacityM };
    this.destinations.push(d);
    return id;
  }

  turntable(o: {
    id: string;
    pos: Vec;
    radius: number;
    angle0: number;
    speed?: number;
    ports: { name: string; angleDeg: number; role: 'lead' | 'stall' }[];
  }) {
    const ports: TurntablePort[] = o.ports.map((p, i) => {
      const nodeId = `${o.id}-p${i}`;
      const rad = (p.angleDeg * Math.PI) / 180;
      const x = o.pos.x + Math.cos(rad) * o.radius;
      const y = o.pos.y + Math.sin(rad) * o.radius;
      this.node(nodeId, x, y, { kind: 'tt_port', label: p.name });
      return { id: `${o.id}-P${i}`, nodeId, angleDeg: p.angleDeg, role: p.role, name: p.name };
    });
    const tt: Turntable = {
      id: o.id,
      pos: o.pos,
      radius: o.radius,
      portRadius: o.radius,
      angleDeg: o.angle0,
      targetDeg: null,
      moving: false,
      speedLimitKmh: o.speed ?? 15,
      ports,
    };
    this.turntables.push(tt);
    return tt;
  }

  ladder(o: {
    prefix: string;
    apex: { nodeId: string; edgeId: string };
    dir: 1 | -1;
    trunkY: number;
    firstX: number;
    step: number;
    speed?: number;
    roads: {
      y: number;
      kind: TrackKind;
      label: string;
      switchId?: string;
      endX: number;
      endKind?: NodeKind;
      endLabel?: string;
      speed?: number;
      stopX?: number;
    }[];
  }) {
    const n = o.roads.length;
    const nodes: string[] = [];
    for (let i = 0; i < n; i++) {
      const r = o.roads[i];
      const x = o.firstX + o.dir * i * o.step;
      const isLast = i === n - 1;
      nodes.push(this.node(`${o.prefix}T${i + 1}`, x, r.y, { kind: isLast && !r.switchId ? 'merge' : 'switch', label: r.label }));
    }
    const toeIds: string[] = [o.apex.edgeId];
    for (let i = 1; i < n; i++) {
      toeIds.push(this.edge(`${o.prefix}d${i}`, nodes[i - 1], nodes[i], { kind: 'approach', speed: o.speed ?? 90 }));
    }
    const ends: string[] = [];
    const roadIds: string[] = [];
    const mids: string[] = [];
    for (let i = 0; i < n; i++) {
      const r = o.roads[i];
      const midId = r.stopX ? `${o.prefix}M${i + 1}` : null;
      const endId = `${o.prefix}E${i + 1}`;
      this.node(endId, r.endX, r.y, { kind: r.endKind ?? 'merge', label: r.endLabel ?? r.label });
      ends.push(endId);
      if (midId && r.stopX !== undefined) {
        this.node(midId, r.stopX, r.y, { kind: 'merge', label: r.label });
        mids.push(midId);
        roadIds.push(this.edge(`${o.prefix}r${i + 1}`, nodes[i], midId, { kind: r.kind, label: r.label, speed: r.speed ?? o.speed }));
        this.edge(`${o.prefix}r${i + 1}b`, midId, endId, { kind: r.kind, speed: r.speed ?? o.speed });
      } else {
        mids.push('');
        roadIds.push(this.edge(`${o.prefix}r${i + 1}`, nodes[i], endId, { kind: r.kind, label: r.label, speed: r.speed ?? o.speed }));
      }
    }
    for (let i = 0; i < n; i++) {
      const r = o.roads[i];
      if (i === n - 1) continue;
      if (!r.switchId) continue;
      this.turnout(r.switchId, nodes[i], toeIds[i], roadIds[i], toeIds[i + 1], r.label);
    }
    void o.trunkY;
    return { nodes, ends, mids, roadIds };
  }

  note(x: number, y: number, text: string, tone: 'normal' | 'warn' = 'normal') {
    this.notes.push({ x, y, text, tone });
  }

  build(): Yard {
    for (const sw of this.switches) {
      for (const e of [sw.toe, sw.thru, sw.diverge]) {
        if (!this.edges[e]) throw new Error(`${sw.id} references missing edge ${e}`);
      }
      const deg = this.edgeList.filter((e) => e.from === sw.nodeId || e.to === sw.nodeId).length;
      if (deg !== 3) throw new Error(`${sw.id} at ${sw.nodeId} has degree ${deg}, expected 3`);
    }
    for (const e of this.edgeList) {
      if (!this.nodes[e.from]) throw new Error(`edge ${e.id} from unknown node ${e.from}`);
      if (!this.nodes[e.to]) throw new Error(`edge ${e.id} to unknown node ${e.to}`);
    }
    const isolated = Object.values(this.nodes).filter(
      (n) => !this.edgeList.some((e) => e.from === n.id || e.to === n.id),
    );
    if (isolated.length) throw new Error(`isolated nodes: ${isolated.map((n) => n.id).join(', ')}`);
    for (const d of this.destinations) {
      if (!this.nodes[d.nodeId]) throw new Error(`destination ${d.id} references unknown node ${d.nodeId}`);
    }
    const yard: Yard = {
      spec: this.spec,
      width: this.width,
      height: this.height,
      nodes: this.nodes,
      edges: this.edges,
      edgeList: this.edgeList,
      switches: this.switches,
      turntables: this.turntables,
      entries: this.entries,
      exits: this.exits,
      destinations: this.destinations,
      entryLanes: this.entryLanes,
    };
    return yard;
  }
}

export function totalYardLength(yard: Yard): number {
  return yard.edgeList.reduce((a, e) => a + e.line.lengthM, 0);
}

export function nodeSpan(yard: Yard, id: string): number {
  const n = yard.nodes[id];
  let r = 0;
  for (const e of yard.edgeList) {
    if (e.from === id || e.to === id) r = Math.max(r, dist(e.line.pts[0], e.line.pts[e.line.pts.length - 1]));
  }
  return r || (n ? 40 : 0);
}