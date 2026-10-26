import { API_BASE_URL } from './apiConfig';
import { getCsrfToken } from './csrfToken';

export interface ChatSource { title: string; url: string }
export interface ChatResponse { answer: string; sources: ChatSource[] }

export class ChatRequestError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Chatbot request failed: ${status}`);
    this.status = status;
  }
}

export async function askChatbot(message: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>): Promise<ChatResponse> {
  const csrf = await getCsrfToken();
  const response = await fetch(`${API_BASE_URL}/chat/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ message, history: history.slice(-6) }),
  });
  if (!response.ok) throw new ChatRequestError(response.status);
  return response.json() as Promise<ChatResponse>;
}
