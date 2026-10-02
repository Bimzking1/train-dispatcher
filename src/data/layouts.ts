import type { RouteRequest, StationSpec, TrackKind, Yard } from '../types/simulator';
import { YardBuilder } from '../sim/yard';

export const STATION_SPECS: StationSpec[] = [
  {
    id: 'local',
    name: 'Local Junction',
    tier: 1,
    subtitle: 'Single-shift rural halt',
    blurb: 'Two running lines, one halt, one siding and a repair bay. Learn the points.',
    mainLines: 2,
    platformTracks: 1,
    sidings: 1,
    repairBays: 1,
    turntables: 0,
    lineLengthM: 620,
    maxTrains: 4,
    switchComplexity: 'Low',
    difficulty: 2,
    layout: ['2 Main Lines', '1 Halt Platform', '1 Holding Siding', '1 Repair Bay', '0 Turntables'],
  },
  {
    id: 'grand',
    name: 'Grand Central Terminal',
    tier: 2,
    subtitle: 'Metro terminus & depot',
    blurb: 'Four mains, three platforms and a turntable depot. Replatform, hold or run through.',
    mainLines: 4,
    platformTracks: 3,
    sidings: 2,
    repairBays: 3,
    turntables: 1,
    lineLengthM: 2180,
    maxTrains: 8,
    switchComplexity: 'Medium',
    difficulty: 3,
    layout: ['4 Main Lines', '3 Platform Tracks', '2 Holding Sidings', 'Depot Fan via Turntable'],
  },
  {
    id: 'freight',
    name: 'Industrial Freight Hub',
    tier: 3,
    subtitle: 'Heavy freight interchange',
    blurb: 'Three through lines, six staging roads, two turntable sheds and three heavy repair tracks.',
    mainLines: 3,
    platformTracks: 0,
    sidings: 6,
    repairBays: 3,
    turntables: 2,
    lineLengthM: 3620,
    maxTrains: 12,
    switchComplexity: 'High',
    difficulty: 5,
    layout: ['3 Through Lines', '6 Staging Roads', '3 Repair Tracks', '2 Turntable Sheds'],
  },
];

export const STATION_IDS = STATION_SPECS.map((s) => s.id);

const PASS: RouteRequest[] = ['PASS'];
const STOP: RouteRequest[] = ['PASS', 'STOP_BY'];
const HELD: RouteRequest[] = ['LAST_STOP'];
const FIX: RouteRequest[] = ['REPAIR'];

function merge(b: YardBuilder, id: string, x: number, y: number, label?: string, sub?: string) {
  return b.node(id, x, y, { kind: 'merge', label, sub });
}

function ladderNodes(b: YardBuilder, prefix: string, xs: number[], ys: number[]) {
  return ys.map((y, i) =>
    b.node(`${prefix}${i + 1}`, xs[i], y, { kind: i === ys.length - 1 ? 'merge' : 'switch' }),
  );
}

function chainLinks(b: YardBuilder, tag: string, nodes: string[], speed: number) {
  const links: string[] = [];
  for (let i = 1; i < nodes.length; i++) {
    links.push(b.edge(`${tag}d${i}`, nodes[i - 1], nodes[i], { kind: 'approach', speed }));
  }
  return links;
}

function tie(
  b: YardBuilder,
  o: { nodes: string[]; toes: string[]; links: string[]; ids: (string | null)[]; roads: string[]; labels: string[] },
) {
  for (let i = 0; i < o.nodes.length - 1; i++) {
    const id = o.ids[i];
    if (!id) continue;
    b.turnout(id, o.nodes[i], o.toes[i], o.roads[i], o.links[i], o.labels[i]);
  }
}

function deadEnd(
  b: YardBuilder,
  o: { id: string; from: string; mid: string; buffer: string; kind: TrackKind; label: string; speed: number; tail?: number },
) {
  b.edge(`${o.id}a`, o.from, o.mid, { kind: o.kind, label: o.label, speed: o.speed });
  b.edge(`${o.id}b`, o.mid, o.buffer, { kind: o.kind, speed: o.tail ?? 20 });
}

function finish(b: YardBuilder): Yard {
  const yard = b.build();
  const total = yard.edgeList.reduce((a, e) => a + e.line.lengthM, 0);
  yard.spec = { ...yard.spec, lineLengthM: Math.round(total / 10) * 10 };
  return yard;
}

function buildLocal() {
  const b = new YardBuilder().size(1900, 900).meta(STATION_SPECS[0]);

  b.portalIn('WIN', 40, 160, 'West Approach');
  b.portalOut('EOUT', 1860, 160, 'East Exit');

  b.node('LS', 860, 290, { kind: 'switch' });
  merge(b, 'LX', 1000, 160, undefined, 'Crossover merge');
  merge(b, 'LM1', 1180, 160, 'Main 1');
  merge(b, 'LM2', 1140, 290, 'Main 2');
  merge(b, 'LP1', 1150, 420, 'Platform 1');
  merge(b, 'EP1', 1650, 420, 'Platform 1 east');
  merge(b, 'LS1', 1150, 550, 'Siding 1');
  b.buffer('LS1B', 1450, 550, 'Siding 1 buffer');
  merge(b, 'LR1', 1180, 680, 'Repair Bay');
  b.buffer('LR1B', 1470, 680, 'Repair Bay buffer');
  merge(b, 'EM1', 1700, 160, 'Main 1 east');
  merge(b, 'EM2', 1600, 290, 'Main 2 east');

  b.edge('e-ap', 'EOUT', 'EM1', { kind: 'approach', speed: 110 });

  const west = ladderNodes(b, 'W', [240, 400, 560, 720, 880], [160, 290, 420, 550, 680]);
  b.edge('w-ap', 'WIN', 'W1', { kind: 'approach', speed: 110 });
  const westLinks = chainLinks(b, 'W', west, 80);
  tie(b, {
    nodes: west,
    toes: ['w-ap', ...westLinks.slice(0, -1)],
    links: westLinks,
    ids: ['L-S1', 'L-S2', 'L-S3', 'L-S4', null],
    roads: ['m1a', 'm2a', 'p1a', 's1a', 'r1a'],
    labels: ['Main 1', 'Main 2', 'Platform 1', 'Siding 1', 'Repair Bay'],
  });

  b.edge('m1a', 'W1', 'LX', { kind: 'main', label: 'Main 1', speed: 140 });
  b.edge('m1x', 'LX', 'LM1', { kind: 'main', label: 'Main 1', speed: 140 });
  b.edge('xc1', 'LS', 'LX', { kind: 'approach', label: 'Main 1/2 crossover', speed: 70 });
  b.edge('m2a', 'W2', 'LS', { kind: 'main', label: 'Main 2', speed: 140 });
  b.edge('m2x', 'LS', 'LM2', { kind: 'main', label: 'Main 2', speed: 140 });
  b.edge('m1e', 'LM1', 'EM1', { kind: 'main', speed: 140 });
  b.edge('m2e', 'LM2', 'EM2', { kind: 'main', speed: 140 });

  b.edge('p1a', 'W3', 'LP1', { kind: 'platform', label: 'Platform 1', speed: 45 });
  b.edge('p1e', 'LP1', 'EP1', { kind: 'platform', speed: 45 });
  deadEnd(b, { id: 's1', from: 'W4', mid: 'LS1', buffer: 'LS1B', kind: 'siding', label: 'Siding 1', speed: 50, tail: 25 });
  deadEnd(b, { id: 'r1', from: 'W5', mid: 'LR1', buffer: 'LR1B', kind: 'repair', label: 'Repair Bay', speed: 20, tail: 15 });

  const eastLinks = [b.edge('cm', 'EM2', 'EM1', { kind: 'approach', speed: 80 })];
  b.edge('cp', 'EP1', 'EM2', { kind: 'approach', speed: 80 });
  void eastLinks;

  b.turnout('L-CX', 'LS', 'm2a', 'm2x', 'xc1', 'Main 2 crossover points');

  b.dest('main-1', 'LM1', 'Main Line 1', 'main', 'Fast through run', PASS, 'Main 1');
  b.dest('main-2', 'LM2', 'Main Line 2', 'main', 'Through run with crossover', PASS, 'Main 2');
  b.dest('platform-1', 'LP1', 'Platform 1', 'platform', 'Single-face halt · 300 m', STOP, 'Platform 1', 300);
  b.dest('siding-1', 'LS1', 'Siding 1', 'siding', 'Dead-end holding siding', HELD, 'Siding 1', 420);
  b.dest('repair-1', 'LR1', 'Repair Bay', 'repair', 'Low speed workshop road', FIX, 'Repair Bay', 520);

  b.note(930, 120, 'Main 1/2 crossover', 'warn');
  b.note(1180, 620, 'Workshop approach 20 km/h', 'normal');
  return finish(b);
}

function buildGrand() {
  const b = new YardBuilder().size(3200, 1560).meta(STATION_SPECS[1]);

  b.portalIn('WIN', 40, 140, 'West Approach');
  b.portalOut('EOUT', 3140, 140, 'East Approach');

  b.node('LS', 1700, 250, { kind: 'switch' });
  merge(b, 'LX', 1840, 360, undefined, 'Crossover merge');
  merge(b, 'GM1', 1800, 140, 'Main 1');
  merge(b, 'GM2', 1800, 250, 'Main 2');
  merge(b, 'GM3', 1800, 360, 'Main 3');
  merge(b, 'GM4', 1800, 470, 'Main 4');
  merge(b, 'GP1', 1800, 580, 'Platform 1');
  merge(b, 'GP2', 1800, 690, 'Platform 2');
  merge(b, 'GP3', 1800, 800, 'Platform 3');
  merge(b, 'GS1', 1980, 910, 'Siding 1');
  b.buffer('GS1B', 2280, 910, 'Siding 1 buffer');
  merge(b, 'GS2', 2180, 1020, 'Siding 2');

  merge(b, 'E1', 2700, 140, 'Main 1 east');
  merge(b, 'ED', 2635, 195, undefined, 'Depot lead junction');
  merge(b, 'E2', 2570, 250, 'Main 2 east');
  merge(b, 'E3', 2440, 360, 'Main 3 east');
  merge(b, 'E4', 2310, 470, 'Main 4 east');
  merge(b, 'E5', 2180, 580, 'Platform 1 east');
  merge(b, 'E6', 2050, 690, 'Platform 2 east');
  merge(b, 'E7', 1920, 800, 'Platform 3 east');

  const tt = b.turntable({
    id: 'TT-01',
    pos: { x: 2560, y: 1000 },
    radius: 130,
    angle0: 90,
    speed: 15,
    ports: [
      { name: 'Depot lead', angleDeg: 270, role: 'lead' },
      { name: 'Store road', angleDeg: 0, role: 'lead' },
      { name: 'Depot fan', angleDeg: 90, role: 'stall' },
      { name: 'Siding 2 lead', angleDeg: 180, role: 'lead' },
    ],
  });

  merge(b, 'DH', 2600, 1250, 'Depot headshunt');
  b.buffer('DHB', 2320, 1250, 'Depot headshunt buffer');
  merge(b, 'DR1', 2840, 1290, 'Depot fan 1');
  merge(b, 'DR2', 2880, 1380, 'Depot fan 2');
  merge(b, 'DR3', 2920, 1470, 'Depot fan 3');
  merge(b, 'GR1', 2980, 1290, 'Depot 1');
  b.buffer('GR1B', 3160, 1290, 'Depot 1 buffer');
  merge(b, 'GR2', 2980, 1380, 'Depot 2');
  b.buffer('GR2B', 3160, 1380, 'Depot 2 buffer');
  merge(b, 'GR3', 2980, 1470, 'Depot 3');
  b.buffer('GR3B', 3160, 1470, 'Depot 3 buffer');
  b.buffer('SB', 2980, 1000, 'Store road buffer');

  const west = ladderNodes(b, 'W', [240, 410, 580, 750, 920, 1090, 1260, 1430, 1600], [
    140, 250, 360, 470, 580, 690, 800, 910, 1020,
  ]);
  b.edge('w-ap', 'WIN', 'W1', { kind: 'approach', speed: 120 });
  b.edge('e-ap', 'EOUT', 'E1', { kind: 'approach', speed: 120 });
  const westLinks = chainLinks(b, 'W', west, 95);
  tie(b, {
    nodes: west,
    toes: ['w-ap', ...westLinks.slice(0, -1)],
    links: westLinks,
    ids: ['G-S1', 'G-S2', 'G-S3', 'G-S4', 'G-S5', 'G-S6', 'G-S7', 'G-S8', null],
    roads: ['m1a', 'm2a', 'm3a', 'm4a', 'p1a', 'p2a', 'p3a', 'gs1a', 'gs2a'],
    labels: ['Main 1', 'Main 2', 'Main 3', 'Main 4', 'Platform 1', 'Platform 2', 'Platform 3', 'Siding 1', 'Siding 2'],
  });

  b.edge('m1a', 'W1', 'GM1', { kind: 'main', label: 'Main 1', speed: 150 });
  b.edge('m1m', 'GM1', 'E1', { kind: 'main', speed: 150 });
  b.edge('m2a', 'W2', 'LS', { kind: 'main', label: 'Main 2', speed: 150 });
  b.edge('m2x', 'LS', 'GM2', { kind: 'main', label: 'Main 2', speed: 150 });
  b.edge('xc1', 'LS', 'LX', { kind: 'approach', label: 'Main 2/3 crossover', speed: 75 });
  b.edge('m3a', 'W3', 'LX', { kind: 'main', label: 'Main 3', speed: 150 });
  b.edge('m3x', 'LX', 'GM3', { kind: 'main', speed: 150 });
  b.edge('m4a', 'W4', 'GM4', { kind: 'main', label: 'Main 4', speed: 150 });
  b.edge('m4m', 'GM4', 'E4', { kind: 'main', speed: 150 });
  b.edge('m2m', 'GM2', 'E2', { kind: 'main', speed: 150 });
  b.edge('m3m', 'GM3', 'E3', { kind: 'main', speed: 150 });

  b.edge('p1a', 'W5', 'GP1', { kind: 'platform', label: 'Platform 1', speed: 50 });
  b.edge('p1e', 'GP1', 'E5', { kind: 'platform', speed: 50 });
  b.edge('p2a', 'W6', 'GP2', { kind: 'platform', label: 'Platform 2', speed: 50 });
  b.edge('p2e', 'GP2', 'E6', { kind: 'platform', speed: 50 });
  b.edge('p3a', 'W7', 'GP3', { kind: 'platform', label: 'Platform 3', speed: 50 });
  b.edge('p3e', 'GP3', 'E7', { kind: 'platform', speed: 50 });

  b.edge('gs1a', 'W8', 'GS1', { kind: 'siding', label: 'Siding 1', speed: 55 });
  b.edge('gs1b', 'GS1', 'GS1B', { kind: 'siding', speed: 25 });
  b.edge('gs2a', 'W9', 'GS2', { kind: 'siding', label: 'Siding 2', speed: 55 });
  b.track('gs2b', 'GS2', tt.ports[3].nodeId, [{ x: 2300, y: 1110 }], {
    kind: 'siding',
    speed: 35,
    label: 'TT-01 lead W',
  });
  b.track('dep-ln', 'ED', tt.ports[0].nodeId, [{ x: 2660, y: 420 }, { x: 2600, y: 700 }], {
    kind: 'approach',
    speed: 35,
    label: 'Depot lead',
  });
  b.track('sto', tt.ports[1].nodeId, 'SB', [{ x: 2830, y: 1090 }], { kind: 'approach', speed: 25, label: 'Store road' });
  b.edge('dep-s', tt.ports[2].nodeId, 'DH', { kind: 'approach', speed: 20, label: 'Depot fan lead' });

  b.edge('dep-1', 'DH', 'DR1', { kind: 'approach', speed: 20 });
  b.edge('dep-hb', 'DH', 'DHB', { kind: 'approach', speed: 15 });
  b.edge('dep-1a', 'DR1', 'GR1', { kind: 'repair', label: 'Depot 1', speed: 20 });
  b.edge('dep-2', 'DR1', 'DR2', { kind: 'approach', speed: 20 });
  b.edge('dep-2a', 'DR2', 'GR2', { kind: 'repair', label: 'Depot 2', speed: 20 });
  b.edge('dep-3', 'DR2', 'DR3', { kind: 'approach', speed: 20 });
  b.edge('dep-3a', 'DR3', 'GR3', { kind: 'repair', label: 'Depot 3', speed: 20 });
  b.edge('dep-1b', 'GR1', 'GR1B', { kind: 'repair', speed: 15 });
  b.edge('dep-2b', 'GR2', 'GR2B', { kind: 'repair', speed: 15 });
  b.edge('dep-3b', 'GR3', 'GR3B', { kind: 'repair', speed: 15 });

  b.edge('c7', 'E7', 'E6', { kind: 'approach', speed: 95 });
  b.edge('c6', 'E6', 'E5', { kind: 'approach', speed: 95 });
  b.edge('c5', 'E5', 'E4', { kind: 'approach', speed: 95 });
  b.edge('c4', 'E4', 'E3', { kind: 'approach', speed: 95 });
  b.edge('c3', 'E3', 'E2', { kind: 'approach', speed: 95 });
  b.edge('c2a', 'E2', 'ED', { kind: 'approach', speed: 95 });
  b.edge('c2b', 'ED', 'E1', { kind: 'approach', speed: 95 });
  b.turnout('G-D0', 'ED', 'c2a', 'c2b', 'dep-ln', 'Depot lead points');

  b.turnout('G-CX', 'LS', 'm2a', 'm2x', 'xc1', 'Main 2 crossover points');
  b.turnout('G-D1', 'DH', 'dep-s', 'dep-1', 'dep-hb', 'Depot headshunt points');
  b.turnout('G-D2', 'DR1', 'dep-1', 'dep-1a', 'dep-2', 'Depot fan 1');
  b.turnout('G-D3', 'DR2', 'dep-2', 'dep-2a', 'dep-3', 'Depot fan 2');

  b.dest('main-1', 'GM1', 'Main Line 1', 'main', 'Fastest through run', PASS, 'Main 1');
  b.dest('main-2', 'GM2', 'Main Line 2', 'main', 'Through run with crossover', PASS, 'Main 2');
  b.dest('main-3', 'GM3', 'Main Line 3', 'main', 'Through run with crossover', PASS, 'Main 3');
  b.dest('main-4', 'GM4', 'Main Line 4', 'main', 'Through run', PASS, 'Main 4');
  b.dest('platform-1', 'GP1', 'Platform 1', 'platform', 'Replatform road · 520 m', STOP, 'Platform 1', 520);
  b.dest('platform-2', 'GP2', 'Platform 2', 'platform', 'Replatform road · 420 m', STOP, 'Platform 2', 420);
  b.dest('platform-3', 'GP3', 'Platform 3', 'platform', 'Replatform road · 340 m', STOP, 'Platform 3', 340);
  b.dest('siding-1', 'GS1', 'Siding 1', 'siding', 'Holding siding, run-round', HELD, 'Siding 1', 560);
  b.dest('siding-2', 'GS2', 'Siding 2', 'siding', 'Depot approach siding', HELD, 'Siding 2', 500);
  b.dest('depot-1', 'GR1', 'Depot 1', 'repair', 'Turntable shed road · 520 m', FIX, 'Depot 1', 520);
  b.dest('depot-2', 'GR2', 'Depot 2', 'repair', 'Turntable shed road · 460 m', FIX, 'Depot 2', 460);
  b.dest('depot-3', 'GR3', 'Depot 3', 'repair', 'Turntable shed road · 380 m', FIX, 'Depot 3', 380);

  b.note(2560, 830, 'TT-01 must sit at 90°', 'warn');
  b.note(2600, 1190, 'Depot fan 20 km/h', 'normal');
  return finish(b);
}

function buildFreight() {
  const b = new YardBuilder().size(3600, 1900).meta(STATION_SPECS[2]);

  b.portalIn('WIN', 40, 140, 'West Interchange');
  b.portalOut('EOUT', 3540, 140, 'East Interchange');

  merge(b, 'FM1', 2000, 140, 'Through 1');
  merge(b, 'FM2', 2000, 250, 'Through 2');
  merge(b, 'FM3', 2000, 360, 'Through 3');
  merge(b, 'XS1', 2200, 470, 'Staging 1');
  b.buffer('XS1B', 2600, 470, 'Staging 1 buffer');
  merge(b, 'XS2', 2200, 580, 'Staging 2');
  b.buffer('XS2B', 2600, 580, 'Staging 2 buffer');
  merge(b, 'XS3', 2200, 690, 'Staging 3');
  b.buffer('XS3B', 2600, 690, 'Staging 3 buffer');
  merge(b, 'XS4', 2200, 800, 'Staging 4');
  b.buffer('XS4B', 2600, 800, 'Staging 4 buffer');
  merge(b, 'XS5', 2200, 910, 'Staging 5');
  b.buffer('XS5B', 2600, 910, 'Staging 5 buffer');
  merge(b, 'XS6M', 1900, 1020, undefined, 'Coach lead junction');
  merge(b, 'XS6', 2200, 1020, 'Staging 6');
  merge(b, 'XS6H', 2600, 1020, 'Staging 6 headshunt');
  b.buffer('XS6B', 2620, 1090, 'Staging 6 buffer');

  merge(b, 'E1', 3060, 140, 'Through 1 east');
  merge(b, 'T1H', 2995, 195, undefined, 'Workshop lead junction');
  merge(b, 'E2', 2930, 250, 'Through 2 east');
  merge(b, 'E3', 2800, 360, 'Through 3 east');

  const tt1 = b.turntable({
    id: 'TT-01',
    pos: { x: 2900, y: 1250 },
    radius: 130,
    angle0: 90,
    speed: 12,
    ports: [
      { name: 'Workshop lead', angleDeg: 270, role: 'lead' },
      { name: 'Reserve road', angleDeg: 0, role: 'stall' },
      { name: 'Workshop fan', angleDeg: 90, role: 'stall' },
      { name: 'Staging 6 lead', angleDeg: 180, role: 'lead' },
    ],
  });
  merge(b, 'RH', 2900, 1490, 'Workshop headshunt');
  b.buffer('RHB', 2680, 1490, 'Workshop headshunt buffer');
  merge(b, 'HR1', 3140, 1490, 'Workshop fan 1');
  merge(b, 'HR2', 3180, 1570, 'Workshop fan 2');
  merge(b, 'HR3', 3220, 1650, 'Workshop fan 3');
  merge(b, 'HP1', 3400, 1490, 'Repair 1');
  b.buffer('HP1B', 3540, 1490, 'Repair 1 buffer');
  merge(b, 'HP2', 3400, 1570, 'Repair 2');
  b.buffer('HP2B', 3540, 1570, 'Repair 2 buffer');
  merge(b, 'HP3', 3400, 1650, 'Repair 3');
  b.buffer('HP3B', 3540, 1650, 'Repair 3 buffer');
  merge(b, 'HRV', 3260, 1250, 'Reserve Road');
  b.buffer('HRVB', 3420, 1250, 'Reserve road buffer');

  const tt2 = b.turntable({
    id: 'TT-02',
    pos: { x: 1150, y: 1400 },
    radius: 130,
    angle0: 90,
    speed: 12,
    ports: [
      { name: 'Coach fan lead', angleDeg: 270, role: 'lead' },
      { name: 'Spare spur', angleDeg: 0, role: 'stall' },
      { name: 'Coach fan', angleDeg: 90, role: 'stall' },
      { name: 'Reserve road', angleDeg: 180, role: 'stall' },
    ],
  });
  merge(b, 'CH', 1250, 1620, 'Coach headshunt');
  b.buffer('CHB', 1020, 1620, 'Coach headshunt buffer');
  merge(b, 'CR1', 1520, 1620, 'Coach fan 1');
  merge(b, 'CR2', 1560, 1700, 'Coach fan 2');
  merge(b, 'CR3', 1600, 1780, 'Coach fan 3');
  merge(b, 'CP1', 1800, 1620, 'Coach Shed 1');
  b.buffer('CP1B', 1980, 1620, 'Coach Shed 1 buffer');
  merge(b, 'CP2', 1800, 1700, 'Coach Shed 2');
  b.buffer('CP2B', 1980, 1700, 'Coach Shed 2 buffer');
  merge(b, 'CP3', 1800, 1780, 'Coach Shed 3');
  b.buffer('CP3B', 1980, 1780, 'Coach Shed 3 buffer');
  merge(b, 'CSV', 880, 1400, 'Off-service Siding');
  b.buffer('CSVB', 700, 1400, 'Off-service siding buffer');
  b.buffer('CBX', 1440, 1300, 'TT-02 spare spur');

  b.edge('e-ap', 'EOUT', 'E1', { kind: 'approach', speed: 100 });

  const west = ladderNodes(b, 'W', [240, 410, 580, 750, 920, 1090, 1260, 1430, 1600], [
    140, 250, 360, 470, 580, 690, 800, 910, 1020,
  ]);
  b.edge('w-ap', 'WIN', 'W1', { kind: 'approach', speed: 100 });
  const westLinks = chainLinks(b, 'W', west, 85);
  tie(b, {
    nodes: west,
    toes: ['w-ap', ...westLinks.slice(0, -1)],
    links: westLinks,
    ids: ['F-S1', 'F-S2', 'F-S3', 'F-S4', 'F-S5', 'F-S6', 'F-S7', 'F-S8', null],
    roads: ['t1a', 't2a', 't3a', 'xs1a', 'xs2a', 'xs3a', 'xs4a', 'xs5a', 'xs6a'],
    labels: [
      'Through 1',
      'Through 2',
      'Through 3',
      'Staging 1',
      'Staging 2',
      'Staging 3',
      'Staging 4',
      'Staging 5',
      'Staging 6',
    ],
  });

  b.edge('t1a', 'W1', 'FM1', { kind: 'main', label: 'Through 1', speed: 120 });
  b.edge('t1m', 'FM1', 'E1', { kind: 'main', speed: 120 });
  b.edge('t2a', 'W2', 'FM2', { kind: 'main', label: 'Through 2', speed: 120 });
  b.edge('t2m', 'FM2', 'E2', { kind: 'main', speed: 120 });
  b.edge('t3a', 'W3', 'FM3', { kind: 'main', label: 'Through 3', speed: 120 });
  b.edge('t3m', 'FM3', 'E3', { kind: 'main', speed: 120 });

  for (let i = 0; i < 5; i++) {
    b.edge(`xs${i + 1}a`, `W${i + 4}`, `XS${i + 1}`, { kind: 'staging', label: `Staging ${i + 1}`, speed: 45 });
    b.edge(`xs${i + 1}b`, `XS${i + 1}`, `XS${i + 1}B`, { kind: 'staging', speed: 20 });
  }
  b.edge('xs6a', 'W9', 'XS6M', { kind: 'staging', label: 'Staging 6', speed: 45 });
  b.edge('xs6m', 'XS6M', 'XS6', { kind: 'staging', speed: 45 });
  b.edge('xs6b', 'XS6', 'XS6H', { kind: 'staging', speed: 20 });
  b.edge('xs6sp', 'XS6H', 'XS6B', { kind: 'staging', speed: 15 });

  b.edge('c3', 'E3', 'E2', { kind: 'approach', speed: 85 });
  b.edge('c2a', 'E2', 'T1H', { kind: 'approach', speed: 85 });
  b.edge('c2b', 'T1H', 'E1', { kind: 'approach', speed: 85 });
  b.turnout('F-W0', 'T1H', 'c2a', 'c2b', 'wsl', 'Workshop lead points');

  b.track('wsl', 'T1H', tt1.ports[0].nodeId, [{ x: 3080, y: 500 }, { x: 3060, y: 850 }], {
    kind: 'approach',
    speed: 35,
    label: 'Workshop lead',
  });
  b.track('ws-l2', 'XS6H', tt1.ports[3].nodeId, [{ x: 2690, y: 1120 }], {
    kind: 'staging',
    speed: 30,
    label: 'Workshop lead W',
  });
  b.track('hstore', tt1.ports[1].nodeId, 'HRV', [{ x: 3140, y: 1150 }], {
    kind: 'approach',
    speed: 25,
    label: 'Reserve road',
  });
  b.edge('hresv', 'HRV', 'HRVB', { kind: 'approach', speed: 15 });
  b.edge('hws', tt1.ports[2].nodeId, 'RH', { kind: 'approach', speed: 20, label: 'Workshop fan lead' });
  b.edge('hw1', 'RH', 'HR1', { kind: 'approach', speed: 20 });
  b.edge('hwb', 'RH', 'RHB', { kind: 'approach', speed: 15 });
  b.edge('hw1a', 'HR1', 'HP1', { kind: 'repair', label: 'Repair 1', speed: 18 });
  b.edge('hw2', 'HR1', 'HR2', { kind: 'approach', speed: 20 });
  b.edge('hw2a', 'HR2', 'HP2', { kind: 'repair', label: 'Repair 2', speed: 18 });
  b.edge('hw3', 'HR2', 'HR3', { kind: 'approach', speed: 20 });
  b.edge('hw3a', 'HR3', 'HP3', { kind: 'repair', label: 'Repair 3', speed: 18 });
  b.edge('hw1b', 'HP1', 'HP1B', { kind: 'repair', speed: 15 });
  b.edge('hw2b', 'HP2', 'HP2B', { kind: 'repair', speed: 15 });
  b.edge('hw3b', 'HP3', 'HP3B', { kind: 'repair', speed: 15 });

  b.turnout('F-H1', 'RH', 'hws', 'hw1', 'hwb', 'Workshop headshunt points');
  b.turnout('F-H2', 'HR1', 'hw1', 'hw1a', 'hw2', 'Workshop fan 1');
  b.turnout('F-H3', 'HR2', 'hw2', 'hw2a', 'hw3', 'Workshop fan 2');

  b.track('csl', 'XS6M', tt2.ports[0].nodeId, [{ x: 1600, y: 1180 }, { x: 1330, y: 1240 }], {
    kind: 'approach',
    speed: 30,
    label: 'Coach fan lead',
  });
  b.track('cspur', tt2.ports[1].nodeId, 'CBX', [{ x: 1370, y: 1320 }], { kind: 'approach', speed: 15 });
  b.track('csv', tt2.ports[3].nodeId, 'CSV', [{ x: 930, y: 1330 }], {
    kind: 'depot',
    speed: 20,
    label: 'Off-service siding',
  });
  b.edge('csvsp', 'CSV', 'CSVB', { kind: 'depot', speed: 15 });
  b.edge('cws', tt2.ports[2].nodeId, 'CH', { kind: 'approach', speed: 20, label: 'Coach fan lead' });
  b.edge('cw1', 'CH', 'CR1', { kind: 'approach', speed: 20 });
  b.edge('cwb', 'CH', 'CHB', { kind: 'approach', speed: 15 });
  b.edge('cw1a', 'CR1', 'CP1', { kind: 'depot', label: 'Coach Shed 1', speed: 20 });
  b.edge('cw2', 'CR1', 'CR2', { kind: 'approach', speed: 20 });
  b.edge('cw2a', 'CR2', 'CP2', { kind: 'depot', label: 'Coach Shed 2', speed: 20 });
  b.edge('cw3', 'CR2', 'CR3', { kind: 'approach', speed: 20 });
  b.edge('cw3a', 'CR3', 'CP3', { kind: 'depot', label: 'Coach Shed 3', speed: 20 });
  b.edge('cw1b', 'CP1', 'CP1B', { kind: 'depot', speed: 15 });
  b.edge('cw2b', 'CP2', 'CP2B', { kind: 'depot', speed: 15 });
  b.edge('cw3b', 'CP3', 'CP3B', { kind: 'depot', speed: 15 });

  b.turnout('F-C1', 'CH', 'cws', 'cw1', 'cwb', 'Coach headshunt points');
  b.turnout('F-C2', 'CR1', 'cw1', 'cw1a', 'cw2', 'Coach fan 1');
  b.turnout('F-C3', 'CR2', 'cw2', 'cw2a', 'cw3', 'Coach fan 2');

  b.dest('through-1', 'FM1', 'Through Line 1', 'main', 'Interchange run', PASS, 'Through 1');
  b.dest('through-2', 'FM2', 'Through Line 2', 'main', 'Interchange run', PASS, 'Through 2');
  b.dest('through-3', 'FM3', 'Through Line 3', 'main', 'Interchange run', PASS, 'Through 3');
  for (let i = 0; i < 6; i++) {
    b.dest(
      `staging-${i + 1}`,
      `XS${i + 1}`,
      `Staging ${i + 1}`,
      'staging',
      `Freight standing road · ${900 - i * 60} m`,
      HELD,
      `Staging ${i + 1}`,
      900 - i * 60,
    );
  }
  b.dest('repair-1', 'HP1', 'Repair 1', 'repair', 'Heavy workshop · 700 m', FIX, 'Repair 1', 700);
  b.dest('repair-2', 'HP2', 'Repair 2', 'repair', 'Heavy workshop · 620 m', FIX, 'Repair 2', 620);
  b.dest('repair-3', 'HP3', 'Repair 3', 'repair', 'Heavy workshop · 540 m', FIX, 'Repair 3', 540);
  b.dest('reserve-1', 'HRV', 'Reserve Road', 'staging', 'TT-01 east standing road', HELD, 'Reserve road', 640);
  b.dest('coach-1', 'CP1', 'Coach Shed 1', 'depot', 'Off-service stock · 620 m', HELD, 'Coach shed 1', 620);
  b.dest('coach-2', 'CP2', 'Coach Shed 2', 'depot', 'Off-service stock · 540 m', HELD, 'Coach shed 2', 540);
  b.dest('coach-3', 'CP3', 'Coach Shed 3', 'depot', 'Off-service stock · 460 m', HELD, 'Coach shed 3', 460);

  b.note(2900, 1090, 'TT-01 must sit at 90°', 'warn');
  b.note(1150, 1240, 'TT-02 must sit at 90°', 'warn');
  return finish(b);
}

const BUILDERS: Record<string, () => Yard> = {
  local: buildLocal,
  grand: buildGrand,
  freight: buildFreight,
};

const cache = new Map<string, Yard>();

export function getYard(id: string): Yard {
  const hit = cache.get(id);
  if (hit) return hit;
  const build = BUILDERS[id] ?? buildLocal;
  const yard = build();
  cache.set(id, yard);
  return yard;
}

export function stationSpecFor(id: string): StationSpec {
  return STATION_SPECS.find((s) => s.id === id) ?? STATION_SPECS[0];
}

export const trackKindLabel: Record<TrackKind, string> = {
  main: 'Through',
  platform: 'Platform',
  siding: 'Siding',
  staging: 'Staging',
  repair: 'Workshop',
  depot: 'Depot',
  approach: 'Throat',
};