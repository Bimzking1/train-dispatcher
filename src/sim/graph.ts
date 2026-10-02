import type { BridgeEdge, SwitchDef, TrackEdge, Turntable, Vec, Yard } from '../types/simulator';
import { polyline, smoothPath, straightPts } from './geometry';

export interface Adj {
  edgeId: string;
  to: string;
}

export interface Graph {
  adj: Record<string, Adj[]>;
  edges: Record<string, TrackEdge>;
  bridges: BridgeEdge[];
  switchByNode: Record<string, SwitchDef>;
}

export const DETENT = 45;

export function normAngle(a: number): number {
  return ((a % 180) + 180) % 180;
}

function norm360(a: number): number {
  return (((a % 360) + 360) % 360) * 1000 / 1000;
}

function sameAngle(a: number, b: number): boolean {
  return Math.abs(norm360(a) - norm360(b)) < 0.01;
}

export function turntableAlignments(tt: Turntable): number[] {
  const out: number[] = [];
  for (let a = 0; a < 180; a += DETENT) {
    const hasA = tt.ports.some((p) => sameAngle(p.angleDeg, a));
    const hasB = tt.ports.some((p) => sameAngle(p.angleDeg, a + 180));
    if (hasA && hasB) out.push(a);
  }
  return out;
}

export function turntableLive(tt: Turntable): { a: string; b: string } | null {
  if (tt.moving) return null;
  const detent = normAngle(Math.round(tt.angleDeg / DETENT) * DETENT);
  if (Math.abs(normAngle(tt.angleDeg) - detent) > 0.75) return null;
  const pa = tt.ports.find((p) => sameAngle(p.angleDeg, detent));
  const pb = tt.ports.find((p) => sameAngle(p.angleDeg, detent + 180));
  if (!pa || !pb) return null;
  return { a: pa.nodeId, b: pb.nodeId };
}

export function bridgeGeometry(tt: Turntable, aNode: string, bNode: string, yard: Yard) {
  const a = yard.nodes[aNode].pos;
  const b = yard.nodes[bNode].pos;
  return straightPts(a, b);
}

let cacheKey = '';
let cache: Graph | null = null;

export function buildGraph(yard: Yard): Graph {
  const key = `${yard.spec.id}#${yard.edgeList.length}#` + yard.turntables.map((t) => `${t.id}:${t.angleDeg.toFixed(2)}:${t.moving ? 1 : 0}`).join('|');
  if (cache && cacheKey === key) return cache;

  const edges: Record<string, TrackEdge> = {};
  for (const e of yard.edgeList) edges[e.id] = e;
  const adj: Record<string, Adj[]> = {};
  for (const id of Object.keys(yard.nodes)) adj[id] = [];
  for (const e of yard.edgeList) {
    adj[e.from].push({ edgeId: e.id, to: e.to });
    adj[e.to].push({ edgeId: e.id, to: e.from });
  }

  const bridges: BridgeEdge[] = [];
  for (const tt of yard.turntables) {
    const live = turntableLive(tt);
    if (!live) continue;
    const line = polyline(bridgeGeometry(tt, live.a, live.b, yard));
    const edge: BridgeEdge = {
      id: `${tt.id}~bridge`,
      from: live.a,
      to: live.b,
      kind: 'approach',
      label: `${tt.id} bridge`,
      speedLimitKmh: tt.speedLimitKmh,
      line,
      d: smoothPath(line.pts),
      turntableId: tt.id,
      portA: live.a,
      portB: live.b,
    };
    edges[edge.id] = edge;
    adj[live.a].push({ edgeId: edge.id, to: live.b });
    adj[live.b].push({ edgeId: edge.id, to: live.a });
    bridges.push(edge);
  }

  const switchByNode: Record<string, SwitchDef> = {};
  for (const s of yard.switches) switchByNode[s.nodeId] = s;

  const g: Graph = { adj, edges, bridges, switchByNode };
  cacheKey = key;
  cache = g;
  return g;
}

export interface PathResult {
  edges: string[];
  nodes: string[];
}

export function findPath(g: Graph, from: string, to: string, blockEdges?: Set<string>): PathResult | null {
  if (from === to) return { edges: [], nodes: [from] };
  if (!g.adj[from] || !g.adj[to]) return null;
  const best: Record<string, number> = { [from]: 0 };
  const prev: Record<string, { node: string; edgeId: string } | undefined> = {};
  const seen = new Set<string>();
  const queue: string[] = [from];
  while (queue.length) {
    queue.sort((a, b) => (best[a] ?? Infinity) - (best[b] ?? Infinity));
    const cur = queue.shift() as string;
    if (cur === to) break;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const link of g.adj[cur]) {
      if (blockEdges?.has(link.edgeId)) continue;
      const w = g.edges[link.edgeId]?.line.lengthM ?? 1;
      const nd = (best[cur] ?? Infinity) + w;
      if (nd < (best[link.to] ?? Infinity)) {
        best[link.to] = nd;
        prev[link.to] = { node: cur, edgeId: link.edgeId };
        queue.push(link.to);
      }
    }
  }
  if (best[to] === undefined) return null;
  const edges: string[] = [];
  const nodes: string[] = [to];
  let cursor = to;
  while (cursor !== from) {
    const step = prev[cursor];
    if (!step) return null;
    edges.unshift(step.edgeId);
    nodes.unshift(step.node);
    cursor = step.node;
  }
  return { edges, nodes };
}

export function findToAny(g: Graph, from: string, targets: Set<string>): PathResult | null {
  const best: Record<string, number> = { [from]: 0 };
  const prev: Record<string, { node: string; edgeId: string } | undefined> = {};
  const seen = new Set<string>();
  const queue: string[] = [from];
  let found: string | null = null;
  while (queue.length) {
    queue.sort((a, b) => (best[a] ?? Infinity) - (best[b] ?? Infinity));
    const cur = queue.shift() as string;
    if (targets.has(cur)) {
      found = cur;
      break;
    }
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const link of g.adj[cur]) {
      const w = g.edges[link.edgeId]?.line.lengthM ?? 1;
      const nd = (best[cur] ?? Infinity) + w;
      if (nd < (best[link.to] ?? Infinity)) {
        best[link.to] = nd;
        prev[link.to] = { node: cur, edgeId: link.edgeId };
        queue.push(link.to);
      }
    }
  }
  if (!found) return null;
  const edges: string[] = [];
  const nodes: string[] = [found];
  let cursor = found;
  while (cursor !== from) {
    const step = prev[cursor];
    if (!step) return null;
    edges.unshift(step.edgeId);
    nodes.unshift(step.node);
    cursor = step.node;
  }
  return { edges, nodes };
}

export function pointOnEdge(g: Graph, edgeId: string, d: number): Vec {
  const e = g.edges[edgeId];
  if (!e) return { x: 0, y: 0 };
  const t = Math.max(0, Math.min(e.line.lengthM, d));
  let i = 1;
  while (i < e.line.cum.length && e.line.cum[i] < t) i++;
  if (i >= e.line.cum.length) return e.line.pts[e.line.pts.length - 1];
  const span = e.line.cum[i] - e.line.cum[i - 1] || 1;
  const f = (t - e.line.cum[i - 1]) / span;
  const a = e.line.pts[i - 1];
  const b = e.line.pts[i];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}