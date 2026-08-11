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
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
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
  };
  return map[file.mimetype] || '.bin';
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
