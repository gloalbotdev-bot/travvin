import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/api/client';

// Records audio from the microphone, uploads it, transcribes via TranscribeAudio,
// and calls onText(transcript). Returns UI state for the mic button.
export function useVoiceInput({ onText } = {}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);

  const cleanupStreams = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('הדפדפן לא תומך בהקלטה.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        cleanupStreams();
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        chunksRef.current = [];
        if (!blob.size) { setTranscribing(false); return; }
        setTranscribing(true);
        try {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
          const { file_url } = await api.integrations.Core.UploadFile({ file });
          const transcript = await api.integrations.Core.TranscribeAudio({ audio_url: file_url });
          const txt = (typeof transcript === 'string' ? transcript : (transcript && transcript.text) || '').trim();
          if (txt && onTextRef.current) onTextRef.current(txt);
        } catch (e) {
          setError('התמלול נכשל. נסה שוב.');
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
    } catch (e) {
      cleanupStreams();
      setError('לא אושרה גישה למיקרופון. אפשר הרשאה בהגדרות הדפדפן.');
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') { recRef.current = null; rec.stop(); }
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const toggle = useCallback(() => { if (recording) stop(); else start(); }, [recording, start, stop]);

  return { recording, transcribing, error, elapsedSec, toggle, start, stop };
}