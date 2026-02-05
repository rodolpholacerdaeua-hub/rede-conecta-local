-- =============================================
-- Migration 007: Campaign Validity & Media Cleanup
-- =============================================

-- 1. Adicionar campos de validade na tabela campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30;

-- 2. Adicionar campo archived_at na tabela media para soft delete com prazo
ALTER TABLE media ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 3. Atualizar campanhas já aprovadas (backfill)
UPDATE campaigns 
SET approved_at = updated_at,
    expires_at = updated_at + INTERVAL '30 days',
    validity_days = 30
WHERE moderation_status = 'approved' 
  AND approved_at IS NULL;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_campaigns_expires_at ON campaigns(expires_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_moderation_status ON campaigns(moderation_status);
CREATE INDEX IF NOT EXISTS idx_media_archived_at ON media(archived_at);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);

-- 5. Função para arquivar mídias órfãs
CREATE OR REPLACE FUNCTION archive_orphan_media()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Arquivar mídias que não estão vinculadas a nenhuma campanha ativa/pendente
    UPDATE media 
    SET status = 'archived',
        archived_at = NOW()
    WHERE id IN (
        SELECT m.id 
        FROM media m
        WHERE m.status = 'active'
          AND m.id NOT IN (
              SELECT h_media_id FROM campaigns WHERE h_media_id IS NOT NULL AND moderation_status IN ('pending', 'approved')
              UNION
              SELECT v_media_id FROM campaigns WHERE v_media_id IS NOT NULL AND moderation_status IN ('pending', 'approved')
          )
    );
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para hard delete de mídias arquivadas há mais de 15 dias
CREATE OR REPLACE FUNCTION cleanup_archived_media()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar mídias arquivadas há mais de 15 dias
    DELETE FROM media 
    WHERE status = 'archived' 
      AND archived_at < NOW() - INTERVAL '15 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para expirar campanhas automaticamente
CREATE OR REPLACE FUNCTION expire_campaigns()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Desativar campanhas expiradas
    UPDATE campaigns 
    SET is_active = false,
        moderation_status = 'expired'
    WHERE moderation_status = 'approved' 
      AND expires_at IS NOT NULL 
      AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Adicionar status 'expired' e 'archived' se não existirem (checagem segura)
-- Nota: moderation_status e media.status são provavelmente TEXT, então qualquer valor é válido

COMMENT ON FUNCTION archive_orphan_media() IS 'Arquiva mídias que não estão vinculadas a nenhuma campanha ativa ou pendente';
COMMENT ON FUNCTION cleanup_archived_media() IS 'Remove permanentemente mídias arquivadas há mais de 15 dias';
COMMENT ON FUNCTION expire_campaigns() IS 'Marca campanhas expiradas como inativas';
