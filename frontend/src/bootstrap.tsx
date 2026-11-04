import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { ChatWidget } from './components/chat/ChatWidget';
import './index.css';
import './SquareDesign.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ChatWidget />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
