export const PARTICIPANT_BOOTH_SCAN_PATH = '/participant/booth-scan';

type BoothTokenState =
  | { kind: 'idle' }
  | { kind: 'ready'; token: string }
  | { kind: 'missing' }
  | { kind: 'invalid' };

let boothTokenState: BoothTokenState = { kind: 'idle' };

declare global {
  interface Window {
    __takeBoothScanTokenBootstrap?: () => string[] | null;
  }
}

/**
 * Captures the opaque BoothAssignment token before auth routing runs and
 * removes the fragment from the visible URL. The token remains client-only.
 */
export function captureBoothScanToken(): void {
  if (window.location.pathname !== PARTICIPANT_BOOTH_SCAN_PATH) return;

  const takeBootstrapToken = window.__takeBoothScanTokenBootstrap;
  delete window.__takeBoothScanTokenBootstrap;
  const tokenValues = takeBootstrapToken?.()
    ?? new URLSearchParams(window.location.hash.slice(1)).getAll('token');

  if (tokenValues.length === 1 && tokenValues[0].length > 0) {
    boothTokenState = { kind: 'ready', token: tokenValues[0] };
  } else if (tokenValues.length === 0 || (tokenValues.length === 1 && tokenValues[0].length === 0)) {
    boothTokenState = { kind: 'missing' };
  } else {
    boothTokenState = { kind: 'invalid' };
  }

  if (window.location.search || window.location.hash) {
    window.history.replaceState(window.history.state, '', PARTICIPANT_BOOTH_SCAN_PATH);
  }
}

export function readBoothScanToken(): string | null {
  return boothTokenState.kind === 'ready' ? boothTokenState.token : null;
}

export function hasInvalidBoothScanToken(): boolean {
  return boothTokenState.kind === 'invalid';
}

export function clearBoothScanToken(): void {
  boothTokenState = { kind: 'idle' };
}

export function boothScanUrl(token: string, origin = window.location.origin): string {
  return `${origin}${PARTICIPANT_BOOTH_SCAN_PATH}#token=${encodeURIComponent(token)}`;
}
