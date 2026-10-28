import { useEffect, useState } from 'react';
import { PARTICIPATION_CHANNEL, PARTICIPATION_CLIENT_ID } from '../services/participationSync';

export function useParticipationRefresh(enabled = true): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(value => value + 1); };
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(PARTICIPATION_CHANNEL);
    if (channel) channel.onmessage = event => {
      if (event.data?.type === 'changed' && event.data.sender !== PARTICIPATION_CLIENT_ID) refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      channel?.close();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);
  return revision;
}
