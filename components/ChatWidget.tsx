'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type Message = { id: string; sender: string; content: string; created_at: string };
const POLL_MS = 4000;

export default function ChatWidget() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const loadMessages = useCallback(async () => {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    const msgs: Message[] = data.messages || [];
    if (!open && msgs.length > lastCountRef.current) setHasUnread(true);
    lastCountRef.current = msgs.length;
    setMessages(msgs);
  }, [open]);

  useEffect(() => {
    loadMessages();
    const id = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    if (open) {
      setHasUnread(false);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [open, messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    setMessages(prev => [...prev, { id: 'tmp-' + Date.now(), sender: 'user', content: text, created_at: new Date().toISOString() }]);
    const res = await fetch('/api/chat/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages || []);
      lastCountRef.current = (data.messages || []).length;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[320px] sm:w-[360px] h-[440px] rounded-2xl shadow-2xl bg-white border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-3 flex items-center justify-between flex-none">
            <div>
              <p className="font-display font-bold text-sm">{t('Assistant Melotones', 'Melotones Assistant')}</p>
              <p className="text-[11px] text-brand-100">{t('Répond en général en quelques secondes', 'Usually replies in seconds')}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-6">
                {t('Posez-nous une question sur les Chansons, les styles, ou votre titre.', 'Ask us anything about Songs, styles, or your track.')}
              </p>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender === 'user' ? 'bg-brand-600 text-white' : 'bg-white text-gray-800 border border-gray-200'
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 p-2.5 border-t border-gray-100 flex-none">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder={t('Votre message…', 'Your message…')}
              maxLength={1000}
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button disabled={sending || !input.trim()} onClick={send} className="w-9 h-9 flex-none rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-600 to-magenta-600 shadow-xl flex items-center justify-center text-white hover:scale-105 transition-transform relative"
        aria-label={t('Ouvrir le chat', 'Open chat')}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {hasUnread && !open && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white" />}
      </button>
    </div>
  );
}
