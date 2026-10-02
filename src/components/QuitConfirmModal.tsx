import { useEffect } from 'react';
import { LogOut, X, TriangleAlert } from 'lucide-react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function QuitConfirmModal({ onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Leave the shift" onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-md rounded-2xl p-5">
        <header className="flex items-start justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
            <TriangleAlert size={20} />
          </span>
          <button onClick={onCancel} aria-label="Stay on shift"
            className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            <X size={16} />
          </button>
        </header>

        <h2 className="mt-4 text-xl font-semibold">End this shift?</h2>
        <p className="mt-1.5 text-sm text-slate-400">
          Your score for this shift is discarded and you will be returned to station selection. Trains still
          working the yard will stop where they are.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} autoFocus
            className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            Keep dispatching
          </button>
          <button onClick={onConfirm}
            className="flex h-10 items-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400">
            <LogOut size={15} /> End shift
          </button>
        </div>
      </div>
    </div>
  );
}