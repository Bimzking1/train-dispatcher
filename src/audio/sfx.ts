import { useEffect } from 'react';
import { createUISFX, type CueName, type UISFXPlayer } from 'uisfx';
import type { LogEntry } from '../types/simulator';

const PACK = 'mechanical';
const VOLUME = 0.6;

let player: UISFXPlayer | null = null;
let muted = false;

function ensurePlayer(): UISFXPlayer | null {
  if (player) return player;
  try {
    player = createUISFX({ pack: PACK, volume: VOLUME, maxVoices: 8, cooldownMs: 70 });
    player.setEnabled(!muted);
  } catch {
    player = null;
  }
  return player;
}

export function unlockSfx(): void {
  const p = ensurePlayer();
  if (p) void p.unlock();
}

export function playSfx(cue: CueName, volume?: number): void {
  if (muted) return;
  const p = ensurePlayer();
  if (!p) return;
  p.play(cue, volume === undefined ? undefined : { volume });
}

export function playSfxRepeat(cue: CueName, times = 3, gapMs = 430): void {
  for (let i = 0; i < times; i++) {
    window.setTimeout(() => playSfx(cue, 0.85), i * gapMs);
  }
}

export function setSfxMuted(next: boolean): void {
  muted = next;
  player?.setEnabled(!next);
}

export function sfxPack(): string {
  return PACK;
}

export function useSfxUnlock(): void {
  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}

export function cueForLog(entry: LogEntry): CueName | null {
  if (entry.level === 'bad') return 'error';
  if (entry.level === 'warn') return 'warning';
  if (entry.level === 'good') return 'success';
  if (isArrival(entry)) return 'notification';
  if (entry.text.includes('signalled')) return 'info';
  return null;
}

export function isArrival(entry: LogEntry): boolean {
  return entry.text.includes('approaching');
}