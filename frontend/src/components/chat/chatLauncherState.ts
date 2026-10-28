import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

interface ChatLauncherState {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  dismissed: boolean;
  dismiss: () => void;
  restore: () => void;
}

export const ChatLauncherContext = createContext<ChatLauncherState | null>(null);

export function useChatLauncher(): ChatLauncherState {
  const state = useContext(ChatLauncherContext);
  if (!state) throw new Error('ChatLauncherProvider is required.');
  return state;
}
