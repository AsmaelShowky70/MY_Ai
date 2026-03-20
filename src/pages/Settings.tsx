import React, { useState } from 'react';
import { KeyRound, Save, Trash2 } from 'lucide-react';

type KeysState = {
    openai: string;
    gemini: string;
    elevenlabs: string;
};

function readKey(storageKey: string) {
    try {
        return localStorage.getItem(storageKey) || '';
    } catch {
        return '';
    }
}

function writeKey(storageKey: string, value: string) {
    try {
        if (value.trim()) localStorage.setItem(storageKey, value.trim());
        else localStorage.removeItem(storageKey);
        return true;
    } catch {
        return false;
    }
}

export default function Settings() {
    const [keys, setKeys] = useState<KeysState>(() => ({
        openai: readKey('keys:openai'),
        gemini: readKey('keys:gemini'),
        elevenlabs: readKey('keys:elevenlabs'),
    }));

    const handleSave = () => {
        writeKey('keys:openai', keys.openai);
        writeKey('keys:gemini', keys.gemini);
        writeKey('keys:elevenlabs', keys.elevenlabs);
        alert('تم حفظ المفاتيح محلياً على هذا الجهاز/المتصفح.');
    };

    const handleClear = () => {
        if (!window.confirm('هل تريد حذف المفاتيح المحفوظة من هذا المتصفح؟')) return;
        writeKey('keys:openai', '');
        writeKey('keys:gemini', '');
        writeKey('keys:elevenlabs', '');
        setKeys({ openai: '', gemini: '', elevenlabs: '' });
    };

    return (
        <div className="page-content animate-fade-in" style={{ maxWidth: '900px' }}>
            <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <KeyRound size={28} /> إعدادات المفاتيح
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.8 }}>
                يتم حفظ المفاتيح داخل المتصفح (LocalStorage) على جهازك فقط. عند نشر الموقع على GitHub Pages لا توجد طريقة آمنة لإخفاء المفاتيح داخل كود الواجهة الأمامية.
                استخدم مفاتيح مخصّصة وحدود إنفاق مناسبة.
            </p>

            <div className="glass-panel" style={{ padding: '20px', display: 'grid', gap: '14px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>OpenAI API Key (اختياري)</label>
                    <input
                        className="input-base"
                        style={{ width: '100%' }}
                        type="password"
                        value={keys.openai}
                        onChange={(e) => setKeys(prev => ({ ...prev, openai: e.target.value }))}
                        placeholder="sk-..."
                        autoComplete="off"
                    />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Gemini API Key (مُوصى به)</label>
                    <input
                        className="input-base"
                        style={{ width: '100%' }}
                        type="password"
                        value={keys.gemini}
                        onChange={(e) => setKeys(prev => ({ ...prev, gemini: e.target.value }))}
                        placeholder="AIza..."
                        autoComplete="off"
                    />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>ElevenLabs API Key (اختياري للصوت)</label>
                    <input
                        className="input-base"
                        style={{ width: '100%' }}
                        type="password"
                        value={keys.elevenlabs}
                        onChange={(e) => setKeys(prev => ({ ...prev, elevenlabs: e.target.value }))}
                        placeholder="..."
                        autoComplete="off"
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={18} /> حفظ
                    </button>
                    <button className="btn btn-outline" onClick={handleClear} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                        <Trash2 size={18} /> حذف المفاتيح
                    </button>
                </div>
            </div>
        </div>
    );
}
