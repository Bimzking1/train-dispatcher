export type StationTier = 1 | 2 | 3;
export type TrainType = 'Express' | 'Freight' | 'Commuter';
export type RouteRequest = 'PASS' | 'STOP_BY' | 'LAST_STOP' | 'REPAIR';
export type SwitchState = 'THRU' | 'DIVERGENT';
export type TrackKind = 'main' | 'platform' | 'siding' | 'repair' | 'staging';
export type SimSpeed = 0 | 1 | 2 | 5;

export interface StationSpec {
  id: string; name: string; tier: StationTier;
  mainLines: number; platformTracks: number; sidings: number; repairBays: number; turntables: number;
  lineLengthM: number; maxTrains: number; switchComplexity: 'Low' | 'Medium' | 'High'; difficulty: 1 | 2 | 3 | 4 | 5;
  layout: string[];
}
export interface Track { id: string; kind: TrackKind; label: string; path: string; }
export interface Switch { id: string; x: number; y: number; state: SwitchState; locked: boolean; }
export interface Turntable { id: string; x: number; y: number; radius: number; angleDeg: number; }
export interface Train {
  id: string; type: TrainType; request: RouteRequest; cars: number; speedKmh: number;
  scheduledArrival: string; assignedRoute?: string;
}
export interface MockTrainOnTrack { trainId: string; x: number; y: number; rotation: number; cars: number; color: string; }
export interface RouteValidation { label: string; clear: boolean; }
export interface ScoreStats { onTimeRate: number; collisionAlerts: number; processed: number; }
