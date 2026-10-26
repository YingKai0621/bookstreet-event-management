import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { askChatbot, ChatRequestError, type ChatSource } from '../../services/chatApi';
import './ChatWidget.css';

interface Message { role: 'user' | 'assistant'; text: string; sources?: ChatSource[] }

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

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
      const result = await askChatbot(question, messages.map(({ role, text }) => ({ role, text: text.slice(0, 500) })));
      setMessages(previous => [...previous, {
        role: 'assistant', text: result.answer, sources: result.sources,
      }]);
    } catch (error) {
      const text = error instanceof ChatRequestError && error.status === 402
        ? 'Tài khoản Gemini API đã hết hạn mức hoặc cần bật thanh toán. Vui lòng thử lại sau khi kiểm tra Google AI Studio.'
        : error instanceof ChatRequestError && error.status === 503
          ? 'Gemini API key hoặc model chưa được cấu hình hoặc chưa có quyền truy cập.'
        : error instanceof ChatRequestError && error.status === 429
          ? 'Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau một phút.'
          : error instanceof ChatRequestError && error.status === 502
            ? 'Dịch vụ AI đang không phản hồi. Vui lòng thử lại sau.'
            : 'Chatbot hiện chưa trả lời được. Vui lòng thử lại sau.';
      setMessages(previous => [...previous, {
        role: 'assistant', text,
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={`bookstreet-chat ${open ? 'bookstreet-chat--open' : ''}`} aria-label="Trợ lý BookStreet">
      {open && <section className="bookstreet-chat__panel" aria-label="Cuộc trò chuyện">
        <header className="bookstreet-chat__header">
          <div><strong>Trợ lý BookStreet</strong><small>Hỏi về sự kiện và hoạt động</small></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trò chuyện">×</button>
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
          <input id="bookstreet-chat-input" value={input} onChange={event => setInput(event.target.value)}
            maxLength={500} placeholder="Nhập câu hỏi…" disabled={busy} autoComplete="off" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi câu hỏi">Gửi</button>
        </form>
      </section>}
      <button type="button" className="bookstreet-chat__toggle" onClick={() => setOpen(!open)}
        aria-expanded={open} aria-label={open ? 'Đóng trợ lý BookStreet' : 'Mở trợ lý BookStreet'}>
        {open ? '×' : 'Hỏi BookStreet'}
      </button>
    </aside>
  );
}
