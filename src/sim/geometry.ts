import type { Polyline, Vec } from '../types/simulator';

export const PX_PER_M = 2;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const dist = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);

export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function polyline(pts: Vec[]): Polyline {
  const clean: Vec[] = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.y - p.y) > 1e-6) clean.push(p);
  }
  const cum = [0];
  for (let i = 1; i < clean.length; i++) cum.push(cum[i - 1] + dist(clean[i - 1], clean[i]) / PX_PER_M);
  return { pts: clean, cum, lengthM: cum[cum.length - 1] };
}

export function pointAt(line: Polyline, d: number): Vec {
  const t = clamp(d, 0, line.lengthM);
  let i = 1;
  while (i < line.cum.length && line.cum[i] < t) i++;
  if (i >= line.cum.length) return line.pts[line.pts.length - 1];
  const span = line.cum[i] - line.cum[i - 1];
  const f = span > 1e-9 ? (t - line.cum[i - 1]) / span : 0;
  return lerp(line.pts[i - 1], line.pts[i], f);
}

export function headingAt(line: Polyline, d: number): number {
  const a = pointAt(line, d - 1.2);
  const b = pointAt(line, d + 1.2);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function straightPts(a: Vec, b: Vec): Vec[] {
  return [a, b];
}

export function sampleCubic(p0: Vec, p1: Vec, p2: Vec, p3: Vec, n = 26): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

export function curvePts(a: Vec, b: Vec, bend: number, n = 26): Vec[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [a, b];
  const h = bend * len;
  const p1 = { x: a.x + dx * 0.28 - (dy / len) * h, y: a.y + dy * 0.28 + (dx / len) * h };
  const p2 = { x: a.x + dx * 0.72 - (dy / len) * h, y: a.y + dy * 0.72 + (dx / len) * h };
  return sampleCubic(a, p1, p2, b, n);
}

const unit = (a: Vec, b: Vec): Vec => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
};

const bisect = (a: Vec, b: Vec): Vec => {
  const x = a.x + b.x;
  const y = a.y + b.y;
  const len = Math.hypot(x, y);
  return len < 1e-9 ? a : { x: x / len, y: y / len };
};

export function pathThrough(points: Vec[], n = 10): Vec[] {
  const pts: Vec[] = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) pts.push(p);
  }
  if (pts.length < 2) return pts.map((p) => ({ ...p }));

  const count = pts.length;
  const tan: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const inDir = i > 0 ? unit(pts[i - 1], pts[i]) : unit(pts[i], pts[i + 1]);
    const outDir = i < count - 1 ? unit(pts[i], pts[i + 1]) : unit(pts[i - 1], pts[i]);
    tan.push(bisect(inDir, outDir));
  }

  const out: Vec[] = [{ ...pts[0] }];
  for (let i = 0; i < count - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const segLen = dist(p1, p2);
    const k = Math.min(segLen * 0.4, 80);
    const c1 = { x: p1.x + tan[i].x * k, y: p1.y + tan[i].y * k };
    const c2 = { x: p2.x - tan[i + 1].x * k, y: p2.y - tan[i + 1].y * k };
    const seg = sampleCubic(p1, c1, c2, p2, n);
    for (let k2 = 1; k2 < seg.length; k2++) out.push(seg[k2]);
  }
  return out;
}

export function smoothPath(pts: Vec[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${r(pts[0].x)} ${r(pts[0].y)}`;
  let collinear = true;
  const a = pts[0];
  const b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const cross = (b.x - a.x) * (pts[i].y - a.y) - (b.y - a.y) * (pts[i].x - a.x);
    if (Math.abs(cross) > 0.6) {
      collinear = false;
      break;
    }
  }
  if (collinear) return `M${r(a.x)} ${r(a.y)}L${r(b.x)} ${r(b.y)}`;
  let d = `M${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

const r = (n: number) => Math.round(n * 100) / 100;

export function headingBetween(a: Vec, b: Vec): number {
  if (Math.abs(b.x - a.x) < 1e-6 && Math.abs(b.y - a.y) < 1e-6) return 0;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function offset(a: Vec, b: Vec, meters: number): Vec {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const t = (meters * PX_PER_M) / len;
  return lerp(a, b, clamp(t, -1, 2));
}