/**
 * Own-backend integrations.Core — UploadFile + InvokeLLM + TranscribeAudio.
 */
import { getApiBase, getStoredToken } from './http.js';

async function postJson(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const ownIntegrationsCore = {
  /** Same contract as Base44 Core.InvokeLLM */
  async InvokeLLM(payload = {}) {
    return postJson('/api/ai/invoke-llm', payload);
  },

  /** Transcribe uploaded audio URL to Hebrew text */
  async TranscribeAudio({ audio_url } = {}) {
    return postJson('/api/ai/transcribe-audio', { audio_url });
  },

  /**
   * Same contract as Base44: UploadFile({ file }) → { file_url }.
   * @param {{ file: File | Blob }} payload
   */
  async UploadFile({ file } = {}) {
    if (!file) {
      const err = new Error('file is required');
      err.status = 400;
      throw err;
    }
    const form = new FormData();
    form.append('file', file);

    const headers = {};
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${getApiBase()}/api/upload`, {
      method: 'POST',
      headers,
      body: form,
    });

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!res.ok) {
      const err = new Error(data?.error || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
};
