import React, { useMemo, useState } from 'react';
import ChatLayout from '../components/ChatLayout';
import { generateText } from '../services/ai';
import { Trash2 } from 'lucide-react';
import { useLocalStorageState } from '../hooks/useLocalStorageState';

type ChatMessage = { id: string; role: 'user' | 'ai'; content: string };

const SYSTEM_PROMPT = `أنت مساعد عام مثل ChatGPT لكن هدفك أن تكون عملياً وصحيحاً قدر الإمكان.

قواعد ثابتة:
1) تواصل بالعربية الفصحى بشكل واضح ومهني، إلا إذا طلب المستخدم الإنجليزية صراحةً.
2) إذا كان السؤال غامضاً أو يفتقد بيانات مهمة، اطرح أسئلة قصيرة لتجميع المتطلبات قبل إعطاء حل نهائي.
3) أعطِ إجابات عملية: خطوات، أمثلة، قوائم تحقق، وتحذيرات عند الحاجة.
4) لا تختلق معلومات. إذا لم تكن متأكداً، اذكر ذلك واقترح طريقة للتحقق.`;

function buildPrompt(history: ChatMessage[], nextUserInput: string) {
    const recent = history.slice(-12);
    const lines = recent.map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`);
    lines.push(`USER: ${nextUserInput}`);
    lines.push('ASSISTANT:');
    return lines.join('\n\n');
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && typeof error.message === 'string') return error.message;
    if (typeof error === 'string') return error;
    return 'حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي.';
}

export default function GeneralChat() {
    const defaultMessage: ChatMessage = useMemo(() => ({
        id: '1',
        role: 'ai',
        content: 'مرحباً! اكتب سؤالك أو مشكلتك وسأساعدك بإجابة عملية وخطوات واضحة.',
    }), []);

    const { value: messages, setValue: setMessages, clear } = useLocalStorageState<ChatMessage[]>(
        'chat:general',
        () => [defaultMessage]
    );

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);
        setInput('');
        setIsLoading(true);

        try {
            const prompt = buildPrompt(messages, text);
            const response = await generateText(prompt, SYSTEM_PROMPT);
            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', content: response || 'لم أستطع توليد رد. حاول مرة أخرى.' };
            setMessages(prev => [...prev, aiMsg]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: `تعذر التنفيذ: ${getErrorMessage(e)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        if (!window.confirm('هل تريد بدء محادثة جديدة ومسح السجل السابق لهذا الشات؟')) return;
        clear();
    };

    const customActions = (
        <button
            onClick={handleClear}
            className="btn btn-outline"
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
            disabled={messages.length <= 1}
        >
            <Trash2 size={18} /> بدء محادثة جديدة
        </button>
    );

    return (
        <ChatLayout
            title="الشات العام"
            subtitle="مساعد عام عملي للشرح، الحلول، والتخطيط."
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            placeholder="اكتب سؤالك هنا..."
            customActions={customActions}
        />
    );
}
