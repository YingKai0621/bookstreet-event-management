export const PARTICIPANT_ATTENDANCE_SCAN_PATH = '/participant/attendance/scan';

type AttendanceTokenState =
  | { kind: 'idle' }
  | { kind: 'ready'; token: string }
  | { kind: 'missing' }
  | { kind: 'invalid' };

let attendanceTokenState: AttendanceTokenState = { kind: 'idle' };

declare global {
  interface Window {
    __takeAttendanceScanTokenBootstrap?: () => string[] | null;
  }
}

/**
 * Captures the opaque Activity attendance token before React and third-party
 * components mount, then removes the complete query string from browser history.
 */
export function captureAttendanceScanToken(): void {
  if (window.location.pathname !== PARTICIPANT_ATTENDANCE_SCAN_PATH) return;

  const takeBootstrapToken = window.__takeAttendanceScanTokenBootstrap;
  delete window.__takeAttendanceScanTokenBootstrap;
  const tokenValues = takeBootstrapToken?.()
    ?? new URLSearchParams(window.location.search).getAll('token');
  if (tokenValues.length === 1 && tokenValues[0].length > 0) {
    attendanceTokenState = { kind: 'ready', token: tokenValues[0] };
  } else if (tokenValues.length === 0 || (tokenValues.length === 1 && tokenValues[0].length === 0)) {
    attendanceTokenState = { kind: 'missing' };
  } else {
    attendanceTokenState = { kind: 'invalid' };
  }

  if (window.location.search || window.location.hash) {
    window.history.replaceState(window.history.state, '', PARTICIPANT_ATTENDANCE_SCAN_PATH);
  }
}

export function readAttendanceScanToken(): string | null {
  return attendanceTokenState.kind === 'ready' ? attendanceTokenState.token : null;
}

export function hasInvalidAttendanceScanToken(): boolean {
  return attendanceTokenState.kind === 'invalid';
}

export function clearAttendanceScanToken(): void {
  attendanceTokenState = { kind: 'idle' };
}
