-- ================================================
-- REDE CONECTA DOOH - VALIDADE TEMPORAL DE MÍDIA
-- Migration 006: Adicionar campos start_date e end_date
-- ================================================
-- 
-- Permite definir período de veiculação para cada mídia.
-- O Player filtrará automaticamente mídias fora do período.
-- ================================================

-- 1. Adicionar campo de data de início de veiculação
ALTER TABLE media 
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT NULL;

-- 2. Adicionar campo de data de fim de veiculação (expiração)
ALTER TABLE media 
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ DEFAULT NULL;

-- 3. Comentários explicativos
COMMENT ON COLUMN media.start_date IS 
  'Data/hora de início da veiculação. Se NULL, a mídia está disponível imediatamente.';

COMMENT ON COLUMN media.end_date IS 
  'Data/hora de expiração da veiculação. Se NULL, a mídia não expira.';

-- 4. Índice para consultas de validade
CREATE INDEX IF NOT EXISTS idx_media_validity 
  ON media(start_date, end_date) 
  WHERE status = 'active';

-- 5. View de mídias atualmente válidas
CREATE OR REPLACE VIEW v_active_media AS
SELECT *
FROM media
WHERE status = 'active'
  AND (start_date IS NULL OR start_date <= NOW())
  AND (end_date IS NULL OR end_date >= NOW());

-- 6. Função para verificar se mídia está válida
CREATE OR REPLACE FUNCTION is_media_valid(media_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  SELECT start_date, end_date, status 
  INTO v_start, v_end, v_status
  FROM media 
  WHERE id = media_id;
  
  IF v_status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  IF v_start IS NOT NULL AND v_start > NOW() THEN
    RETURN FALSE; -- Ainda não iniciou
  END IF;
  
  IF v_end IS NOT NULL AND v_end < NOW() THEN
    RETURN FALSE; -- Já expirou
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
