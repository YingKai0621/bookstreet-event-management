import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { ChatWidget } from './components/chat/ChatWidget';
import { ChatLauncherProvider } from './components/chat/ChatLauncherContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChatLauncherProvider>
          <App />
          <ChatWidget />
        </ChatLauncherProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
