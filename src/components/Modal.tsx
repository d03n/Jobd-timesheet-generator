import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  narrow?: boolean;
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Dialog with scrim, Escape to close, focus trap, and focus returned to the opener. */
export function Modal({ open, onClose, labelledBy, narrow, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const el = ref.current;
    const t = setTimeout(() => {
      const target = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('.btn.primary') ?? el?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.getClientRects().length);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      const o = opener.current as HTMLElement | null;
      if (o && document.contains(o)) o.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="overlay open" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${narrow ? ' narrow' : ''}`} ref={ref}>
        {children}
      </div>
    </div>
  );
}
