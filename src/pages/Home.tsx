import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareText, Film, FileSpreadsheet, ShieldCheck, KeyRound } from 'lucide-react';

export default function Home() {
    return (
        <div className="page-content animate-fade-in">
            <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '12px' }}>مساحة الذكاء الاصطناعي</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: 1.8 }}>
                اختر شاتاً من القائمة. يتم حفظ المحادثات محلياً على جهازك ويمكنك مسح السجل والبدء من جديد في أي وقت.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', maxWidth: '1100px' }}>
                <Link to="/chat" className="glass-panel" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <MessageSquareText size={22} color="var(--primary)" />
                        <div style={{ fontWeight: 700 }}>الشات العام</div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>مساعد عام عملي للإجابات والخطط وحل المشاكل.</div>
                </Link>

                <Link to="/shorts" className="glass-panel" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Film size={22} color="var(--primary)" />
                        <div style={{ fontWeight: 700 }}>استوديو الشورتس</div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>حزمة إنتاج فيديو أنيميشن دقيقة واحدة: مشاهد + VO + نصوص + برومبتات.</div>
                </Link>

                <Link to="/excel" className="glass-panel" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileSpreadsheet size={22} color="var(--primary)" />
                        <div style={{ fontWeight: 700 }}>مساعد الإكسيل</div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>فهم تقارير وإعطاء صيغ، مع إمكانية رفع ملف وتطبيق تعديل ثم تنزيله.</div>
                </Link>

                <Link to="/quality" className="glass-panel" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={22} color="var(--primary)" />
                        <div style={{ fontWeight: 700 }}>مهندس جودة الأغذية</div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>مساعد QA/QC للأغذية ومتبيقيات المبيدات والبطاطس.</div>
                </Link>

                <Link to="/settings" className="glass-panel" style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <KeyRound size={22} color="var(--primary)" />
                        <div style={{ fontWeight: 700 }}>الإعدادات</div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>إضافة مفاتيح OpenAI/Gemini/ElevenLabs داخل المتصفح.</div>
                </Link>
            </div>
        </div>
    );
}
