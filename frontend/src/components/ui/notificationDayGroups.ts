import type { Language } from '../../types';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_KEY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
const ONE_DAY_MS = 86_400_000;

function dayKey(value: string | number): string {
  return DAY_KEY_FORMAT.format(new Date(value));
}

export interface NotificationDayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Groups newest-first notifications by Vietnam calendar day, preserving server order. */
export function groupNotificationsByDay<T extends { createdAt: string }>(
  items: T[],
  now: number,
  language: Language,
): NotificationDayGroup<T>[] {
  const vi = language === 'vi';
  const today = dayKey(now);
  const yesterday = dayKey(now - ONE_DAY_MS);
  const dateFormat = new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIME_ZONE });
  const groups: NotificationDayGroup<T>[] = [];
  for (const item of items) {
    const key = dayKey(item.createdAt);
    let group = groups.find(candidate => candidate.key === key);
    if (!group) {
      const label = key === today ? (vi ? 'Hôm nay' : 'Today')
        : key === yesterday ? (vi ? 'Hôm qua' : 'Yesterday')
          : dateFormat.format(new Date(item.createdAt));
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function notificationTimeFormatter(language: Language): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { timeStyle: 'short', timeZone: TIME_ZONE });
}
