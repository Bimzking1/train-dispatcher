import { StationSpec, Train, Switch, MockTrainOnTrack, ScoreStats } from '../types/simulator';

export const STATIONS: StationSpec[] = [
  { id: 'local', name: 'Local Junction', tier: 1, mainLines: 2, platformTracks: 0, sidings: 1, repairBays: 1, turntables: 0,
    lineLengthM: 900, maxTrains: 4, switchComplexity: 'Low', difficulty: 1,
    layout: ['2 Main Lines', '1 Siding Track', '1 Repair Bay', '0 Turntables'] },
  { id: 'grand', name: 'Grand Central Terminal', tier: 2, mainLines: 4, platformTracks: 3, sidings: 2, repairBays: 0, turntables: 1,
    lineLengthM: 1800, maxTrains: 10, switchComplexity: 'Medium', difficulty: 3,
    layout: ['4 Main Lines', '3 Platform Tracks', '2 Holding Sidings', '1 Turntable'] },
  { id: 'freight', name: 'Industrial Freight Hub', tier: 3, mainLines: 3, platformTracks: 4, sidings: 0, repairBays: 3, turntables: 2,
    lineLengthM: 3200, maxTrains: 18, switchComplexity: 'High', difficulty: 5,
    layout: ['3 Through Lines', '4 Staging Tracks', '3 Heavy Repair Tracks', '2 Dual Turntables'] },
];

export const INBOUND_TRAINS: Train[] = [
  { id: 'ICE-104', type: 'Express', request: 'PASS', cars: 8, speedKmh: 142, scheduledArrival: '14:35' },
  { id: 'FR-802', type: 'Freight', request: 'REPAIR', cars: 14, speedKmh: 48, scheduledArrival: '14:41' },
  { id: 'RE-317', type: 'Commuter', request: 'STOP_BY', cars: 5, speedKmh: 76, scheduledArrival: '14:44' },
  { id: 'RB-209', type: 'Commuter', request: 'LAST_STOP', cars: 4, speedKmh: 64, scheduledArrival: '14:52' },
  { id: 'FR-515', type: 'Freight', request: 'PASS', cars: 20, speedKmh: 55, scheduledArrival: '15:03' },
];

export const INITIAL_SWITCHES: Switch[] = [
  { id: 'W-01', x: 500, y: 300, state: 'THRU', locked: false },
  { id: 'W-02', x: 700, y: 400, state: 'DIVERGENT', locked: false },
  { id: 'W-03', x: 1100, y: 400, state: 'THRU', locked: true },
];

export const MOCK_TRAINS: MockTrainOnTrack[] = [
  { trainId: 'ICE-104', x: 400, y: 240, rotation: 0, cars: 3, color: '#38bdf8' },
  { trainId: 'RE-317', x: 1000, y: 400, rotation: 0, cars: 3, color: '#34d399' },
  { trainId: 'FR-802', x: 300, y: 300, rotation: 0, cars: 3, color: '#fbbf24' },
];

export const INITIAL_STATS: ScoreStats = { onTimeRate: 94, collisionAlerts: 1, processed: 37 };
