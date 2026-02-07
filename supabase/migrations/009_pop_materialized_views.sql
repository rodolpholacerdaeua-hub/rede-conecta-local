-- ================================================
-- REDE CONECTA DOOH - MATERIALIZED VIEW PARA RELATÓRIOS
-- Migration 009: Agregação Diária de Proof of Play
-- ================================================
-- 
-- Esta Materialized View agrega os logs de playback por dia,
-- permitindo geração rápida de relatórios sem escanear milhões de linhas.
-- Refresh configurado para ser executado a cada 6 horas ou manualmente.
--
-- ================================================

-- 1. Criar Materialized View para agregação diária
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_pop_summary AS
SELECT 
  terminal_id,
  DATE(played_at) as play_date,
  media_id,
  media_name,
  slot_type,
  COUNT(*) as total_plays,
  MIN(played_at) as first_play,
  MAX(played_at) as last_play
FROM playback_logs
WHERE status = 'played'
GROUP BY terminal_id, DATE(played_at), media_id, media_name, slot_type;

-- 2. Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_pop 
  ON mv_daily_pop_summary(terminal_id, play_date, media_id, slot_type);

-- 3. Índices adicionais para queries comuns
CREATE INDEX IF NOT EXISTS idx_mv_pop_date ON mv_daily_pop_summary(play_date);
CREATE INDEX IF NOT EXISTS idx_mv_pop_terminal ON mv_daily_pop_summary(terminal_id);

-- 4. Função para refresh da Materialized View (RPC)
CREATE OR REPLACE FUNCTION refresh_pop_summary()
RETURNS json AS $$
DECLARE
  start_time TIMESTAMPTZ := clock_timestamp();
  row_count INTEGER;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_pop_summary;
  
  SELECT COUNT(*) INTO row_count FROM mv_daily_pop_summary;
  
  RETURN json_build_object(
    'success', true,
    'rows', row_count,
    'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER,
    'refreshed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Conceder permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION refresh_pop_summary() TO authenticated;

-- 6. View auxiliar para relatório mensal por terminal
CREATE OR REPLACE VIEW v_monthly_terminal_summary AS
SELECT 
  terminal_id,
  DATE_TRUNC('month', play_date) as month,
  COUNT(DISTINCT media_id) as unique_media_count,
  SUM(total_plays) as total_plays,
  MIN(first_play) as first_play_of_month,
  MAX(last_play) as last_play_of_month
FROM mv_daily_pop_summary
GROUP BY terminal_id, DATE_TRUNC('month', play_date);

-- 7. Função para obter estatísticas de um terminal em um período
CREATE OR REPLACE FUNCTION get_terminal_pop_stats(
  p_terminal_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS json AS $$
DECLARE
  stats json;
BEGIN
  SELECT json_build_object(
    'terminal_id', p_terminal_id,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'total_plays', COALESCE(SUM(total_plays), 0),
    'unique_media', COUNT(DISTINCT media_id),
    'active_days', COUNT(DISTINCT play_date),
    'avg_plays_per_day', ROUND(COALESCE(SUM(total_plays)::DECIMAL / NULLIF(COUNT(DISTINCT play_date), 0), 0), 2)
  ) INTO stats
  FROM mv_daily_pop_summary
  WHERE terminal_id = p_terminal_id
    AND play_date BETWEEN p_start_date AND p_end_date;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Conceder permissão para a função de estatísticas
GRANT EXECUTE ON FUNCTION get_terminal_pop_stats(UUID, DATE, DATE) TO authenticated;

-- 9. Comentários para documentação
COMMENT ON MATERIALIZED VIEW mv_daily_pop_summary IS 
  'Agregação diária de logs de Proof of Play. Refresh a cada 6 horas ou manual via RPC refresh_pop_summary().';

COMMENT ON FUNCTION refresh_pop_summary() IS 
  'Atualiza a Materialized View mv_daily_pop_summary. Pode ser chamada manualmente via Dashboard ou agendada via pg_cron.';

-- ================================================
-- NOTA: Para configurar refresh automático a cada 6 horas:
-- 
-- 1. Habilitar extensão pg_cron (se disponível no plano):
--    CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- 2. Agendar refresh:
--    SELECT cron.schedule('refresh-pop-summary', '0 */6 * * *', 'SELECT refresh_pop_summary()');
--
-- Enquanto pg_cron não está disponível, o refresh pode ser
-- disparado manualmente via botão no Dashboard admin.
-- ================================================
