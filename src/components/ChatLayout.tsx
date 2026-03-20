import React, { useMemo, useRef, useEffect } from 'react';
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

type Block =
    | { type: 'p'; text: string }
    | { type: 'h3'; text: string }
    | { type: 'ul'; items: string[] }
    | { type: 'code'; code: string };

function splitInlineCode(text: string) {
    const parts = text.split('`');
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        if (i % 2 === 1) nodes.push(<code key={i}>{part}</code>);
        else nodes.push(<React.Fragment key={i}>{part}</React.Fragment>);
    }
    return nodes.length ? nodes : text;
}

function parseBlocks(content: string): Block[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i] ?? '';

        if (line.trim().startsWith('```')) {
            i++;
            const codeLines: string[] = [];
            while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
                codeLines.push(lines[i] ?? '');
                i++;
            }
            if (i < lines.length) i++;
            blocks.push({ type: 'code', code: codeLines.join('\n') });
            continue;
        }

        const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
        if (headingMatch) {
            blocks.push({ type: 'h3', text: headingMatch[1].trim() });
            i++;
            continue;
        }

        const isBullet = (v: string) => /^[-*]\s+/.test(v.trim());
        if (isBullet(line)) {
            const items: string[] = [];
            while (i < lines.length && isBullet(lines[i] ?? '')) {
                const raw = (lines[i] ?? '').trim().replace(/^[-*]\s+/, '');
                if (raw) items.push(raw);
                i++;
            }
            if (items.length) blocks.push({ type: 'ul', items });
            continue;
        }

        if (!line.trim()) {
            i++;
            continue;
        }

        const paraLines: string[] = [];
        while (i < lines.length && (lines[i] ?? '').trim() && !(lines[i] ?? '').trim().startsWith('```') && !isBullet(lines[i] ?? '') && !/^#{1,3}\s+/.test((lines[i] ?? ''))) {
            paraLines.push(lines[i] ?? '');
            i++;
        }
        const text = paraLines.join('\n').trim();
        if (text) blocks.push({ type: 'p', text });
    }

    return blocks;
}

function renderMarkdownLike(content: string) {
    const blocks = parseBlocks(content);
    return blocks.map((b, idx) => {
        if (b.type === 'h3') return <h3 key={idx}>{b.text}</h3>;
        if (b.type === 'ul') return <ul key={idx}>{b.items.map((it, i) => <li key={i}>{splitInlineCode(it)}</li>)}</ul>;
        if (b.type === 'code') return <pre key={idx}><code>{b.code}</code></pre>;
        return <p key={idx}>{splitInlineCode(b.text)}</p>;
    });
}

export default function ChatLayout({
    title, subtitle, messages, input, setInput, onSend, isLoading, placeholder = "Type your message...", customActions
}: ChatLayoutProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const rendered = useMemo(() => messages.map(m => ({ ...m, rendered: renderMarkdownLike(m.content) })), [messages]);

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
                    {rendered.map((msg) => (
                        <div key={msg.id} className={`chat-message ${msg.role === 'user' ? 'chat-user' : 'chat-ai'}`}>
                            <div className="chat-avatar">
                                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                            </div>
                            <div className="chat-bubble markdown-wrapper">
                                {msg.rendered}
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
