import OpenAI from 'openai';
import { GoogleGenAI, type PartUnion } from '@google/genai';

type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function getStoredKey(storageKey: string): string {
    try {
        return localStorage.getItem(storageKey) || '';
    } catch {
        return '';
    }
}

function getOpenAIKey(): string {
    return getStoredKey('keys:openai') || import.meta.env.VITE_OPENAI_API_KEY || '';
}

function getGeminiKey(): string {
    return getStoredKey('keys:gemini') || import.meta.env.VITE_GEMINI_API_KEY || '';
}

function getElevenLabsKey(): string {
    return getStoredKey('keys:elevenlabs') || import.meta.env.VITE_ELEVENLABS_API_KEY || '';
}

function createOpenAIClient(): OpenAI {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        throw new Error('Missing OpenAI API key. Please add it in Settings.');
    }
    return new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
    });
}

function createGeminiClient(): GoogleGenAI {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        throw new Error('Missing Gemini API key. Please add it in Settings.');
    }
    return new GoogleGenAI({ apiKey });
}

// Default text generator to Gemini to save OpenAI tokens
let useOpenAI = false;

/**
 * Generate text using either OpenAI or Gemini.
 * It automatically toggles between the two to balance the load,
 * unless a specific provider is requested.
 */
export async function generateText(
    prompt: string,
    systemInstruction?: string,
    forceProvider?: 'openai' | 'gemini',
    file?: { data: string, mimeType: string }
): Promise<string> {
    // If a file is uploaded (like a PDF), we must use Gemini as it supports deep document analysis
    const provider = file ? 'gemini' : (forceProvider || (useOpenAI ? 'openai' : 'gemini'));

    // For heavy tasks, we prefer Gemini. We will only toggle if not forced.
    if (!forceProvider && !file) {
        useOpenAI = !useOpenAI; // toggle for next call
    }

    try {
        if (provider === 'openai') {
            const openai = createOpenAIClient();
            const messages: OpenAIMessage[] = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages,
            });
            return response.choices[0].message.content || '';
        } else {
            // Gemini
            const gemini = createGeminiClient();
            const contents: PartUnion[] = [prompt];
            if (file) {
                contents.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
            }

            const response = await gemini.models.generateContent({
                model: 'gemini-2.5-flash',
                contents,
                config: systemInstruction ? { systemInstruction } : undefined,
            });
            return response.text || '';
        }
    } catch (error) {
        // Fallback to the other provider if one fails (unless file is attached, then we strictly need Gemini)
        if (!forceProvider && !file) {
            return generateText(prompt, systemInstruction, provider === 'openai' ? 'gemini' : 'openai');
        }
        throw error;
    }
}

/**
 * Force generate text with JSON output.
 */
export async function generateJsonText(
    prompt: string,
    systemInstruction?: string
): Promise<string> {
    try {
        const openai = createOpenAIClient();
        const messages: OpenAIMessage[] = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            response_format: { type: 'json_object' }
        });
        return response.choices[0].message.content || '';
    } catch {
        // Fallback to Gemini with explicit instruction
        const gemini = createGeminiClient();
        const fallbackPrompt = `${systemInstruction || ''}\n\n${prompt}\n\nIMPORTANT: Return ONLY valid JSON and nothing else.`;
        const response = await gemini.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fallbackPrompt,
            config: { responseMimeType: 'application/json' }
        });
        return response.text || '';
    }
}

/**
 * Generate Image (Uses OpenAI DALL-E)
 */
export async function generateImageOpenAI(prompt: string, aspectRatio: '1:1' | '9:16' | '16:9' = '1:1'): Promise<string> {
    const openai = createOpenAIClient();
    let size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";
    if (aspectRatio === '9:16') size = "1024x1792";
    if (aspectRatio === '16:9') size = "1792x1024";

    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
    });
    return response.data?.[0]?.url || '';
}

/**
 * Generate Image (Uses Gemini Imagen 3)
 */
export async function generateImageGemini(prompt: string, aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1'): Promise<string> {
    const gemini = createGeminiClient();
    const response = await gemini.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio,
            outputMimeType: 'image/jpeg',
        },
    });

    // Gemini returns base64 string
    const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64Image) throw new Error("Failed to generate image with Gemini");

    return `data:image/jpeg;base64,${base64Image}`;
}

/**
 * Generate Audio from text using ElevenLabs
 */
export async function generateAudioElevenLabs(text: string): Promise<string> {
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
        throw new Error('Missing ElevenLabs API key. Please add it in Settings.');
    }
    const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam Voice

    // Basic markdown stripping for cleaner audio
    let cleanText = text.replace(/[*#>`]/g, '').trim();

    // Prevent token limit errors via ElevenLabs by truncating extremely long texts
    // ElevenLabs officially supports ~5000 chars, but depending on the tier, safe limit is often ~2500 for a single request
    const MAX_CHARS = 2500;
    if (cleanText.length > MAX_CHARS) {
        cleanText = cleanText.substring(0, MAX_CHARS) + " ... (تم اختصار الملخص للطول المسموح به صوتياً)";
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        },
        body: JSON.stringify({
            text: cleanText,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
                similarity_boost: 0.7,
                stability: 0.5,
                style: 0.0,
                use_speaker_boost: true
            }
        })
    });

    if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const blob = await response.blob();
    return window.URL.createObjectURL(blob);
}
