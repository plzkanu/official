-- 공문접수 관리 시스템 — 전용 Supabase 프로젝트 SQL Editor 일괄 적용용
-- (supabase/migrations/001_od_schema.sql 과 동일)

CREATE TABLE IF NOT EXISTS od_departments (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  emails     TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS od_users (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  role            VARCHAR(30) NOT NULL,
  department_id   INTEGER REFERENCES od_departments(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_od_users_username ON od_users (username);
CREATE INDEX IF NOT EXISTS idx_od_users_role ON od_users (role);

CREATE TABLE IF NOT EXISTS od_reception_counters (
  id           SERIAL PRIMARY KEY,
  year         INTEGER NOT NULL UNIQUE,
  last_number  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS od_documents (
  id                      SERIAL PRIMARY KEY,
  reception_number        VARCHAR(20) UNIQUE,
  channel                 VARCHAR(20) NOT NULL,
  sender                  VARCHAR(200) NOT NULL,
  title                   VARCHAR(500) NOT NULL,
  doc_number              VARCHAR(100),
  input_reception_date    TIMESTAMPTZ,
  file_path               VARCHAR(500),
  original_filename       VARCHAR(255),
  status                  VARCHAR(30) NOT NULL DEFAULT 'pending_reception',
  registered_by_id        INTEGER NOT NULL REFERENCES od_users(id),
  received_by_id          INTEGER REFERENCES od_users(id),
  received_at             TIMESTAMPTZ,
  assigned_department_id  INTEGER REFERENCES od_departments(id),
  assigned_user_id        INTEGER REFERENCES od_users(id),
  deadline                TIMESTAMPTZ,
  memo                    TEXT,
  receipt_path            VARCHAR(500),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_od_documents_reception_number ON od_documents (reception_number);
CREATE INDEX IF NOT EXISTS idx_od_documents_status ON od_documents (status);
CREATE INDEX IF NOT EXISTS idx_od_documents_created_at ON od_documents (created_at DESC);

ALTER TABLE od_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE od_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE od_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE od_reception_counters DISABLE ROW LEVEL SECURITY;

-- 디지털 접수도장 (002_od_digital_stamp.sql)
CREATE TABLE IF NOT EXISTS od_digital_stamp (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_data  BYTEA NOT NULL,
  filename    VARCHAR(255) NOT NULL DEFAULT 'digital_stamp.png',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE od_digital_stamp DISABLE ROW LEVEL SECURITY;

-- 첨부·날인본 Storage 버킷 (003_od_storage_bucket.sql)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-attachments',
  'document-attachments',
  false,
  52428800,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = NULL;

-- 004: 기존 버킷 MIME 제한 해제 (이미 생성된 경우)
UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'document-attachments';

NOTIFY pgrst, 'reload schema';
