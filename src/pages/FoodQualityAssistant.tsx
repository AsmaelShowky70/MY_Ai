import React, { useMemo, useState } from 'react';
import ChatLayout from '../components/ChatLayout';
import { generateText } from '../services/ai';
import { Trash2 } from 'lucide-react';
import { useLocalStorageState } from '../hooks/useLocalStorageState';

type ChatMessage = { id: string; role: 'user' | 'ai'; content: string };

const SYSTEM_PROMPT = `أنت مهندس جودة عمليات في مجال الأغذية (QA/QC) ومتخصص في:
- أنظمة الجودة وسلاسل التوريد والتحاليل (Micro/Chem)
- متبقيات المبيدات
- البطاطس (استلام، تخزين، فرز، تصنيع، عيوب جودة، حدود قبول)

قواعد ثابتة:
1) اكتب بالعربية الفصحى المهنية.
2) قدّم إجابات عملية: خطوات فحص، حدود قبول عامة، أمثلة لنماذج سجلات، وخطة قرار.
3) عند وجود اختلافات حسب الدولة/المواصفة (Codex / EU / المحلية)، اذكر أن الأرقام تختلف واقترح ما يجب سؤاله لتحديد المرجع.
4) قدّم تحذيرات السلامة عند الحديث عن مبيدات/مواد خطرة، ولا تقترح ممارسات غير قانونية.
5) إذا طُلب تفسير تقرير تحليل، اطلب صورة/نص النتائج أو القيم الأساسية (LOD/LOQ، الوحدات، طريقة التحليل) قبل الحكم.`;

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

export default function FoodQualityAssistant() {
    const defaultMessage: ChatMessage = useMemo(() => ({
        id: '1',
        role: 'ai',
        content: 'مرحباً! اسألني عن الجودة والتحاليل ومتطلبات الاستلام والتخزين، أو عن متبقيات المبيدات والبطاطس وسأعطيك خطة عملية.',
    }), []);

    const { value: messages, setValue: setMessages, clear } = useLocalStorageState<ChatMessage[]>(
        'chat:food-quality',
        () => [defaultMessage]
    );

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const prompt = buildPrompt(messages, text);
            const response = await generateText(prompt, SYSTEM_PROMPT);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: response || 'تعذر توليد الرد.' }]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: `تعذر التنفيذ: ${getErrorMessage(e)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        if (!window.confirm('هل تريد بدء محادثة جديدة لمسار الجودة؟')) return;
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
            title="مهندس جودة الأغذية"
            subtitle="مساعد عملي في الجودة والتحاليل ومتبيقيات المبيدات والبطاطس."
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            placeholder="اكتب سؤالك عن الجودة أو التحاليل..."
            customActions={customActions}
        />
    );
}
