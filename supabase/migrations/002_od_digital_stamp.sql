-- 디지털 접수도장 (서버 재시작·Replit 재배포 후에도 유지)
CREATE TABLE IF NOT EXISTS od_digital_stamp (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_data  BYTEA NOT NULL,
  filename    VARCHAR(255) NOT NULL DEFAULT 'digital_stamp.png',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE od_digital_stamp DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
