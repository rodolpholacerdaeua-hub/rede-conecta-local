-- ================================================
-- REDE CONECTA DOOH - SECURITY HARDENING
-- Migration 014: Fix todas as vulnerabilidades do Supabase Linter
-- ================================================
--
-- O QUE ESTA MIGRATION FAZ:
-- 1. Remove SECURITY DEFINER das views (terminal_summary, v_monthly_terminal_summary)
-- 2. Adiciona SET search_path = '' em TODAS as funções SECURITY DEFINER
-- 3. Remove policies de UPDATE abertas na tabela terminals
-- 4. Revoga acesso público à materialized view mv_daily_pop_summary
-- 5. Restringe INSERT/UPDATE em pairing_codes e screen_alerts
-- ================================================

-- ================================================
-- 1. DROP E RECRIAR VIEWS SEM SECURITY DEFINER
-- ================================================

DROP VIEW IF EXISTS terminal_summary CASCADE;
CREATE VIEW terminal_summary AS
SELECT 
    t.id AS terminal_id,
    t.name,
    t.status,
    t.last_seen,
    t.owner_id,
    t.active_playlist_id,
    p.name AS playlist_name
FROM terminals t
LEFT JOIN playlists p ON t.active_playlist_id = p.id;

DROP VIEW IF EXISTS v_monthly_terminal_summary CASCADE;
CREATE VIEW v_monthly_terminal_summary AS
SELECT 
  terminal_id,
  DATE_TRUNC('month', play_date) as month,
  COUNT(DISTINCT media_id) as unique_media_count,
  SUM(total_plays) as total_plays,
  MIN(first_play) as first_play_of_month,
  MAX(last_play) as last_play_of_month
FROM mv_daily_pop_summary
GROUP BY terminal_id, DATE_TRUNC('month', play_date);

-- ================================================
-- 2. RECRIAR FUNÇÕES COM SET search_path = ''
-- ================================================

DROP FUNCTION IF EXISTS get_terminal_poe_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION get_terminal_poe_report(
    p_terminal_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT CURRENT_DATE,
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    media_name TEXT,
    media_type TEXT,
    play_count BIGINT,
    first_play TIMESTAMPTZ,
    last_play TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pl.media_name,
        m.type AS media_type,
        COUNT(*) AS play_count,
        MIN(pl.played_at) AS first_play,
        MAX(pl.played_at) AS last_play
    FROM public.playback_logs pl
    LEFT JOIN public.media m ON pl.media_id = m.id
    WHERE pl.terminal_id = p_terminal_id
      AND pl.played_at BETWEEN p_start_date AND p_end_date
    GROUP BY pl.media_name, m.type
    ORDER BY play_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION get_hourly_audience(
    p_terminal_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    hour_of_day INTEGER,
    play_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM played_at)::INTEGER AS hour_of_day,
        COUNT(*) AS play_count
    FROM public.playback_logs
    WHERE terminal_id = p_terminal_id
      AND played_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY hour_of_day
    ORDER BY hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION get_owner_dashboard_stats(p_owner_id UUID)
RETURNS TABLE (
    total_terminals BIGINT,
    online_terminals BIGINT,
    total_media BIGINT,
    total_campaigns BIGINT,
    plays_today BIGINT,
    plays_this_week BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.terminals WHERE owner_id = p_owner_id)::BIGINT,
        (SELECT COUNT(*) FROM public.terminals WHERE owner_id = p_owner_id AND status = 'online')::BIGINT,
        (SELECT COUNT(*) FROM public.media WHERE owner_id = p_owner_id AND status = 'active')::BIGINT,
        (SELECT COUNT(*) FROM public.campaigns WHERE owner_id = p_owner_id AND status = 'active')::BIGINT,
        (
            SELECT COUNT(*) FROM public.playback_logs pl
            JOIN public.terminals t ON pl.terminal_id = t.id
            WHERE t.owner_id = p_owner_id AND pl.played_at >= CURRENT_DATE
        )::BIGINT,
        (
            SELECT COUNT(*) FROM public.playback_logs pl
            JOIN public.terminals t ON pl.terminal_id = t.id
            WHERE t.owner_id = p_owner_id AND pl.played_at >= CURRENT_DATE - INTERVAL '7 days'
        )::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION pair_terminal(
    p_hardware_id TEXT,
    p_pairing_code TEXT,
    p_owner_id UUID,
    p_name TEXT DEFAULT 'Novo Terminal'
)
RETURNS UUID AS $$
DECLARE
    v_terminal_id UUID;
BEGIN
    SELECT id INTO v_terminal_id
    FROM public.terminals
    WHERE hardware_id = p_hardware_id;
    
    IF v_terminal_id IS NOT NULL THEN
        UPDATE public.terminals
        SET owner_id = p_owner_id,
            name = p_name,
            status = 'online',
            last_seen = NOW(),
            updated_at = NOW()
        WHERE id = v_terminal_id;
    ELSE
        INSERT INTO public.terminals (hardware_id, pairing_code, owner_id, name, status, last_seen)
        VALUES (p_hardware_id, p_pairing_code, p_owner_id, p_name, 'online', NOW())
        RETURNING id INTO v_terminal_id;
    END IF;
    
    RETURN v_terminal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

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
  FROM public.playback_logs pl
  WHERE pl.terminal_id = p_terminal_id
    AND EXTRACT(MONTH FROM pl.played_at) = p_month
    AND EXTRACT(YEAR FROM pl.played_at) = p_year
    AND pl.status = 'played'
  GROUP BY pl.media_name, pl.slot_type
  ORDER BY total_plays DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION is_media_valid(media_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  SELECT start_date, end_date, status 
  INTO v_start, v_end, v_status
  FROM public.media 
  WHERE id = media_id;
  
  IF v_status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  IF v_start IS NOT NULL AND v_start > NOW() THEN
    RETURN FALSE;
  END IF;
  
  IF v_end IS NOT NULL AND v_end < NOW() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION archive_orphan_media()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE public.media 
    SET status = 'archived',
        archived_at = NOW()
    WHERE id IN (
        SELECT m.id 
        FROM public.media m
        WHERE m.status = 'active'
          AND m.id NOT IN (
              SELECT h_media_id FROM public.campaigns WHERE h_media_id IS NOT NULL AND moderation_status IN ('pending', 'approved')
              UNION
              SELECT v_media_id FROM public.campaigns WHERE v_media_id IS NOT NULL AND moderation_status IN ('pending', 'approved')
          )
    );
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION cleanup_archived_media()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.media 
    WHERE status = 'archived' 
      AND archived_at < NOW() - INTERVAL '15 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION expire_campaigns()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.campaigns 
    SET is_active = false,
        moderation_status = 'expired'
    WHERE moderation_status = 'approved' 
      AND expires_at IS NOT NULL 
      AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION refresh_pop_summary()
RETURNS json AS $$
DECLARE
  start_time TIMESTAMPTZ := clock_timestamp();
  row_count INTEGER;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_pop_summary;
  
  SELECT COUNT(*) INTO row_count FROM public.mv_daily_pop_summary;
  
  RETURN json_build_object(
    'success', true,
    'rows', row_count,
    'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER,
    'refreshed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

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
  FROM public.mv_daily_pop_summary
  WHERE terminal_id = p_terminal_id
    AND play_date BETWEEN p_start_date AND p_end_date;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ================================================
-- 3. REMOVER POLICIES DE UPDATE ABERTAS
-- ================================================

DROP POLICY IF EXISTS "Unclaimed terminals can be claimed" ON terminals;
DROP POLICY IF EXISTS "Allow public update terminals" ON terminals;
DROP POLICY IF EXISTS "Terminal update policy" ON terminals;

CREATE POLICY "Terminal update policy" ON terminals
    FOR UPDATE
    TO authenticated
    USING (
        (owner_id IS NULL) OR (owner_id = (select auth.uid())) OR public.is_admin()
    )
    WITH CHECK (
        (owner_id = (select auth.uid())) OR public.is_admin()
    );

-- ================================================
-- 4. RESTRINGIR PAIRING_CODES E SCREEN_ALERTS
-- ================================================

DROP POLICY IF EXISTS "Allow anon insert pairing codes" ON pairing_codes;
DROP POLICY IF EXISTS "Allow anon update pairing codes" ON pairing_codes;

CREATE POLICY "Anon can insert pairing codes" ON pairing_codes
    FOR INSERT
    WITH CHECK (hardware_id IS NOT NULL AND code IS NOT NULL);

CREATE POLICY "Authenticated can update pairing codes" ON pairing_codes
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Terminals can create alerts" ON screen_alerts;

CREATE POLICY "Authenticated can create alerts" ON screen_alerts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- ================================================
-- 5. REVOGAR ACESSO PÚBLICO À MATERIALIZED VIEW
-- ================================================

REVOKE SELECT ON mv_daily_pop_summary FROM anon;
REVOKE SELECT ON mv_daily_pop_summary FROM authenticated;
