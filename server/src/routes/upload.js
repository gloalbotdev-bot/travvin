/**
 * File upload — M11 Core.UploadFile replacement.
 * Auth required (owners/admins/customers upload while logged in).
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';

const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
/** Discover videos — default 80MB (override with UPLOAD_MAX_VIDEO_BYTES) */
const MAX_VIDEO_BYTES = Number(
  process.env.UPLOAD_MAX_VIDEO_BYTES || 80 * 1024 * 1024,
);

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);
const AUDIO_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
]);
const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
]);
const ALLOWED_MIME = new Set([...IMAGE_MIME, ...AUDIO_MIME, ...VIDEO_MIME]);

const upload = multer({
  storage: multer.memoryStorage(),
  // Use the larger video cap; reject non-video over MAX_BYTES below.
  limits: { fileSize: Math.max(MAX_BYTES, MAX_VIDEO_BYTES), files: 1 },
});

function extFor(file) {
  const fromName = path.extname(file.originalname || '').toLowerCase();
  if (fromName && /^\.[a-z0-9]{1,8}$/i.test(fromName)) return fromName;
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
  };
  return map[file.mimetype] || '.bin';
}

function maxBytesForMime(mime) {
  if (mime && VIDEO_MIME.has(mime)) return MAX_VIDEO_BYTES;
  return MAX_BYTES;
}

/**
 * @param {{ put: Function, getUrl: Function }} storage
 */
export function createUploadRouter(storage) {
  const router = Router();

  router.post('/', requireAuth, (req, res) => {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        const status = err instanceof multer.MulterError ? 400 : 500;
        return res.status(status).json({
          error: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        const file = req.file;
        if (!file || !file.buffer?.length) {
          return res.status(400).json({ error: 'file is required' });
        }
        if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
          return res.status(400).json({
            error: `Unsupported file type: ${file.mimetype}`,
          });
        }

        const maxForType = maxBytesForMime(file.mimetype);
        if (file.size > maxForType) {
          return res.status(400).json({
            error: `File too large (max ${Math.round(maxForType / (1024 * 1024))}MB for this type)`,
          });
        }

        const key = `${crypto.randomUUID()}${extFor(file)}`;
        await storage.put({
          key,
          body: file.buffer,
          contentType: file.mimetype,
        });
        const file_url = storage.getUrl(key);
        // Same shape as Base44 Core.UploadFile
        res.json({ file_url });
      } catch (e) {
        const status = e?.status || 500;
        res.status(status).json({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });
  });

  return router;
}
