import React, { useMemo, useState } from 'react';
import ChatLayout from '../components/ChatLayout';
import { generateAudioElevenLabs, generateImageGemini, generateJsonText, generateText } from '../services/ai';
import { Download, Image as ImageIcon, Trash2, Video } from 'lucide-react';
import { useLocalStorageState } from '../hooks/useLocalStorageState';

type ChatMessage = { id: string; role: 'user' | 'ai'; content: string };

type StoryboardScene = {
    id: number;
    start: number;
    end: number;
    onScreenText: string;
    voiceOver: string;
    visual: string;
    animation: string;
    sfxMusic: string;
    imagePrompt: string;
};

type Storyboard = {
    title: string;
    style: string;
    language: 'ar' | 'en';
    durationSeconds: number;
    format: string;
    scenes: StoryboardScene[];
};

const SYSTEM_PROMPT = `أنت منتج ومخرج ومؤلف إعلانات قصيرة (YouTube Shorts / Reels / TikTok) متخصص في فيديوهات كرتون/أنيميشن.

المطلوب: عندما يطلب المستخدم فكرة/موضوعاً، أنشئ خطة فيديو أنيميشن مدته دقيقة واحدة (60 ثانية) قابلة للتنفيذ.

قواعد الإخراج:
1) اكتب بنفس لغة المستخدم المطلوبة (العربية أو الإنجليزية). إذا لم يحدد المستخدم لغة، استخدم العربية الفصحى.
2) سلّم دائماً "حزمة إنتاج" تشمل: عنوان قوي، هوك أول 3 ثواني، تقسيم زمني للمشاهد (8-12 مشهد)، نص تعليق صوتي (Voice Over)، نصوص تظهر على الشاشة، وصف بصري لكل مشهد، تعليمات حركة/أنيميشن بسيطة، مؤثرات صوتية/موسيقى مناسبة (اقتراحات).
3) اجعل الأسلوب بسيطاً، واضحاً، ومناسباً للعرض العمودي 9:16.
4) إذا كان الموضوع حساساً (طب/مال/قانون)، قدّم تنبيه وأنشئ محتوى توعوي غير مُضلل.`;

const JSON_SYSTEM_PROMPT = `أنت مساعد إخراج. أعد JSON صالح فقط دون أي نص إضافي.

الشكل المطلوب:
{
  "title": "string",
  "style": "cartoon | anime | flat | 3d",
  "language": "ar | en",
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

function detectRequestedLanguage(text: string): 'ar' | 'en' {
    const t = text.toLowerCase();
    if (t.includes('english') || t.includes('بالانجليزية') || t.includes('باللغة الانجليزية') || t.includes('باللغة الإنجليزية') || t.includes('انجليزي') || t.includes('إنجليزي')) return 'en';
    return 'ar';
}

function parseStoryboard(json: string): Storyboard | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const scenesRaw = getStoryboardScenes(parsed);
    const scenes: StoryboardScene[] = [];
    for (const s of scenesRaw) {
        const id = typeof s.id === 'number' ? s.id : scenes.length + 1;
        const start = typeof s.start === 'number' ? s.start : 0;
        const end = typeof s.end === 'number' ? s.end : start + 5;
        scenes.push({
            id,
            start,
            end,
            onScreenText: typeof s.onScreenText === 'string' ? s.onScreenText : '',
            voiceOver: typeof s.voiceOver === 'string' ? s.voiceOver : '',
            visual: typeof s.visual === 'string' ? s.visual : '',
            animation: typeof s.animation === 'string' ? s.animation : '',
            sfxMusic: typeof s.sfxMusic === 'string' ? s.sfxMusic : '',
            imagePrompt: typeof s.imagePrompt === 'string' ? s.imagePrompt : '',
        });
    }
    const title = typeof obj.title === 'string' ? obj.title : 'Shorts';
    const style = typeof obj.style === 'string' ? obj.style : 'cartoon';
    const language = (obj.language === 'en' || obj.language === 'ar') ? obj.language : 'ar';
    const durationSeconds = typeof obj.durationSeconds === 'number' ? obj.durationSeconds : 60;
    const format = typeof obj.format === 'string' ? obj.format : '9:16';
    return { title, style, language, durationSeconds, format, scenes: scenes.sort((a, b) => a.start - b.start) };
}

function pickMediaRecorderMimeType() {
    const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
    ];
    for (const c of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
}

async function loadImage(dataUrl: string) {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    return img;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
        const next = current ? `${current} ${w}` : w;
        if (ctx.measureText(next).width <= maxWidth) current = next;
        else {
            if (current) lines.push(current);
            current = w;
        }
    }
    if (current) lines.push(current);
    return lines;
}

async function createWebmVideo(storyboard: Storyboard, imagesById: Map<number, string>, audioUrl: string | null) {
    if (typeof MediaRecorder === 'undefined') throw new Error('المتصفح لا يدعم تسجيل الفيديو (MediaRecorder). جرّب Chrome/Edge.');
    const mimeType = pickMediaRecorderMimeType();
    if (!mimeType) throw new Error('لا يوجد codec مدعوم لتسجيل WebM على هذا المتصفح.');

    const width = 720;
    const height = 1280;
    const fps = 30;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('فشل إنشاء Canvas.');

    const sceneImages = new Map<number, HTMLImageElement>();
    for (const scene of storyboard.scenes) {
        const dataUrl = imagesById.get(scene.id);
        if (!dataUrl) continue;
        sceneImages.set(scene.id, await loadImage(dataUrl));
    }

    const stream = canvas.captureStream(fps);
    let audioEl: HTMLAudioElement | null = null;
    let audioContext: AudioContext | null = null;

    if (audioUrl) {
        audioEl = new Audio(audioUrl);
        audioEl.preload = 'auto';
        await new Promise<void>((resolve, reject) => {
            const onLoaded = () => resolve();
            const onErr = () => reject(new Error('فشل تحميل الصوت.'));
            audioEl!.addEventListener('loadedmetadata', onLoaded, { once: true });
            audioEl!.addEventListener('error', onErr, { once: true });
        });
        audioContext = new AudioContext();
        const dest = audioContext.createMediaStreamDestination();
        const src = audioContext.createMediaElementSource(audioEl);
        src.connect(dest);
        src.connect(audioContext.destination);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    const duration = Math.max(1, Math.min(120, Number.isFinite(storyboard.durationSeconds) ? storyboard.durationSeconds : 60));
    const startMs = performance.now();

    const draw = (now: number) => {
        const t = (now - startMs) / 1000;
        ctx.clearRect(0, 0, width, height);

        const currentScene = storyboard.scenes.find(s => t >= s.start && t < s.end) ?? storyboard.scenes[storyboard.scenes.length - 1];
        const img = currentScene ? sceneImages.get(currentScene.id) : undefined;

        if (img) {
            const progress = currentScene ? Math.min(1, Math.max(0, (t - currentScene.start) / Math.max(0.001, (currentScene.end - currentScene.start)))) : 0;
            const zoom = 1.03 + progress * 0.04;
            const drawW = width * zoom;
            const drawH = height * zoom;
            const dx = (width - drawW) / 2;
            const dy = (height - drawH) / 2;
            ctx.drawImage(img, dx, dy, drawW, drawH);
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.fillRect(0, 0, width, height);
        }

        const grad = ctx.createLinearGradient(0, height * 0.55, 0, height);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        if (currentScene) {
            const text = (currentScene.onScreenText || '').trim();
            const sub = (currentScene.voiceOver || '').trim();
            const overlay = [text, sub].filter(Boolean).join('\n');
            if (overlay) {
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 44px Outfit, sans-serif';
                const maxWidth = width - 80;
                const lines = overlay.split('\n').flatMap(l => wrapText(ctx, l, maxWidth));
                const lineHeight = 52;
                const totalH = lines.length * lineHeight;
                let y = height - 80 - totalH;
                for (const line of lines) {
                    ctx.fillText(line, width / 2, y);
                    y += lineHeight;
                }
            }
        }

        if (t < duration) {
            requestAnimationFrame(draw);
        } else {
            recorder.stop();
        }
    };

    const result = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = () => reject(new Error('فشل تسجيل الفيديو.'));
        recorder.start(250);
        requestAnimationFrame(draw);
        if (audioEl && audioContext) {
            audioContext.resume().then(() => audioEl!.play()).catch(() => null);
        }
        window.setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, (duration + 0.5) * 1000);
    });

    if (audioContext) await audioContext.close().catch(() => null);
    return result;
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
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

    const lastUserText = useMemo(() => {
        const last = [...messages].reverse().find(m => m.role === 'user');
        return last?.content || '';
    }, [messages]);

    const handleGenerateStoryboardJson = async (topicOverride?: string) => {
        const topic = (topicOverride || input.trim() || lastUserText).trim();
        if (!topic) {
            alert('اكتب الموضوع أولاً.');
            return;
        }
        setIsLoading(true);
        setStoryboardJson(null);
        setSceneImages([]);
        setVideoUrl(null);
        try {
            const language = detectRequestedLanguage(topic);
            const prompt = `موضوع الفيديو: ${topic}\n\nاللغة المطلوبة: ${language === 'en' ? 'English' : 'Arabic'}\n\nأعد ستوريبورد JSON لمدة 60 ثانية وفق الشكل المحدد. اجعل عدد المشاهد من 8 إلى 12. اجعل voiceOver مناسباً للغة المطلوبة.`;
            const json = await generateJsonText(prompt, JSON_SYSTEM_PROMPT);
            setStoryboardJson(json);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'تم إنشاء ستوريبورد JSON. يمكنك تنزيله أو توليد صور للمشاهد.' }]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `تعذر التنفيذ: ${getErrorMessage(e)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setStoryboardJson(null);
        setSceneImages([]);
        setVideoUrl(null);

        try {
            const prompt = buildPrompt(messages, text);
            const response = await generateText(prompt, SYSTEM_PROMPT);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: response || 'تعذر توليد الرد.' }]);
            void generateFullVideoFromTopic(text);
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
        setVideoUrl(null);
        clear();
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
        const storyboard = parseStoryboard(storyboardJson);
        if (!storyboard || !storyboard.scenes.length) {
            alert('ملف JSON غير صالح. أعد إنشاءه.');
            return;
        }

        setIsGeneratingImages(true);
        setSceneImages([]);
        try {
            const next: { id: number; dataUrl: string }[] = [];
            const style = storyboard.style || 'cartoon';
            for (const scene of storyboard.scenes.slice(0, 12)) {
                const prompt = scene.imagePrompt.trim()
                    ? scene.imagePrompt
                    : `${style} vertical 9:16, clean background, cartoon still frame, scene: ${scene.visual}, on-screen text: ${scene.onScreenText}`;
                const dataUrl = await generateImageGemini(prompt, '9:16');
                next.push({ id: scene.id, dataUrl });
            }
            setSceneImages(next);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `تعذر توليد الصور: ${getErrorMessage(e)}` }]);
        } finally {
            setIsGeneratingImages(false);
        }
    };

    const generateFullVideoFromTopic = async (topicRaw: string) => {
        const topic = topicRaw.trim();
        if (!topic) {
            alert('اكتب الموضوع أولاً.');
            return;
        }
        if (isGeneratingVideo) return;

        setIsGeneratingVideo(true);
        setVideoUrl(null);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'جاري إنشاء الفيديو (ستوريبورد + صور + صوت + تسجيل 60 ثانية)...' }]);

        try {
            const language = detectRequestedLanguage(topic);

            let json = storyboardJson;
            if (!json) {
                const prompt = `موضوع الفيديو: ${topic}\n\nاللغة المطلوبة: ${language === 'en' ? 'English' : 'Arabic'}\n\nأعد ستوريبورد JSON لمدة 60 ثانية وفق الشكل المحدد. اجعل عدد المشاهد من 8 إلى 12. اجعل voiceOver مناسباً للغة المطلوبة.`;
                json = await generateJsonText(prompt, JSON_SYSTEM_PROMPT);
                setStoryboardJson(json);
            }

            const storyboard = json ? parseStoryboard(json) : null;
            if (!storyboard || !storyboard.scenes.length) throw new Error('فشل إنشاء ستوريبورد صالح.');

            const imagesById = new Map<number, string>();
            for (const img of sceneImages) imagesById.set(img.id, img.dataUrl);

            const nextImages: { id: number; dataUrl: string }[] = [];
            const style = storyboard.style || 'cartoon';
            for (const scene of storyboard.scenes.slice(0, 12)) {
                let dataUrl = imagesById.get(scene.id);
                if (!dataUrl) {
                    const prompt = scene.imagePrompt.trim()
                        ? scene.imagePrompt
                        : `${style} vertical 9:16, clean background, cartoon still frame, scene: ${scene.visual}, on-screen text: ${scene.onScreenText}`;
                    dataUrl = await generateImageGemini(prompt, '9:16');
                    imagesById.set(scene.id, dataUrl);
                }
                nextImages.push({ id: scene.id, dataUrl });
            }
            setSceneImages(nextImages);

            const voiceText = storyboard.scenes.map(s => s.voiceOver).filter(Boolean).join('\n\n');
            let audioUrl: string | null = null;
            try {
                if (voiceText.trim()) audioUrl = await generateAudioElevenLabs(voiceText);
            } catch {
                audioUrl = null;
            }

            const blob = await createWebmVideo(storyboard, imagesById, audioUrl);
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: audioUrl ? 'تم إنشاء الفيديو (مع صوت). يمكنك تشغيله وتنزيله.' : 'تم إنشاء الفيديو (بدون صوت). أضف مفتاح ElevenLabs من الإعدادات للحصول على تعليق صوتي.' }]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `فشل إنشاء الفيديو: ${getErrorMessage(e)}` }]);
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const handleDownloadVideo = () => {
        if (!videoUrl) return;
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = 'shorts-video.webm';
        a.click();
    };

    const customActions = (
        <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                    onClick={handleClear}
                    className="btn btn-outline"
                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                >
                    <Trash2 size={18} /> بدء محادثة جديدة
                </button>
                <button className="btn btn-primary" onClick={() => handleGenerateStoryboardJson()} disabled={isLoading}>
                    إنشاء ستوريبورد JSON
                </button>
                <button className="btn btn-outline" onClick={handleDownloadStoryboard} disabled={!storyboardJson}>
                    <Download size={18} /> تنزيل JSON
                </button>
                <button className="btn btn-outline" onClick={handleGenerateImages} disabled={!storyboardJson || isGeneratingImages}>
                    <ImageIcon size={18} /> توليد صور للمشاهد
                </button>
                <button className="btn btn-outline" onClick={() => void generateFullVideoFromTopic(input.trim() || lastUserText)} disabled={isGeneratingVideo || isLoading}>
                    <Video size={18} /> إنشاء فيديو (60s)
                </button>
                <button className="btn btn-outline" onClick={handleDownloadVideo} disabled={!videoUrl}>
                    <Download size={18} /> تنزيل الفيديو
                </button>
            </div>

            {videoUrl && (
                <div className="glass-panel" style={{ padding: '12px', maxWidth: '520px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>معاينة الفيديو</div>
                    <video src={videoUrl} controls style={{ width: '100%', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
                </div>
            )}
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

