import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

interface AutoTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onValue: (v: string) => void;
  minHeight?: number;
  focusNow?: boolean;
}

/** Textarea that grows with its content. */
export function AutoTextarea({ value, onValue, minHeight = 62, focusNow, ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.max(minHeight, t.scrollHeight + 2)}px`;
  }, [value, minHeight]);
  useEffect(() => {
    if (focusNow) ref.current?.focus();
  }, [focusNow]);
  return <textarea ref={ref} rows={minHeight > 40 ? 2 : 1} value={value} onChange={(e) => onValue(e.target.value)} {...rest} />;
}

interface OptionSelectProps {
  value: string;
  options: string[];
  onValue: (v: string) => void;
  blank?: string;
  className?: string;
  'aria-label'?: string;
}

/** Select that keeps an unknown current value visible as "(not in list)". */
export function OptionSelect({ value, options, onValue, blank = 'Choose…', className, ...aria }: OptionSelectProps) {
  return (
    <select className={className} value={value} onChange={(e) => onValue(e.target.value)} {...aria}>
      <option value="">{blank}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      {value && !options.includes(value) && <option value={value}>{value} (not in list)</option>}
    </select>
  );
}

export function DaysInput({ value, onValue, ...rest }: { value: number | ''; onValue: (v: number | '') => void; placeholder?: string; 'aria-label'?: string }) {
  return (
    <input
      type="number"
      step="0.1"
      min="0"
      max="1"
      inputMode="decimal"
      value={value === '' ? '' : String(value)}
      onChange={(e) => onValue(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))}
      {...rest}
    />
  );
}
