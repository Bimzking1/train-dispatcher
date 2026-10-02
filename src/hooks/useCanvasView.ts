import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.3;
const MAX_SCALE = 4.5;
const PAD = 20;
const DRAG_SLOP = 3;

export interface CanvasView {
  scale: number;
  tx: number;
  ty: number;
}

export interface ViewInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export function useCanvasView(contentW: number, contentH: number, insets: ViewInsets) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<CanvasView>({ scale: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(view);
  const manualRef = useRef(false);
  const movedRef = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);
  const { left, top, right, bottom } = insets;

  const set = useCallback((next: CanvasView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !contentW || !contentH) return;
    const availW = Math.max(120, el.clientWidth - left - right - PAD * 2);
    const availH = Math.max(120, el.clientHeight - top - bottom - PAD * 2);
    const scale = clamp(Math.min(availW / contentW, availH / contentH), MIN_SCALE, MAX_SCALE);
    set({
      scale,
      tx: left + PAD + (availW - contentW * scale) / 2,
      ty: top + PAD + (availH - contentH * scale) / 2,
    });
  }, [contentW, contentH, left, right, top, bottom, set]);

  useEffect(() => {
    manualRef.current = false;
  }, [contentW, contentH]);

  useEffect(() => {
    if (!manualRef.current) fit();
  }, [fit]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!manualRef.current) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      manualRef.current = true;
      const cur = viewRef.current;
      const next = clamp(cur.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = next / cur.scale;
      set({ scale: next, tx: cx - (cx - cur.tx) * k, ty: cy - (cy - cur.ty) * k });
    },
    [set],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const startPinch = useCallback(() => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const mid = localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
    pinchRef.current = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale: viewRef.current.scale, cx: mid.x, cy: mid.y };
  }, [localPoint]);

  const updatePinch = useCallback(() => {
    const p = pinchRef.current;
    if (!p) {
      startPinch();
      return;
    }
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const mid = localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
    const target = clamp((p.scale * Math.hypot(a.x - b.x, a.y - b.y)) / p.dist, MIN_SCALE, MAX_SCALE);
    const cur = viewRef.current;
    const k = target / cur.scale;
    manualRef.current = true;
    set({ scale: target, tx: mid.x - (mid.x - cur.tx) * k, ty: mid.y - (mid.y - cur.ty) * k });
  }, [localPoint, set, startPinch]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      movedRef.current = false;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        e.currentTarget.setPointerCapture(e.pointerId);
        startPinch();
      } else setDragging(true);
    },
    [startPinch],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size >= 2) {
        updatePinch();
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (!movedRef.current) {
        if (Math.hypot(dx, dy) <= DRAG_SLOP) return;
        movedRef.current = true;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      manualRef.current = true;
      const cur = viewRef.current;
      set({ scale: cur.scale, tx: cur.tx + dx, ty: cur.ty + dy });
    },
    [set, updatePinch],
  );

  const endPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinchRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const moved = movedRef.current;
    movedRef.current = false;
    if (!moved) return;
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const cx = left + (el.clientWidth - left - right) / 2;
      const cy = top + (el.clientHeight - top - bottom) / 2;
      zoomAt(factor, cx, cy);
    },
    [left, right, top, bottom, zoomAt],
  );

  const zoomAtClient = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const p = localPoint(clientX, clientY);
      zoomAt(factor, p.x, p.y);
    },
    [localPoint, zoomAt],
  );

  const reset = useCallback(() => {
    manualRef.current = false;
    fit();
  }, [fit]);

  return {
    wrapRef,
    view,
    dragging,
    zoomBy,
    zoomAtClient,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onClickCapture,
    },
  };
}