-- =============================================
-- Migration 013: Media Swap Support
-- Permite troca de mídia em campanhas mensais ativas
-- =============================================

-- Campo para mídia pendente de swap (aguardando moderação)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pending_swap_media_id UUID REFERENCES media(id) ON DELETE SET NULL;

-- Contador de swaps realizados
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS swap_count INTEGER DEFAULT 0;

-- Índice para localizar campanhas com swap pendente
CREATE INDEX IF NOT EXISTS idx_campaigns_pending_swap ON campaigns(pending_swap_media_id) WHERE pending_swap_media_id IS NOT NULL;

COMMENT ON COLUMN campaigns.pending_swap_media_id IS 'Mídia aguardando aprovação para substituir a atual. NULL = sem swap pendente.';
COMMENT ON COLUMN campaigns.swap_count IS 'Quantidade de trocas de mídia realizadas nesta campanha.';
