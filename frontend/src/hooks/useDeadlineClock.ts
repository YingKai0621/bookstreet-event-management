import { useEffect, useState } from 'react';

/** Update an open screen when its next registration deadline passes. */
export function useDeadlineClock(deadlines: (string | null | undefined)[]): number {
  const [now, setNow] = useState(Date.now);
  const deadlineKey = deadlines.filter(Boolean).join('|');
  useEffect(() => {
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const next = deadlineKey.split('|').map(Date.parse).filter(value => value >= current).sort((a, b) => a - b)[0];
      if (next !== undefined) timer = window.setTimeout(update, Math.min(next - current + 1, 2_147_483_647));
    };
    timer = window.setTimeout(update, 0);
    window.addEventListener('focus', update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', update);
    };
  }, [deadlineKey]);
  return now;
}
