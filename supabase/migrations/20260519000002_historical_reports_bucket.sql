-- Bucket para armazenar os PDFs de relatórios históricos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('historical-reports', 'historical-reports', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS de storage: cada usuário acessa apenas sua própria pasta
CREATE POLICY "historical_reports_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'historical-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "historical_reports_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'historical-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "historical_reports_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'historical-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
