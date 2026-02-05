-- ================================================
-- REDE CONECTA DOOH - VIEWS E FUNÇÕES DE RELATÓRIO
-- Migration: Report Functions
-- ================================================

-- ================================================
-- VIEW: Resumo de Terminais (Dashboard)
-- ================================================
CREATE OR REPLACE VIEW terminal_summary AS
SELECT 
    t.id,
    t.name,
    t.location,
    t.city,
    t.status,
    t.last_seen,
    t.app_version,
    t.orientation,
    t.power_mode,
    t.owner_id,
    p.name AS playlist_name,
    (
        SELECT COUNT(*) 
        FROM playback_logs pl 
        WHERE pl.terminal_id = t.id 
        AND pl.played_at >= CURRENT_DATE
    ) AS plays_today,
    (
        SELECT COUNT(*) 
        FROM playback_logs pl 
        WHERE pl.terminal_id = t.id 
        AND pl.played_at >= CURRENT_DATE - INTERVAL '7 days'
    ) AS plays_week
FROM terminals t
LEFT JOIN playlists p ON t.active_playlist_id = p.id;

-- ================================================
-- FUNÇÃO: Relatório POE por Terminal
-- ================================================
CREATE OR REPLACE FUNCTION get_terminal_poe_report(
    p_terminal_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT CURRENT_DATE,
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    media_name TEXT,
    media_type TEXT,
    play_count BIGINT,
    total_seconds BIGINT,
    first_play TIMESTAMPTZ,
    last_play TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pl.media_name,
        m.type AS media_type,
        COUNT(*) AS play_count,
        COALESCE(SUM(pl.duration_played), 0)::BIGINT AS total_seconds,
        MIN(pl.played_at) AS first_play,
        MAX(pl.played_at) AS last_play
    FROM playback_logs pl
    LEFT JOIN media m ON pl.media_id = m.id
    WHERE pl.terminal_id = p_terminal_id
      AND pl.played_at BETWEEN p_start_date AND p_end_date
    GROUP BY pl.media_name, m.type
    ORDER BY play_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNÇÃO: Relatório de Audiência por Horário
-- ================================================
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
    FROM playback_logs
    WHERE terminal_id = p_terminal_id
      AND played_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY hour_of_day
    ORDER BY hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNÇÃO: Dashboard Stats para Owner
-- ================================================
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
        (SELECT COUNT(*) FROM terminals WHERE owner_id = p_owner_id)::BIGINT,
        (SELECT COUNT(*) FROM terminals WHERE owner_id = p_owner_id AND status = 'online')::BIGINT,
        (SELECT COUNT(*) FROM media WHERE owner_id = p_owner_id AND status = 'active')::BIGINT,
        (SELECT COUNT(*) FROM campaigns WHERE owner_id = p_owner_id AND status = 'active')::BIGINT,
        (
            SELECT COUNT(*) FROM playback_logs pl
            JOIN terminals t ON pl.terminal_id = t.id
            WHERE t.owner_id = p_owner_id AND pl.played_at >= CURRENT_DATE
        )::BIGINT,
        (
            SELECT COUNT(*) FROM playback_logs pl
            JOIN terminals t ON pl.terminal_id = t.id
            WHERE t.owner_id = p_owner_id AND pl.played_at >= CURRENT_DATE - INTERVAL '7 days'
        )::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNÇÃO: Registrar Pareamento de Terminal
-- ================================================
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
    -- Verificar se já existe terminal com esse hardware_id
    SELECT id INTO v_terminal_id
    FROM terminals
    WHERE hardware_id = p_hardware_id;
    
    IF v_terminal_id IS NOT NULL THEN
        -- Atualizar terminal existente
        UPDATE terminals
        SET owner_id = p_owner_id,
            name = p_name,
            status = 'online',
            last_seen = NOW(),
            updated_at = NOW()
        WHERE id = v_terminal_id;
    ELSE
        -- Criar novo terminal
        INSERT INTO terminals (hardware_id, pairing_code, owner_id, name, status, last_seen)
        VALUES (p_hardware_id, p_pairing_code, p_owner_id, p_name, 'online', NOW())
        RETURNING id INTO v_terminal_id;
    END IF;
    
    RETURN v_terminal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- TRIGGER: Atualizar updated_at automaticamente
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas com updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_terminals_updated_at
    BEFORE UPDATE ON terminals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
