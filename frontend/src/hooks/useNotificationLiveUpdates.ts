import { useEffect } from 'react';
import { API_BASE_URL } from '../services/apiConfig';

const LIVE_UPDATE_EVENT = 'notifications:live-update';

/**
 * Keeps one server connection for the current workspace and announces inbox changes. The signal
 * has no content: subscribers reload through the normal inbox APIs, which remain the only truth.
 */
export function useNotificationStream(role: 'participant' | 'partner' | 'organizer') {
  useEffect(() => {
    if (typeof EventSource === 'undefined') return undefined;
    let source: EventSource | null = null;
    let openedBefore = false;
    const announce = () => window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));

    const connect = () => {
      if (source) return;
      source = new EventSource(`${API_BASE_URL}/${role}/notifications/stream`, { withCredentials: true });
      source.addEventListener('notifications-changed', announce);
      // A signal may have been sent while disconnected, so every reconnect reloads once.
      source.onopen = () => {
        if (openedBefore) announce();
        openedBefore = true;
      };
    };
    const disconnect = () => {
      source?.close();
      source = null;
    };
    // Hidden tabs release their connection, because browsers allow few per site over HTTP/1.1.
    const syncWithVisibility = () => {
      if (document.hidden) disconnect();
      else connect();
    };

    syncWithVisibility();
    document.addEventListener('visibilitychange', syncWithVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncWithVisibility);
      disconnect();
    };
  }, [role]);
}

export function useNotificationLiveRefresh(onChange: () => void) {
  useEffect(() => {
    window.addEventListener(LIVE_UPDATE_EVENT, onChange);
    return () => window.removeEventListener(LIVE_UPDATE_EVENT, onChange);
  }, [onChange]);
}
