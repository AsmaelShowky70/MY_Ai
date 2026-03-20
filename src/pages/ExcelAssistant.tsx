import React, { useMemo, useRef, useState } from 'react';
import ChatLayout from '../components/ChatLayout';
import { generateJsonText, generateText } from '../services/ai';
import { Download, FileSpreadsheet, Plus, Trash2, Wand2 } from 'lucide-react';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import * as XLSX from 'xlsx';

type ChatMessage = { id: string; role: 'user' | 'ai'; content: string };

const SYSTEM_PROMPT = `أنت مساعد خبير في Microsoft Excel وGoogle Sheets داخل تطبيق ويب قادر على إنشاء وتعديل ملفات Excel فعلياً.

مهامك:
- حل مشاكل الإكسيل (صيغ، Pivot, تنظيف بيانات، تنسيق، منطق)
- فهم تقارير/جداول وتحويلها إلى ملخصات وخطوات عملية
- عند طلب المستخدم "إنشاء ملف من الصفر" قدّم له هيكل ملف واضح (أوراق/أعمدة/صيغ) وخطة جاهزة للتطبيق (بدون أعذار).

قواعد:
1) اكتب بالعربية الفصحى المهنية.
2) إذا طُلبت صيغة، قدّم الصيغة جاهزة واذكر أين توضع مع مثال.
3) إذا كان لدى المستخدم ملف Excel مرفوع، استخدم ملخص بنية الملف (الأوراق/العناوين/عينة بيانات) لتقديم حلول دقيقة.
4) لا تقل "أنا نموذج لغوي" ولا تقل أنك لا تستطيع إنشاء ملفات. بدلاً من ذلك أعطِ نتيجة قابلة للتنفيذ.
5) لا تختلق أرقاماً غير موجودة في الملف.`;

const EDIT_PLAN_SYSTEM_PROMPT = `أعد JSON صالح فقط دون أي نص إضافي.

الشكل المطلوب:
{
  "notes": "string",
  "actions": [
    { "type": "set_cell", "sheet": "Sheet1", "address": "A1", "value": "text" },
    { "type": "set_cell", "sheet": "Sheet1", "address": "B2", "formula": "=SUM(A2:A10)" },
    { "type": "set_range", "sheet": "Sheet1", "start": "A1", "values": [[1,2,3],[4,5,6]] },
    { "type": "add_sheet", "sheet": "Summary" }
  ]
}

قواعد:
- استخدم أسماء أوراق موجودة قدر الإمكان.
- لا تستخدم عمليات حذف/تعديل صفوف معقدة. إذا لزم، اقترحها في notes بدل actions.
- يجب أن تكون العناوين مثل A1 و B2 صالحة.`;

function isCreateFileRequest(text: string) {
    const t = text.toLowerCase();
    return (
        t.includes('انشئ ملف') ||
        t.includes('إنشئ ملف') ||
        t.includes('إنشاء ملف') ||
        t.includes('اعمل ملف') ||
        t.includes('اعمل جدول') ||
        t.includes('create excel') ||
        t.includes('create xlsx') ||
        t.includes('new excel')
    );
}

function isApplyEditsRequest(text: string) {
    const t = text.toLowerCase();
    return (
        t.includes('طبق') ||
        t.includes('تطبيق') ||
        t.includes('عدّل') ||
        t.includes('عدل') ||
        t.includes('تعديل') ||
        t.includes('add column') ||
        t.includes('update file')
    );
}

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
    return 'حدث خطأ أثناء تنفيذ العملية.';
}

function isValidCellAddress(address: string) {
    return /^[A-Z]{1,3}[1-9]\d*$/.test(address);
}

function normalizeFormula(formula: string) {
    const f = formula.trim();
    return f.startsWith('=') ? f.slice(1) : f;
}

function workbookSummary(workbook: XLSX.WorkBook) {
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 8)) {
        const ws = workbook.Sheets[sheetName];
        lines.push(`SHEET: ${sheetName}`);
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
        const sample = aoa.slice(0, 12).map(row => (row || []).slice(0, 10));
        if (!sample.length) {
            lines.push('(empty)');
            lines.push('');
            continue;
        }
        for (const row of sample) {
            const clean = row.map(cell => {
                if (cell == null) return '';
                const str = String(cell);
                return str.length > 40 ? str.slice(0, 40) + '…' : str;
            });
            lines.push(clean.join(' | '));
        }
        lines.push('');
    }
    return lines.join('\n');
}

type EditAction =
    | { type: 'add_sheet'; sheet: string }
    | { type: 'set_cell'; sheet: string; address: string; value?: string | number | boolean | null; formula?: string }
    | { type: 'set_range'; sheet: string; start: string; values: unknown[][] };

function applyEditPlan(workbook: XLSX.WorkBook, actions: EditAction[]) {
    for (const action of actions) {
        if (action.type === 'add_sheet') {
            const name = action.sheet?.trim();
            if (!name) continue;
            if (!workbook.Sheets[name]) {
                const ws = XLSX.utils.aoa_to_sheet([[]]);
                XLSX.utils.book_append_sheet(workbook, ws, name);
            }
            continue;
        }

        const sheetName = action.sheet?.trim();
        if (!sheetName) continue;

        if (!workbook.Sheets[sheetName]) {
            const ws = XLSX.utils.aoa_to_sheet([[]]);
            XLSX.utils.book_append_sheet(workbook, ws, sheetName);
        }
        const ws = workbook.Sheets[sheetName];

        if (action.type === 'set_cell') {
            const address = action.address?.trim().toUpperCase();
            if (!address || !isValidCellAddress(address)) continue;

            const cell: XLSX.CellObject = { t: 's', v: '' };
            if (typeof action.formula === 'string' && action.formula.trim()) {
                cell.f = normalizeFormula(action.formula);
            }
            if ('value' in action) {
                const v = action.value;
                if (v === null || v === undefined) {
                    cell.v = '';
                    cell.t = 's';
                } else if (typeof v === 'number') {
                    cell.v = v;
                    cell.t = 'n';
                } else if (typeof v === 'boolean') {
                    cell.v = v;
                    cell.t = 'b';
                } else {
                    cell.v = String(v);
                    cell.t = 's';
                }
            }

            XLSX.utils.sheet_add_aoa(ws, [[cell]], { origin: address });
            continue;
        }

        if (action.type === 'set_range') {
            const start = action.start?.trim().toUpperCase();
            if (!start || !isValidCellAddress(start)) continue;
            const values = Array.isArray(action.values) ? action.values : [];
            XLSX.utils.sheet_add_aoa(ws, values, { origin: start });
            continue;
        }
    }
}

function downloadArrayBuffer(filename: string, buffer: ArrayBuffer) {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function ExcelAssistant() {
    const defaultMessage: ChatMessage = useMemo(() => ({
        id: '1',
        role: 'ai',
        content: 'ارفع ملف Excel (.xlsx) ثم اكتب المطلوب: صيغة، تنظيف بيانات، تلخيص تقرير، أو تعديل داخل الملف وسأساعدك.',
    }), []);

    const { value: messages, setValue: setMessages, clear } = useLocalStorageState<ChatMessage[]>(
        'chat:excel',
        () => [defaultMessage]
    );

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [fileName, setFileName] = useState<string | null>(null);
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [modifiedBuffer, setModifiedBuffer] = useState<ArrayBuffer | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const lastUserText = useMemo(() => {
        const last = [...messages].reverse().find(m => m.role === 'user');
        return last?.content || '';
    }, [messages]);

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setModifiedBuffer(null);
        setFileName(file.name);

        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        setWorkbook(wb);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `تم رفع الملف: ${file.name}. اكتب المطلوب (مثال: "أضف عمود صافي الربح" أو "اعمل ملخص في ورقة جديدة").` }]);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
        setInput('');
        const shouldCreate = !workbook && isCreateFileRequest(text);
        const shouldApply = !!workbook && isApplyEditsRequest(text);

        if (shouldCreate) {
            await handleCreateNewFile(text);
            return;
        }

        if (shouldApply) {
            await handleApplyEdits(text);
            return;
        }

        setIsLoading(true);

        try {
            const summary = workbook ? `ملخص الملف المرفوع:\n${workbookSummary(workbook)}` : '';
            const prompt = `${summary ? summary + '\n\n' : ''}${buildPrompt(messages, text)}`;
            const response = await generateText(prompt, SYSTEM_PROMPT);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: response || 'تعذر توليد الرد.' }]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: `تعذر التنفيذ: ${getErrorMessage(e)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyEdits = async (requestOverride?: string) => {
        const wb = workbook;
        if (!wb) {
            alert('ارفع ملف Excel أولاً.');
            return;
        }
        const request = (requestOverride || input.trim() || lastUserText).trim();
        if (!request) {
            alert('اكتب التعديل المطلوب أولاً.');
            return;
        }

        setIsLoading(true);
        setModifiedBuffer(null);
        try {
            const summary = workbookSummary(wb);
            const prompt = `طلب المستخدم:\n${request}\n\nملخص الملف:\n${summary}\n\nأعد خطة تعديلات JSON قابلة للتطبيق.`;
            const raw = await generateJsonText(prompt, EDIT_PLAN_SYSTEM_PROMPT);
            const parsed = JSON.parse(raw) as { notes?: string; actions?: EditAction[] };
            const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

            const cloned = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
            applyEditPlan(cloned, actions);
            const out = XLSX.write(cloned, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
            setModifiedBuffer(out);
            setWorkbook(cloned);

            const notes = typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : 'تم تطبيق خطة التعديلات على الملف.';
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `${notes}\n\nعدد الإجراءات المطبقة: ${actions.length}` }]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `تعذر التطبيق: ${getErrorMessage(e)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNewFile = async (requestOverride?: string) => {
        const request = (requestOverride || input.trim() || lastUserText).trim();
        if (!request) {
            alert('اكتب وصف الملف الذي تريد إنشاءه أولاً. مثال: "ملف حضور وانصراف به أعمدة (اسم، تاريخ، وقت دخول، وقت خروج)".');
            return;
        }

        setIsLoading(true);
        setModifiedBuffer(null);
        try {
            const prompt = `المطلوب: إنشاء ملف Excel من الصفر.\n\nوصف المستخدم:\n${request}\n\nأعد خطة JSON لإنشاء الأوراق والعناوين والصيغ الأساسية إن لزم.`;
            const raw = await generateJsonText(prompt, EDIT_PLAN_SYSTEM_PROMPT);
            const parsed = JSON.parse(raw) as { notes?: string; actions?: EditAction[] };
            const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

            const wb = XLSX.utils.book_new();
            applyEditPlan(wb, actions);
            const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

            setWorkbook(wb);
            setFileName('new.xlsx');
            setModifiedBuffer(out);

            const notes = typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : 'تم إنشاء ملف جديد.';
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `${notes}\n\nيمكنك الآن تنزيل الملف أو طلب تعديل إضافي.` }]);
        } catch (e: unknown) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `تعذر إنشاء الملف: ${getErrorMessage(e)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        if (!modifiedBuffer) return;
        const base = fileName?.replace(/\.xlsx$/i, '') || 'excel';
        downloadArrayBuffer(`${base}-modified.xlsx`, modifiedBuffer);
    };

    const handleClear = () => {
        if (!window.confirm('هل تريد بدء محادثة جديدة لمسار الإكسيل؟')) return;
        clear();
    };

    const handleResetFile = () => {
        if (!window.confirm('هل تريد إزالة الملف الحالي؟')) return;
        setWorkbook(null);
        setFileName(null);
        setModifiedBuffer(null);
    };

    const customActions = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
            />

            <button className="btn btn-primary" onClick={handleUploadClick} disabled={isLoading}>
                <FileSpreadsheet size={18} /> رفع ملف Excel
            </button>

            <button className="btn btn-outline" onClick={() => void handleCreateNewFile()} disabled={isLoading}>
                <Plus size={18} /> إنشاء ملف جديد
            </button>

            <button className="btn btn-outline" onClick={() => void handleApplyEdits()} disabled={isLoading || !workbook}>
                <Wand2 size={18} /> تطبيق تعديل على الملف
            </button>

            <button className="btn btn-outline" onClick={handleDownload} disabled={!modifiedBuffer}>
                <Download size={18} /> تنزيل النسخة المعدلة
            </button>

            <button className="btn btn-outline" onClick={handleResetFile} disabled={!workbook}>
                إزالة الملف
            </button>

            <button
                onClick={handleClear}
                className="btn btn-outline"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
            >
                <Trash2 size={18} /> بدء محادثة جديدة
            </button>

            {fileName && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    الملف الحالي: <span style={{ color: 'var(--text-main)' }}>{fileName}</span>
                </div>
            )}
        </div>
    );

    return (
        <ChatLayout
            title="مساعد الإكسيل"
            subtitle="حلول صيغ وتقارير + تعديل ملف Excel ثم تنزيل النسخة المعدلة."
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            placeholder="اكتب سؤالك أو التعديل المطلوب..."
            customActions={customActions}
        />
    );
}
