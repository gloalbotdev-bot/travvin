/**
 * Load uploaded files from local storage as Gemini inlineData parts.
 * Only reads from the uploads directory — never fetches external URLs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createStorage } from '../storage/index.js';

/** Gemini inline request limit is ~20MB; leave room for the prompt. */
const MAX_TOTAL_BYTES = Number(process.env.LLM_ATTACHMENTS_MAX_BYTES || 15 * 1024 * 1024);

const EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

function uploadKey(pathname) {
  const m = String(pathname || '').match(/\/(?:uploads|api\/upload)\/([^/?#]+)$/i);
  if (!m) return null;
  const key = path.basename(decodeURIComponent(m[1]));
  if (!key || key === '.' || key === '..') return null;
  return key;
}

/**
 * @param {string[]} paths upload paths validated by request-validator
 * @returns {Promise<Array<{ inlineData: { mimeType: string, data: string } }>>}
 */
export async function loadAttachmentParts(paths = []) {
  if (!paths.length) return [];
  const storage = createStorage();
  const parts = [];
  let total = 0;
  for (const p of paths) {
    const key = uploadKey(p);
    const mimeType = key && EXT_MIME[path.extname(key).toLowerCase()];
    if (!key || !mimeType) {
      console.warn(`[llm] skipping unsupported attachment: ${p}`);
      continue;
    }
    let buf;
    try {
      buf = await fs.readFile(path.join(storage.rootDir, key));
    } catch {
      console.warn(`[llm] attachment not found: ${key}`);
      continue;
    }
    if (total + buf.length > MAX_TOTAL_BYTES) {
      console.warn(`[llm] attachment over size budget, skipped: ${key}`);
      continue;
    }
    total += buf.length;
    parts.push({ inlineData: { mimeType, data: buf.toString('base64') } });
  }
  return parts;
}
