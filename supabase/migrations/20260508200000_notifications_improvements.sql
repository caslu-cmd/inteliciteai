-- Ensure notifications table has all needed columns
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT;

-- Index for fast unread lookups
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC)
  WHERE read = false;

-- Function: auto-notify on document generated
CREATE OR REPLACE FUNCTION public.notify_document_generated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, action_url, read)
  VALUES (
    NEW.user_id,
    NEW.tipo || ' gerado com sucesso',
    NEW.titulo,
    'success',
    '/dashboard/documents',
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_document_generated ON public.documents;
CREATE TRIGGER on_document_generated
  AFTER INSERT ON public.documents
  FOR EACH ROW
  WHEN (NEW.status = 'finalizado')
  EXECUTE FUNCTION public.notify_document_generated();

-- Function: auto-notify on consultant status change
CREATE OR REPLACE FUNCTION public.notify_consultant_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  msg TEXT;
  ntype TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN msg := 'Parabéns! Sua verificação foi aprovada.'; ntype := 'success';
      WHEN 'rejected' THEN msg := 'Sua verificação foi rejeitada. Verifique o motivo e reenvie.'; ntype := 'error';
      WHEN 'in_review' THEN msg := 'Sua documentação está em revisão pela equipe.'; ntype := 'info';
      WHEN 'flagged' THEN msg := 'Revisão adicional necessária. Entre em contato com o suporte.'; ntype := 'warning';
      ELSE msg := NULL;
    END CASE;

    IF msg IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, action_url, read)
      VALUES (
        NEW.user_id,
        'Verificação de Consultor — ' || NEW.status,
        msg,
        ntype,
        '/consultor',
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_consultant_status_change ON public.consultant_verifications;
CREATE TRIGGER on_consultant_status_change
  AFTER UPDATE OF status ON public.consultant_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_consultant_status();
