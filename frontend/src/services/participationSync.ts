export const PARTICIPATION_CHANNEL = 'bookstreet:participation';
export const PARTICIPATION_CLIENT_ID = Math.random().toString(36).slice(2);

export function publishParticipationChange(endpoint: string): void {
  if (!/^\/participant\/(?:events\/[^/]+\/(?:join|leave)|activities\/[^/]+\/(?:register|cancel-registration)|attendance-scans)$/.test(endpoint)
    && !/^\/organizer\/activity-registrations\/[^/]+\/attendance-adjustments$/.test(endpoint)) return;
  // Only invalidate queries. Participant details remain behind the authorized APIs.
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(PARTICIPATION_CHANNEL);
    channel.postMessage({ type: 'changed', sender: PARTICIPATION_CLIENT_ID });
    channel.close();
  } catch {
    // Browser messaging must never change the result of a committed API command.
  }
}
