-- document-attachments 버킷 MIME 제한 해제 (doc/hwp 등 모든 첨부 허용)
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'document-attachments';

NOTIFY pgrst, 'reload schema';
