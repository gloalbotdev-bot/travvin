import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/api/client';

const MIN_RECORD_MS = 800;

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg';
  return '';
}

function extForMime(mime) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase();
  if (base.includes('mp4') || base.includes('m4a')) return 'm4a';
  if (base.includes('ogg')) return 'ogg';
  if (base.includes('mpeg') || base.includes('mp3')) return 'mp3';
  if (base.includes('wav')) return 'wav';
  return 'webm';
}

/** Browsers sometimes label opus-webm as video/webm — Gemini needs audio/*. */
function normalizeAudioMime(mime) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase();
  if (base === 'video/webm') return 'audio/webm';
  if (base.startsWith('audio/')) return base;
  return 'audio/webm';
}

/**
 * MediaRecorder → UploadFile → TranscribeAudio (same path as Base44 UI).
 * Keep this on /api/ai/transcribe-audio — not the assistant/chat refactor.
 */
export function useVoiceInput({ onText } = {}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const mimeRef = useRef('');
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);

  const cleanupStreams = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = useCallback(async () => {
    setError('');
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('הדפדפן לא תומך בהקלטה.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const preferred = pickRecorderMime();
      const rec = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      mimeRef.current = normalizeAudioMime(rec.mimeType || preferred || 'audio/webm');
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        cleanupStreams();
        // Let a late final dataavailable flush into chunksRef.
        await new Promise((r) => setTimeout(r, 30));
        const mime = normalizeAudioMime(mimeRef.current || 'audio/webm');
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (!blob.size || blob.size < 1500) {
          setTranscribing(false);
          setError('ההקלטה קצרה מדי או ריקה. הקליטי לפחות שנייה ונסי שוב.');
          return;
        }
        setTranscribing(true);
        try {
          const ext = extForMime(mime);
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
          const { file_url } = await api.integrations.Core.UploadFile({ file });
          const transcript = await api.integrations.Core.TranscribeAudio({ audio_url: file_url });
          const txt = (typeof transcript === 'string' ? transcript : (transcript && transcript.text) || '').trim();
          if (txt && onTextRef.current) onTextRef.current(txt);
          else setError('לא זוהה דיבור בהקלטה. נסי שוב.');
        } catch (e) {
          console.error('[useVoiceInput] transcribe failed', e);
          const msg = e?.message || '';
          if (/401|403|Unauthorized|auth/i.test(msg)) setError('יש להתחבר כדי להשתמש בהקלטה.');
          else if (/too short|incomplete|empty/i.test(msg)) setError('ההקלטה קצרה מדי. הקליטי שוב לאט יותר.');
          else if (/GEMINI|503|not configured/i.test(msg)) setError('שירות התמלול אינו זמין כרגע.');
          else setError('התמלול נכשל. נסי שוב.');
        } finally {
          setTranscribing(false);
        }
      };
      // No timeslice — one complete blob on stop (more reliable WebM for Gemini).
      rec.start();
      recRef.current = rec;
      startedAtRef.current = Date.now();
      setRecording(true);
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } catch {
      cleanupStreams();
      setError('לא אושרה גישה למיקרופון. אפשר הרשאה בהגדרות הדפדפן.');
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') {
      setRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    const elapsed = Date.now() - (startedAtRef.current || 0);
    const doStop = () => {
      stopTimerRef.current = null;
      const r = recRef.current;
      if (r && r.state !== 'inactive') {
        recRef.current = null;
        try { r.stop(); } catch { /* ignore */ }
      }
      setRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    if (elapsed < MIN_RECORD_MS) {
      // Avoid truncated WebM from a too-short press.
      stopTimerRef.current = setTimeout(doStop, MIN_RECORD_MS - elapsed);
      return;
    }
    doStop();
  }, []);

  const toggle = useCallback(() => { if (recording) stop(); else start(); }, [recording, start, stop]);

  return { recording, transcribing, error, elapsedSec, toggle, start, stop };
}
