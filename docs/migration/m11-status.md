# Milestone 11 status

Date: 2026-08-09

## Decision

Storage **v1 = local disk + static `/uploads`**. Interface `put` / `getUrl` allows S3 later without frontend changes. Upload requires authenticated user (no anonymous).

## Done

- Server: `server/src/lib/storage/{index,local-disk}.js` + `routes/upload.js`
- `POST /api/upload` (multipart field `file`) → `{ file_url }` (Base44 contract)
- Static serve: `express.static` on storage root at `/uploads`
- Client: `VITE_BACKEND_FILES=own` wires `Core.UploadFile` → own backend
- `image.jsx`: own URLs stay plain `<img>`; `media.base44.com` / wix still transform
- Smoke: `npm run test:upload`
- Consumers unchanged: `ZimmerEditor`, `ZimmerCreatorChat`, `ReviewForm`

## Env (server/.env)

```
PUBLIC_API_URL=http://localhost:3001
# STORAGE_DRIVER=local
# STORAGE_LOCAL_DIR=./uploads
# UPLOAD_MAX_BYTES=10485760
```

## Flip (.env.local)

```
VITE_BACKEND_FILES=own
```

Rollback: `VITE_BACKEND_FILES=base44` (or unset).

## Verify

```bash
cd server
npm run test:upload
```

Manual (logged-in):

1. ZimmerEditor — upload image → appears in form + ZimmerView
2. ZimmerCreatorChat — same
3. ReviewForm — up to 6 photos
4. Old `media.base44.com` images still load
5. Flip to `base44` restores Base44 UploadFile

## Next

**M12** — DONE (see [m12-status.md](./m12-status.md)). Next: **M13** remove SDK/flags (or **M16** agent UI cleanup).
