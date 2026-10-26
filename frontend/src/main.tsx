import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { ChatWidget } from './components/chat/ChatWidget.tsx'
import { captureAttendanceScanToken } from './security/attendanceScanToken.ts'
import './index.css'

captureAttendanceScanToken()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ChatWidget />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
