-- Milestone 4: generic entity store.
-- Run in Supabase SQL Editor if `prisma db push` hangs on the pooler (:6543).

CREATE TABLE IF NOT EXISTS records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_id TEXT,
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS records_entity_type_idx
  ON records (entity_type);

CREATE INDEX IF NOT EXISTS records_created_by_id_idx
  ON records (created_by_id);

CREATE INDEX IF NOT EXISTS records_entity_created_idx
  ON records (entity_type, created_date);

CREATE INDEX IF NOT EXISTS records_entity_updated_idx
  ON records (entity_type, updated_date);

-- GIN for JSONB containment / path queries
CREATE INDEX IF NOT EXISTS records_data_gin
  ON records USING GIN (data jsonb_path_ops);

-- Expression index for syncGoogleCalendar lookups (milestone 8)
CREATE INDEX IF NOT EXISTS records_calendar_event_id_idx
  ON records ((data->>'calendar_event_id'));
