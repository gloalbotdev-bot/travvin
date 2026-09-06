/**
 * TranscribeAudio — voice input for ported Base44 UI (MicButton / useVoiceInput).
 * Fetches audio from our upload URLs only; transcribes via Gemini.
 */
import { invokeGemini } from './llm/gemini.js';

const ALLOWED_PREFIXES = ['/uploads/', '/api/upload/'];

/**
 * @param {string} audioUrl
 * @returns {Promise<string>}
 */
export async function transcribeAudioUrl(audioUrl) {
  const url = String(audioUrl || '').trim();
  if (!url) {
    const err = new Error('audio_url required');
    err.status = 400;
    throw err;
  }

  let pathname = url;
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      pathname = new URL(url).pathname;
    }
  } catch {
    /* relative path */
  }

  const allowed = ALLOWED_PREFIXES.some((p) => pathname.includes(p) || url.includes(p));
  if (!allowed && !url.startsWith('/')) {
    const err = new Error('audio_url must be from app upload storage');
    err.status = 400;
    throw err;
  }

  if (process.env.LLM_MOCK === '1') {
    return 'טקסט mock מהקלטה';
  }

  const fetchImpl = globalThis.fetch;
  const res = await fetchImpl(url.startsWith('http') ? url : `http://127.0.0.1:${process.env.PORT || 3001}${url}`);
  if (!res.ok) {
    const err = new Error('failed to fetch audio');
    err.status = 400;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const b64 = buf.toString('base64');
  const mime = res.headers.get('content-type') || 'audio/webm';

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  const model = process.env.GEMINI_TRANSCRIBE_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const body = {
    contents: [
      {
        parts: [
          {
            text:
              'Transcribe this Hebrew voice recording to plain text. Return only the transcript, no punctuation labels.',
          },
          { inlineData: { mimeType: mime.split(';')[0], data: b64 } },
        ],
      },
    ],
  };

  const apiRes = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = await apiRes.json();
  if (!apiRes.ok) {
    const err = new Error(data?.error?.message || 'transcription failed');
    err.status = apiRes.status === 429 ? 503 : 502;
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || '';
  return text;
}
