import React, { useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
}

interface ChatLayoutProps {
    title: string;
    subtitle: string;
    messages: ChatMessage[];
    input: string;
    setInput: (val: string) => void;
    onSend: () => void;
    isLoading: boolean;
    placeholder?: string;
    customActions?: React.ReactNode;
}

export default function ChatLayout({
    title, subtitle, messages, input, setInput, onSend, isLoading, placeholder = "Type your message...", customActions
}: ChatLayoutProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="page-container" style={{ position: 'relative' }}>
            <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .markdown-wrapper p { margin-bottom: 1rem; line-height: 1.6; }
        .markdown-wrapper ul { margin-bottom: 1rem; padding-left: 1.5rem; }
        .markdown-wrapper li { margin-bottom: 0.5rem; }
        .markdown-wrapper h3 { margin-top: 1.5rem; margin-bottom: 0.5rem; color: #fff; }
        .markdown-wrapper pre { background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1rem; }
        .markdown-wrapper code { background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #a78bfa; }
      `}</style>
            <div className="page-content" style={{ paddingBottom: '140px' }}>
                <div style={{ marginBottom: '32px' }}>
                    <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{title}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                    {customActions && <div style={{ marginTop: '16px' }}>{customActions}</div>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`chat-message ${msg.role === 'user' ? 'chat-user' : 'chat-ai'}`}>
                            <div className="chat-avatar">
                                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                            </div>
                            <div className="chat-bubble markdown-wrapper" style={{ whiteSpace: 'pre-wrap' }}>
                                {/* For real markdown we'd use react-markdown, wait, maybe simple pre-wrap is ok, or we can dangerouslySetInnerHTML if we parse it, but for safety simple pre-wrap is good enough unless we add marked.js */}
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="chat-message chat-ai">
                            <div className="chat-avatar"><Bot size={20} /></div>
                            <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>

            <div className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        className="chat-textarea"
                        placeholder={placeholder}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />
                    <button
                        className="chat-send-btn"
                        onClick={onSend}
                        disabled={isLoading || !input.trim()}
                    >
                        {isLoading ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
