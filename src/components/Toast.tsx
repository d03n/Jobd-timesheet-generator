import { useEffect } from 'react';
import { useStore } from '../state/store';

/** Bottom toast; with an action (Undo) it stays longer and accepts clicks. */
export function Toast() {
  const { toast, dismissToast } = useStore();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, toast.action ? 9000 : 3200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);
  return (
    <div className={`toast${toast ? ' show' : ''}${toast?.action ? ' actionable' : ''}`} role="status" aria-live="polite">
      {toast?.msg}
      {toast?.action && (
        <button
          type="button"
          className="toastbtn"
          onClick={() => {
            const fn = toast.action!.fn;
            dismissToast();
            fn();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
