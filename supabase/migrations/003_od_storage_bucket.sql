-- 첨부·날인본 Supabase Storage 버킷 (로컬·Replit 공통)
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

NOTIFY pgrst, 'reload schema';
