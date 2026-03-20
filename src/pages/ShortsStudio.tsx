import React, { useMemo, useState } from 'react';
import ChatLayout from '../components/ChatLayout';
import { generateImageGemini, generateJsonText, generateText } from '../services/ai';
import { Download, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useLocalStorageState } from '../hooks/useLocalStorageState';

type ChatMessage = { id: string; role: 'user' | 'ai'; content: string };

const SYSTEM_PROMPT = `أنت منتج ومخرج ومؤلف إعلانات قصيرة (YouTube Shorts / Reels / TikTok) متخصص في فيديوهات كرتون/أنيميشن.

المطلوب: عندما يطلب المستخدم فكرة/موضوعاً، أنشئ خطة فيديو أنيميشن مدته دقيقة واحدة (60 ثانية) قابلة للتنفيذ.

قواعد الإخراج:
1) اكتب بالعربية الفصحى المهنية.
2) سلّم دائماً "حزمة إنتاج" تشمل: عنوان قوي، هوك أول 3 ثواني، تقسيم زمني للمشاهد (8-12 مشهد)، نص تعليق صوتي (Voice Over)، نصوص تظهر على الشاشة، وصف بصري لكل مشهد، تعليمات حركة/أنيميشن بسيطة، مؤثرات صوتية/موسيقى مناسبة (اقتراحات).
3) اجعل الأسلوب بسيطاً، واضحاً، ومناسباً للعرض العمودي 9:16.
4) إذا كان الموضوع حساساً (طب/مال/قانون)، قدّم تنبيه وأنشئ محتوى توعوي غير مُضلل.`;

const JSON_SYSTEM_PROMPT = `أنت مساعد إخراج. أعد JSON صالح فقط دون أي نص إضافي.

الشكل المطلوب:
{
  "title": "string",
  "style": "cartoon | anime | flat | 3d",
  "durationSeconds": 60,
  "format": "9:16",
  "scenes": [
    {
      "id": 1,
      "start": 0,
      "end": 6,
      "onScreenText": "string",
      "voiceOver": "string",
      "visual": "string",
      "animation": "string",
      "sfxMusic": "string",
      "imagePrompt": "string"
    }
  ]
}`;

function buildPrompt(history: ChatMessage[], nextUserInput: string) {
    const recent = history.slice(-10);
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

function getStoryboardScenes(parsed: unknown) {
    if (!parsed || typeof parsed !== 'object') return [] as Record<string, unknown>[];
    const obj = parsed as Record<string, unknown>;
    const scenes = obj.scenes;
    if (!Array.isArray(scenes)) return [] as Record<string, unknown>[];
    return scenes.filter((s): s is Record<string, unknown> => !!s && typeof s === 'object');
}

function getStoryboardStyle(parsed: unknown) {
    if (!parsed || typeof parsed !== 'object') return '';
    const obj = parsed as Record<string, unknown>;
    return typeof obj.style === 'string' ? obj.style : '';
}

function downloadTextFile(filename: string, content: string, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function ShortsStudio() {
    const defaultMessage: ChatMessage = useMemo(() => ({
        id: '1',
        role: 'ai',
        content: 'اكتب موضوع الشورت المطلوب (مثال: "لماذا تتكوّن السحب؟" أو "فكرة مشروع صغير") وسأصنع لك فيديو أنيميشن مدته دقيقة بخطة مشاهد ونص تعليق صوتي.',
    }), []);

    const { value: messages, setValue: setMessages, clear } = useLocalStorageState<ChatMessage[]>(
        'chat:shorts',
        () => [defaultMessage]
    );

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [storyboardJson, setStoryboardJson] = useState<string | null>(null);
    const [sceneImages, setSceneImages] = useState<{ id: number; dataUrl: string }[]>([]);
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);

    const lastUserText = useMemo(() => {
        const last = [...messages].reverse().find(m => m.role === 'user');
        return last?.content || '';
    }, [messages]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setStoryboardJson(null);
        setSceneImages([]);

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
        if (!window.confirm('هل تريد بدء محادثة جديدة لمسار الشورتس؟')) return;
        setStoryboardJson(null);
        setSceneImages([]);
        clear();
    };

    const handleGenerateStoryboardJson = async () => {
        const topic = input.trim() || lastUserText;
        if (!topic) {
            alert('اكتب الموضوع أولاً.');
            return;
        }
        setIsLoading(true);
        setStoryboardJson(null);
        setSceneImages([]);
        try {
            const prompt = `موضوع الفيديو: ${topic}\n\nأنت مطالب بإعداد ستوريبورد JSON لمدة 60 ثانية وفق الشكل المحدد. اجعل عدد المشاهد من 8 إلى 12 مشهداً.`;
            const json = await generateJsonText(prompt, JSON_SYSTEM_PROMPT);
            setStoryboardJson(json);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'تم إنشاء ستوريبورد JSON. يمكنك تنزيله أو توليد صور للمشاهد.' }]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `تعذر التنفيذ: ${getErrorMessage(e)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadStoryboard = () => {
        if (!storyboardJson) return;
        downloadTextFile('shorts-storyboard.json', storyboardJson, 'application/json');
    };

    const handleGenerateImages = async () => {
        if (!storyboardJson) {
            alert('أنشئ ستوريبورد JSON أولاً.');
            return;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(storyboardJson);
        } catch {
            alert('ملف JSON غير صالح. أعد إنشاءه.');
            return;
        }

        const scenes = getStoryboardScenes(parsed);
        if (!scenes.length) {
            alert('لا توجد مشاهد داخل JSON.');
            return;
        }

        setIsGeneratingImages(true);
        setSceneImages([]);
        try {
            const next: { id: number; dataUrl: string }[] = [];
            const style = getStoryboardStyle(parsed) || 'cartoon';
            for (const scene of scenes.slice(0, 10)) {
                const sceneId = typeof scene.id === 'number' ? scene.id : next.length + 1;
                const imagePrompt = typeof scene.imagePrompt === 'string' ? scene.imagePrompt : '';
                const visual = typeof scene.visual === 'string' ? scene.visual : '';
                const onScreenText = typeof scene.onScreenText === 'string' ? scene.onScreenText : '';
                const prompt = imagePrompt.trim()
                    ? imagePrompt
                    : `${style} vertical 9:16, clean background, character animation keyframe, scene: ${visual}, text overlay: ${onScreenText}`;
                const dataUrl = await generateImageGemini(prompt, '9:16');
                next.push({ id: sceneId, dataUrl });
            }
            setSceneImages(next);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `تعذر توليد الصور: ${getErrorMessage(e)}` }]);
        } finally {
            setIsGeneratingImages(false);
        }
    };

    const customActions = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
                onClick={handleClear}
                className="btn btn-outline"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                disabled={messages.length <= 1}
            >
                <Trash2 size={18} /> بدء محادثة جديدة
            </button>
            <button className="btn btn-primary" onClick={handleGenerateStoryboardJson} disabled={isLoading}>
                إنشاء ستوريبورد JSON
            </button>
            <button className="btn btn-outline" onClick={handleDownloadStoryboard} disabled={!storyboardJson}>
                <Download size={18} /> تنزيل JSON
            </button>
            <button className="btn btn-outline" onClick={handleGenerateImages} disabled={!storyboardJson || isGeneratingImages}>
                <ImageIcon size={18} /> توليد صور للمشاهد
            </button>
        </div>
    );

    return (
        <>
            <ChatLayout
                title="استوديو الشورتس (أنيميشن)"
                subtitle="إنشاء فيديو أنيميشن دقيقة واحدة: سيناريو + ستوريبورد + برومبتات مشاهد."
                messages={messages}
                input={input}
                setInput={setInput}
                onSend={handleSend}
                isLoading={isLoading}
                placeholder="اكتب موضوع الفيديو المطلوب..."
                customActions={customActions}
            />

            {(sceneImages.length > 0) && (
                <div style={{ position: 'fixed', bottom: '120px', left: '20px', right: '20px', pointerEvents: 'none' }}>
                    <div className="glass-panel" style={{ padding: '12px', display: 'flex', gap: '10px', overflowX: 'auto', pointerEvents: 'auto' }}>
                        {sceneImages.map(img => (
                            <div key={img.id} style={{ width: '120px', flex: '0 0 auto' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>مشهد {img.id}</div>
                                <img src={img.dataUrl} alt={`Scene ${img.id}`} style={{ width: '120px', height: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

