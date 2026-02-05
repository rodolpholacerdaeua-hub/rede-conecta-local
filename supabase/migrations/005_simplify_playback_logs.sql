-- ================================================
-- REDE CONECTA DOOH - SIMPLIFICAÇÃO PROOF OF PLAY
-- Migration 005: Simplificar logs de exibição
-- ================================================
-- 
-- FILOSOFIA: Registrar APENAS que uma mídia foi exibida.
-- NÃO garantimos duração completa ou eventos externos 
-- (quedas de energia, internet, pico de luz, etc).
--
-- Este é um LOG DE MELHOR ESFORÇO, não uma garantia contratual.
-- ================================================

-- 1. Remover colunas que implicam responsabilidade excessiva
ALTER TABLE playback_logs 
  DROP COLUMN IF EXISTS duration_played,
  DROP COLUMN IF EXISTS completed;

-- 2. Adicionar coluna de status simplificado
-- 'played' = a mídia foi enviada para exibição
-- Não garantimos que foi vista por X segundos
ALTER TABLE playback_logs 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'played' 
  CHECK (status IN ('played', 'skipped', 'error'));

-- 3. Adicionar comentário explicativo na tabela
COMMENT ON TABLE playback_logs IS 
  'Log de exibição de mídias (Proof of Play). 
   Registra que uma mídia foi enviada para exibição em um terminal.
   NÃO garante duração completa devido a fatores externos 
   (quedas de energia, internet, etc).';

-- 4. Criar view simplificada para relatórios
CREATE OR REPLACE VIEW v_proof_of_play AS
SELECT 
  pl.id,
  pl.terminal_id,
  t.name as terminal_name,
  t.location as terminal_location,
  pl.media_id,
  pl.media_name,
  pl.slot_type,
  pl.played_at,
  DATE(pl.played_at) as played_date,
  EXTRACT(HOUR FROM pl.played_at) as played_hour,
  pl.status
FROM playback_logs pl
LEFT JOIN terminals t ON t.id = pl.terminal_id
WHERE pl.status = 'played'
ORDER BY pl.played_at DESC;

-- 5. Criar função para relatório mensal simplificado
CREATE OR REPLACE FUNCTION get_monthly_pop_report(
  p_terminal_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  media_name TEXT,
  slot_type TEXT,
  total_plays BIGINT,
  first_play TIMESTAMPTZ,
  last_play TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.media_name,
    pl.slot_type,
    COUNT(*) as total_plays,
    MIN(pl.played_at) as first_play,
    MAX(pl.played_at) as last_play
  FROM playback_logs pl
  WHERE pl.terminal_id = p_terminal_id
    AND EXTRACT(MONTH FROM pl.played_at) = p_month
    AND EXTRACT(YEAR FROM pl.played_at) = p_year
    AND pl.status = 'played'
  GROUP BY pl.media_name, pl.slot_type
  ORDER BY total_plays DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Índice otimizado para consultas por mês
CREATE INDEX IF NOT EXISTS idx_pop_monthly 
  ON playback_logs(terminal_id, DATE(played_at), status);

-- 7. Policy RLS simplificada para inserção
-- Permitir que qualquer terminal autenticado insira logs
DROP POLICY IF EXISTS "Terminals can insert playback logs" ON playback_logs;
CREATE POLICY "Terminals can insert playback logs" 
  ON playback_logs FOR INSERT 
  WITH CHECK (true);

-- 8. Policy para leitura (donos podem ver seus logs)
DROP POLICY IF EXISTS "Owners can read their terminal logs" ON playback_logs;
CREATE POLICY "Owners can read their terminal logs" 
  ON playback_logs FOR SELECT 
  USING (
    terminal_id IN (
      SELECT id FROM terminals WHERE owner_id = auth.uid()
    )
  );
