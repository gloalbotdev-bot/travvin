/**
 * Own-backend integrations.Core — M10 InvokeLLM + M11 UploadFile.
 */
import { getApiBase, getStoredToken, ownFetch } from './http.js';

export const ownIntegrationsCore = {
  /**
   * Same return shape as Base44: string | object (not { data }).
   * @param {{ prompt: string, response_json_schema?: object, add_context_from_internet?: boolean, model?: string }} payload
   */
  async InvokeLLM(payload) {
    const data = await ownFetch('/api/ai/invoke-llm', {
      method: 'POST',
      body: payload || {},
      auth: false,
    });
    if (data && Object.prototype.hasOwnProperty.call(data, 'result')) {
      return data.result;
    }
    return data;
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
