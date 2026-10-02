import type { Destination, Issue, RoutePlan, SimTrain, SwitchDef, SwitchState, Yard } from '../types/simulator';
import type { Graph } from './graph';
import { findPath, findToAny } from './graph';

export interface Occ {
  edge: Map<string, string>;
  node: Map<string, string>;
  claimed: Map<string, string>;
  dirs: Map<string, number>;
}

export function emptyOcc(): Occ {
  return { edge: new Map(), node: new Map(), claimed: new Map(), dirs: new Map() };
}

export function pathDirs(edges: string[], nodes: string[], graph: Graph): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < edges.length; i++) {
    const e = graph.edges[edges[i]];
    if (!e) continue;
    const tail = i < nodes.length - 1 ? nodes[i] : undefined;
    const head = nodes[nodes.length - 1];
    const forward = tail === undefined ? head !== e.from : tail === e.from;
    out.set(edges[i], forward ? 1 : -1);
  }
  return out;
}

export function reachableFrom(g: Graph, from: string): Record<string, { edges: string[]; nodes: string[] }> {
  const out: Record<string, { edges: string[]; nodes: string[] }> = {};
  for (const dest of allNodes(g)) {
    const p = findPath(g, from, dest);
    if (p) out[dest] = p;
  }
  return out;
}

function allNodes(g: Graph): string[] {
  return Object.keys(g.adj);
}

export interface SwitchRequirement {
  switchId: string;
  state: SwitchState;
}

export function requiredSwitches(
  g: Graph,
  edges: string[],
  nodes: string[],
): { required: SwitchRequirement[]; illegal: Issue[] } {
  const required: SwitchRequirement[] = [];
  const illegal: Issue[] = [];
  for (let i = 1; i < nodes.length - 1; i++) {
    const sw = g.switchByNode[nodes[i]];
    if (!sw) continue;
    const inEdge = edges[i - 1];
    const outEdge = edges[i];
    let state: SwitchState | null = null;
    if ((inEdge === sw.toe && outEdge === sw.thru) || (inEdge === sw.thru && outEdge === sw.toe)) state = 'THRU';
    else if ((inEdge === sw.toe && outEdge === sw.diverge) || (inEdge === sw.diverge && outEdge === sw.toe)) state = 'DIVERGENT';
    else {
      illegal.push({
        level: 'block',
        code: 'impossible-points',
        text: `${sw.id}: route passes straight through the points — no legal move`,
        nodeId: sw.nodeId,
        switchId: sw.id,
      });
      continue;
    }
    if (!required.some((r) => r.switchId === sw.id)) required.push({ switchId: sw.id, state });
  }
  return { required, illegal };
}

export interface PlanInput {
  yard: Yard;
  graph: Graph;
  train: SimTrain;
  fromNode: string;
  dest: Destination;
  approachEdges: string[];
  switches: SwitchDef[];
  occ: Occ;
  turntableIssue?: Issue | null;
  ignorePoints?: boolean;
}

export function planRoute(input: PlanInput): RoutePlan {
  const { yard, graph, train, fromNode, dest, approachEdges, switches, occ } = input;
  const blocks: Issue[] = [];
  const warns: Issue[] = [];

  const leg = findPath(graph, fromNode, dest.nodeId);
  const inbound = leg ? [...approachEdges, ...leg.edges] : [...approachEdges];
  const nodes = leg ? [fromNode, ...leg.nodes.slice(1)] : [fromNode];

  let onward: string[] = [];
  let allNodesPath = nodes;
  if (train.request === 'STOP_BY' || train.request === 'PASS') {
    const exits = new Set(yard.exits);
    const on = findToAny(graph, dest.nodeId, exits);
    if (on) {
      onward = on.edges;
      allNodesPath = [...nodes.slice(0, -1), ...on.nodes];
    } else if (train.request === 'STOP_BY') {
      blocks.push({
        level: 'block',
        code: 'no-exit',
        text: `${dest.label} has no onward exit route for a stopping service`,
        nodeId: dest.nodeId,
      });
    }
  }

  const edges = [...inbound, ...onward];
  const { required, illegal } = requiredSwitches(graph, edges, allNodesPath);
  blocks.push(...illegal);
  if (!leg && input.turntableIssue) {
    blocks.push({ ...input.turntableIssue, level: 'block', code: 'turntable-blocked' });
  } else if (!leg) {
    blocks.push({ level: 'block', code: 'no-route', text: `No road from ${fromNode} to ${dest.label}`, nodeId: dest.nodeId });
  }

  const swById = new Map(switches.map((s) => [s.id, s]));
  for (const r of required) {
    const sw = swById.get(r.switchId);
    if (!sw) continue;
    if (sw.state !== r.state) {
      const issue: Issue = {
        level: input.ignorePoints ? 'warn' : 'block',
        code: 'points',
        text: `${sw.id} must be set to ${r.state} (now ${sw.state})`,
        switchId: sw.id,
        nodeId: sw.nodeId,
      };
      if (input.ignorePoints) warns.push(issue);
      else blocks.push(issue);
    }
  }

  const mine = pathDirs(edges, allNodesPath, graph);
  for (let i = 0; i < edges.length; i++) {
    const edgeId = edges[i];
    const holder = occ.edge.get(edgeId);
    const claim = occ.claimed.get(edgeId);
    const other = holder && holder !== train.id ? holder : claim && claim !== train.id ? claim : null;
    if (!other) continue;
    const theirs = occ.dirs.get(edgeId);
    const sign = mine.get(edgeId);
    if (theirs !== undefined && sign !== undefined && theirs !== sign) {
      blocks.push({
        level: 'block',
        code: 'opposing',
        text: `${edgeId} is set for an opposing movement by ${other} — the roads would lock`,
        edgeId,
      });
      continue;
    }
    if (holder) warns.push({ level: 'warn', code: 'occupied', text: `${edgeId} is occupied by ${holder}`, edgeId });
    if (claim) warns.push({ level: 'warn', code: 'conflict', text: `${edgeId} is already routed to ${claim}`, edgeId });
  }

  const flatNodes = new Set(nodes);
  for (const [edgeId, holder] of occ.claimed) {
    const e = graph.edges[edgeId];
    if (!e || holder === train.id) continue;
    for (const n of [e.from, e.to]) {
      if (flatNodes.has(n)) {
        warns.push({ level: 'warn', code: 'junction', text: `Junction conflict with ${holder}`, nodeId: n });
      }
    }
  }
  if (input.turntableIssue && leg) warns.push(input.turntableIssue);

  const lengthM = edges.reduce((a, id) => a + (graph.edges[id]?.line.lengthM ?? 0), 0);
  const stopEdge = graph.edges[inbound[inbound.length - 1]];
  const arrivalSpeedKmh = stopEdge?.speedLimitKmh ?? 0;

  const uniqBlocks = dedupe(blocks);
  return {
    trainId: train.id,
    fromNode,
    toNode: dest.nodeId,
    destinationId: dest.id,
    destinationLabel: dest.label,
    inbound,
    onward,
    edges,
    nodes: allNodesPath,
    legIndex: inbound.length,
    required,
    blocks: uniqBlocks,
    warns: dedupe(warns),
    lengthM,
    arrivalSpeedKmh,
    ok: uniqBlocks.length === 0,
  };
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const out: Issue[] = [];
  for (const i of issues) {
    const k = `${i.code}|${i.switchId ?? i.nodeId ?? i.edgeId ?? i.text}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}