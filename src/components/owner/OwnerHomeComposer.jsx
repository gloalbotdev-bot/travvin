import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Loader2, FileText, X } from 'lucide-react';
import MicButton from '@/components/chat/MicButton';
import iconPlus from '@/assets/owner/home/icon-plus.svg';
import iconSend from '@/assets/owner/calendar/send-yellow.svg';
import iconMic from '@/assets/owner/home/icon-mic.svg';

const MAX_ATTACHMENTS = 5;
const ATTACHMENT_ACCEPT = 'image/*,application/pdf,text/plain,text/csv,audio/*,video/*';

/** Figma 1776:18108 / 1776:18352 — 1174×99 assistant composer (text + attachments + mic + send). */
export default function OwnerHomeComposer({ onSubmit, placeholder, autoFocus = false, className = '' }) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setUploadError('');
    const added = [];
    for (const file of files) {
      try {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        added.push({ url: file_url, name: file.name, type: file.type || '' });
      } catch (err) {
        setUploadError(`לא הצלחתי להעלות את "${file.name}": ${err?.message || 'שגיאה'}`);
      }
    }
    setAttachments(prev => [...prev, ...added].slice(0, MAX_ATTACHMENTS));
    setUploading(false);
    inputRef.current?.focus();
  };

  const removeAttachment = (url) => setAttachments(prev => prev.filter(a => a.url !== url));

  const submit = () => {
    const t = draft.trim() || (attachments.length ? 'מצרף קבצים' : '');
    if (!t || uploading) return;
    onSubmit(t, attachments);
    setDraft('');
    setAttachments([]);
    setUploadError('');
    inputRef.current?.focus();
  };

  return (
    <div
      dir="rtl"
      className={`w-full bg-white flex flex-col cursor-text ${className}`}
      onClick={e => {
        if (e.target.closest('button')) return;
        inputRef.current?.focus();
      }}
      style={{
        maxWidth: 1174,
        minHeight: 99.4,
        border: '1px solid #E5E5E5',
        borderRadius: 23,
        boxShadow: '0px 4px 21.1px rgba(0,0,0,0.07)',
        padding: '20.7px 31.7px 12px 28.4px',
      }}
    >
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        aria-label={placeholder || 'שאל את העוזר'}
        className="font-simona w-full bg-transparent outline-none min-w-0 text-right placeholder:text-[#0B3838]"
        style={{ color: '#0B3838', fontSize: 18, lineHeight: 'normal' }}
      />
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map(a => (
            <div
              key={a.url}
              className="relative flex items-center gap-1.5 rounded-lg px-1.5 py-1 max-w-[180px]"
              style={{ background: '#F3F3F3', border: '1px solid #E5E5E5' }}
            >
              {a.type.startsWith('image/')
                ? <img src={a.url} alt={a.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                : <FileText size={16} style={{ color: '#0B3838' }} className="flex-shrink-0" />}
              <span className="font-simona text-xs truncate" style={{ color: '#535353' }}>{a.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.url)}
                aria-label={`הסרת ${a.name}`}
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-70"
              >
                <X size={12} style={{ color: '#535353' }} />
              </button>
            </div>
          ))}
        </div>
      )}
      {uploadError && (
        <p className="font-simona text-xs mt-1.5" style={{ color: '#D93025' }} role="alert">{uploadError}</p>
      )}
      <div className="flex items-center justify-between mt-auto" style={{ paddingTop: 10, marginRight: -8.3 }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
          title="העלאת קבצים"
          aria-label="העלאת קבצים"
          className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 disabled:cursor-default"
          style={{ background: '#E9E9E9' }}
        >
          {uploading
            ? <Loader2 size={13} className="animate-spin" style={{ color: '#0B3838' }} />
            : (
              <span className="overflow-hidden" style={{ width: 12, height: 12 }}>
                <img src={iconPlus} alt="" width={12} height={12} className="block w-full h-full" />
              </span>
            )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={handleFileUpload}
        />
        <div className="flex items-center gap-3" dir="ltr">
          <button
            type="button"
            onClick={submit}
            disabled={(!draft.trim() && !attachments.length) || uploading}
            className="w-[29px] h-[29px] rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:cursor-default"
            style={{ background: '#0B3838' }}
            title="שלח"
          >
            <img src={iconSend} alt="" width={29} height={29} className="block" />
          </button>
          <MicButton
            tone="ghost"
            compact
            size={14}
            iconWidth={14}
            iconHeight={19}
            iconSrc={iconMic}
            onText={t => setDraft(p => (p ? p.replace(/\s+$/, '') + ' ' + t : t))}
          />
        </div>
      </div>
    </div>
  );
}
