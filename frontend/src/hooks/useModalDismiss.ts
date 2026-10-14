import { useEffect, useLayoutEffect, useRef } from 'react';
import { useModalScrollLock } from './useModalScrollLock';

const stack: Array<{ close: () => void }> = [];
function dismissTop(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.isComposing || event.repeat || !stack.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  stack[stack.length - 1].close();
}

/** Escape dismisses only the most recently opened modal; existing busy guards are preserved. */
export function useModalDismiss(open: boolean, onClose: () => void, options: { lockScroll?: boolean } = {}) {
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  useModalScrollLock(open && options.lockScroll !== false);
  useEffect(() => {
    if (!open) return;
    const entry = { close: () => closeRef.current() };
    if (!stack.length) window.addEventListener('keydown', dismissTop, true);
    stack.push(entry);
    return () => {
      const index = stack.indexOf(entry);
      if (index >= 0) stack.splice(index, 1);
      if (!stack.length) window.removeEventListener('keydown', dismissTop, true);
    };
  }, [open]);
}
