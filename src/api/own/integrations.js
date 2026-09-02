/**
 * Own-backend integrations.Core — M11 UploadFile (InvokeLLM deprecated → api.assistant.chat).
 */
import { getApiBase, getStoredToken } from './http.js';

export const ownIntegrationsCore = {
  /**
   * @deprecated Use api.assistant.chat with a profile instead.
   */
  async InvokeLLM() {
    const err = new Error(
      'InvokeLLM is deprecated. Use api.assistant.chat with a profile instead.',
    );
    err.status = 410;
    err.code = 'DEPRECATED';
    throw err;
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
