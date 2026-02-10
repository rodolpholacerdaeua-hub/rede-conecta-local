-- ================================================
-- REDE CONECTA DOOH - REINFORCE RLS INSERT POLICIES
-- Migration: Restrict open INSERT policies
-- ================================================

-- 1. PLAYBACK_LOGS: Restringir INSERT para usuários autenticados
DROP POLICY IF EXISTS "Terminals can insert POE" ON playback_logs;
CREATE POLICY "Authenticated can insert POE" ON playback_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. TERMINAL_LOGS: Restringir INSERT para usuários autenticados
DROP POLICY IF EXISTS "Terminals can insert logs" ON terminal_logs;
CREATE POLICY "Authenticated can insert logs" ON terminal_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. TERMINALS: Manter INSERT para pareamento mas exigir autenticação
DROP POLICY IF EXISTS "Allow terminal pairing" ON terminals;
CREATE POLICY "Authenticated can register terminals" ON terminals
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
