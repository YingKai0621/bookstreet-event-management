import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { askChatbot, ChatRequestError, type ChatSource } from '../../services/chatApi';
import './ChatWidget.css';

interface Message { role: 'user' | 'assistant'; text: string; sources?: ChatSource[]; failed?: boolean }

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => { if (open) inputRef.current?.focus({ preventScroll: true }); }, [open]);

  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/organizer')
      || location.pathname.startsWith('/partner') || location.pathname.startsWith('/portal')) return null;
  if (user && !user.roles.includes('PARTICIPANT')) return null;

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy || question.length > 500) return;
    setInput('');
    setMessages(previous => [...previous, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const history = messages.filter(message => !message.failed)
        .map(({ role, text }) => ({ role, text: text.slice(0, 500) }));
      const result = await askChatbot(question, history);
      setMessages(previous => [...previous, {
        role: 'assistant', text: result.answer, sources: result.sources,
      }]);
    } catch (error) {
      // Configuration details (API key, billing) are for operators, not visitors.
      const text = error instanceof ChatRequestError && error.status === 429
        ? 'Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau một phút.'
        : 'Trợ lý tạm thời chưa trả lời được. Vui lòng thử lại sau.';
      setMessages(previous => [...previous, {
        role: 'assistant', text, failed: true,
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={`bookstreet-chat ${open ? 'bookstreet-chat--open' : ''}`} aria-label="Trợ lý BookStreet">
      {open && <section id="bookstreet-chat-panel" className="bookstreet-chat__panel" aria-label="Cuộc trò chuyện">
        <header className="bookstreet-chat__header">
          <span className="bookstreet-chat__avatar" aria-hidden="true"><Bot size={25} strokeWidth={1.7} /></span>
          <div className="bookstreet-chat__heading"><strong>Trợ lý BookStreet</strong><small>Hỏi về sự kiện và hoạt động</small></div>
        </header>
        <div className="bookstreet-chat__messages" aria-live="polite">
          {messages.length === 0 && <p className="bookstreet-chat__intro">Xin chào! Bạn có thể hỏi về cách tham gia, sự kiện hoặc hoạt động tại BookStreet.</p>}
          {messages.map((message, index) => <div key={index} className={`bookstreet-chat__message bookstreet-chat__message--${message.role}`}>
            <p>{message.text}</p>
            {message.sources && message.sources.length > 0 && <ul aria-label="Nguồn tham khảo">
              {message.sources.map(source => <li key={`${source.url}-${source.title}`}><Link to={source.url} onClick={() => setOpen(false)}>{source.title}</Link></li>)}
            </ul>}
          </div>)}
          {busy && <p className="bookstreet-chat__intro">Đang tìm thông tin…</p>}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="bookstreet-chat__form">
          <label htmlFor="bookstreet-chat-input" className="bookstreet-chat__sr">Câu hỏi của bạn</label>
          <input ref={inputRef} id="bookstreet-chat-input" value={input} onChange={event => setInput(event.target.value)}
            maxLength={500} placeholder="Nhập câu hỏi…" disabled={busy} autoComplete="off" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi câu hỏi">Gửi</button>
        </form>
      </section>}
      <div className="bookstreet-chat__launcher">
      <button type="button" className="bookstreet-chat__toggle" onClick={() => setOpen(!open)}
        aria-controls="bookstreet-chat-panel" title={open ? 'Đóng trò chuyện' : 'Nhắn với trợ lý BookStreet'}
        aria-expanded={open} aria-label={open ? 'Đóng trợ lý BookStreet' : 'Mở trợ lý BookStreet'}>
        {open ? <X size={26} aria-hidden="true" /> : <Bot size={30} strokeWidth={1.8} aria-hidden="true" />}
      </button>
      </div>
    </aside>
  );
}
