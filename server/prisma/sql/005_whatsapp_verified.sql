-- WhatsApp bot: mark when an owner/admin linked their profile phone via OTP.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;
