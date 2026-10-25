import { useEffect } from 'react';

let lockCount = 0;
let restore: (() => void) | undefined;

/** Lock the page and portal scroll containers; preserve nested modal locks. */
export function useModalScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    if (lockCount++ === 0) {
      const viewportRoots = [document.documentElement, document.body];
      const scrollContainers = Array.from(document.querySelectorAll<HTMLElement>(
        '.admin-main-viewport, .participant-main-viewport, .partner-main-viewport, .organizer-main-viewport',
      ));
      const nodes = [...viewportRoots, ...scrollContainers];
      const previous = nodes.map(node => ({ node, overflow: node.style.overflow, overscroll: node.style.overscrollBehavior }));
      viewportRoots.forEach(node => { node.style.overflow = 'clip'; node.style.overscrollBehavior = 'none'; });
      scrollContainers.forEach(node => { node.style.overflow = 'hidden'; node.style.overscrollBehavior = 'none'; });
      restore = () => previous.forEach(({ node, overflow, overscroll }) => {
        node.style.overflow = overflow; node.style.overscrollBehavior = overscroll;
      });
    }
    return () => { if (--lockCount === 0) { restore?.(); restore = undefined; } };
  }, [open]);
}
