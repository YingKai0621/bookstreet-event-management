import { useRef, useCallback } from 'react';

/**
 * Hook to handle backdrop clicks safely.
 * Prevents closing the modal when a user starts a selection/drag inside the modal
 * and releases the mouse outside on the backdrop (common when copying text / bôi đen).
 */
export function useBackdropClick(onClose: () => void) {
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target;
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
      onClose();
    }
    mouseDownTargetRef.current = null;
  }, [onClose]);

  return { onMouseDown, onClick };
}

