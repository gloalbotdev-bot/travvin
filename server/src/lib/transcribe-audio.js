/**
 * TranscribeAudio — voice input for ported Base44 UI (MicButton / useVoiceInput).
 * Prefers reading uploaded files from local disk; falls back to HTTP fetch.
 *
 * Kept separate from InvokeLLM /assistant/chat — STT uses its own Gemini call.
 * Do not inherit GEMINI_MODEL (chat); use GEMINI_TRANSCRIBE_MODEL or defaults.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createStorage } from './storage/index.js';

const ALLOWED_PREFIXES = ['/uploads/', '/api/upload/'];

const EXT_MIME = {
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.wav': 'audio/wav',
};

/** STT defaults — gemini-2.0-flash is retired; keep chat GEMINI_MODEL out of this path. */
const DEFAULT_TRANSCRIBE_MODELS = (
  process.env.GEMINI_TRANSCRIBE_FALLBACK_MODELS ||
  'gemini-3.5-flash,gemini-flash-latest,gemini-3.6-flash'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Normalize Content-Type so Gemini gets a real audio/* type (not video/webm). */
function resolveAudioMime(headerMime, pathname) {
  let mime = String(headerMime || '').split(';')[0].trim().toLowerCase();
  if (mime === 'video/webm') mime = 'audio/webm';
  if (mime === 'audio/x-m4a' || mime === 'audio/aac') mime = 'audio/mp4';
  if (mime.startsWith('audio/')) return mime;
  const ext = (pathname.match(/\.[a-z0-9]+$/i) || [])[0]?.toLowerCase();
  if (ext && EXT_MIME[ext]) return EXT_MIME[ext];
  return mime || 'audio/webm';
}

function extractUploadKey(pathname) {
  const decoded = decodeURIComponent(String(pathname || ''));
  const m = decoded.match(/\/uploads\/([^/?#]+)$/i) || decoded.match(/\/api\/upload\/([^/?#]+)$/i);
  if (!m) return null;
  const key = path.basename(m[1]);
  if (!key || key === '.' || key === '..') return null;
  return key;
}

async function loadAudioBuffer(url, pathname) {
  const key = extractUploadKey(pathname);
  if (key) {
    try {
      const storage = createStorage();
      const filePath = path.join(storage.rootDir, key);
      const buf = await fs.readFile(filePath);
      return { buf, mime: resolveAudioMime('', pathname) };
    } catch {
      /* fall through to HTTP */
    }
  }

  const fetchImpl = globalThis.fetch;
  const fetchUrl = url.startsWith('http')
    ? url
    : `http://127.0.0.1:${process.env.PORT || 3001}${url.startsWith('/') ? url : `/${url}`}`;
  const res = await fetchImpl(fetchUrl);
  if (!res.ok) {
    const err = new Error('failed to fetch audio');
    err.status = 400;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, mime: resolveAudioMime(res.headers.get('content-type'), pathname) };
}

function resolveTranscribeModels() {
  const primary = process.env.GEMINI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODELS[0];
  return [primary, ...DEFAULT_TRANSCRIBE_MODELS.filter((m) => m !== primary)];
}

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

  const { buf, mime } = await loadAudioBuffer(url, pathname);
  if (!buf?.length) {
    const err = new Error('empty audio');
    err.status = 400;
    throw err;
  }
  // Tiny files are usually a broken MediaRecorder blob — Gemini will hallucinate.
  if (buf.length < 1500) {
    const err = new Error('audio too short or incomplete');
    err.status = 400;
    throw err;
  }
  const b64 = buf.toString('base64');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.status = 503;
    throw err;
  }

  const body = {
    contents: [
      {
        parts: [
          {
            text:
              'Transcribe this Hebrew voice recording to plain text. Return only the transcript, no punctuation labels.',
          },
          { inlineData: { mimeType: mime, data: b64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 512,
    },
  };

  const models = resolveTranscribeModels();
  let lastErr = null;
  for (const model of models) {
    try {
      const apiRes = await globalThis.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await apiRes.json();
      if (!apiRes.ok) {
        const msg = data?.error?.message || 'transcription failed';
        console.warn(`[transcribe] ${model} HTTP ${apiRes.status}: ${msg} (mime=${mime} bytes=${buf.length})`);
        lastErr = new Error(msg);
        lastErr.status = apiRes.status === 429 ? 503 : 502;
        continue;
      }

      const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || '';
      if (!text && blockReason && blockReason !== 'STOP') {
        console.warn(`[transcribe] ${model} blocked: ${blockReason} (mime=${mime} bytes=${buf.length})`);
        lastErr = new Error(`transcription blocked: ${blockReason}`);
        lastErr.status = 502;
        continue;
      }
      console.info(`[transcribe] ok model=${model} mime=${mime} bytes=${buf.length} chars=${text.length}`);
      return text;
    } catch (e) {
      lastErr = e;
      console.warn(`[transcribe] ${model} error:`, e?.message || e);
    }
  }

  throw lastErr || new Error('transcription failed');
}
