-- ================================================
-- REDE CONECTA DOOH - FIX SECURITY DEFINER VIEWS
-- Migration: Security Fix (Supabase Advisory)
-- ================================================
-- Problema: Views criadas com SECURITY DEFINER permitem
-- que qualquer usuário veja dados como se fosse o criador,
-- ignorando as políticas de segurança (RLS).
-- Solução: Recriar com SECURITY INVOKER (respeita RLS do usuário).

-- 1. terminal_summary
DROP VIEW IF EXISTS public.terminal_summary;
CREATE VIEW public.terminal_summary 
WITH (security_invoker = true)
AS
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

-- 2. v_monthly_terminal_summary
DROP VIEW IF EXISTS public.v_monthly_terminal_summary;
CREATE VIEW public.v_monthly_terminal_summary
WITH (security_invoker = true)
AS
SELECT 
    terminal_id,
    date_trunc('month', play_date::timestamp with time zone) AS month,
    count(DISTINCT media_id) AS unique_media_count,
    sum(total_plays) AS total_plays,
    min(first_play) AS first_play_of_month,
    max(last_play) AS last_play_of_month
FROM mv_daily_pop_summary
GROUP BY terminal_id, date_trunc('month', play_date::timestamp with time zone);
