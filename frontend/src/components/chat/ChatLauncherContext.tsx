import { useState, type ReactNode } from 'react';
import { ChatLauncherContext } from './chatLauncherState';
const STORAGE_KEY = 'bookstreet:chat-launcher-dismissed';

export function ChatLauncherProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const dismiss = () => {
    setOpen(false);
    setDismissed(true);
    try { sessionStorage.setItem(STORAGE_KEY, 'true'); } catch { /* The current page still keeps the preference. */ }
  };
  const restore = () => {
    setOpen(false);
    setDismissed(false);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* The current page still keeps the preference. */ }
  };
  return <ChatLauncherContext.Provider value={{ open, setOpen, dismissed, dismiss, restore }}>{children}</ChatLauncherContext.Provider>;
}

