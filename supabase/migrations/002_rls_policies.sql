-- ================================================
-- REDE CONECTA DOOH - ROW LEVEL SECURITY (RLS)
-- Migration: Security Policies
-- ================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ================================================
-- FUNÇÃO AUXILIAR: Verificar se é admin
-- ================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- POLÍTICAS: USERS
-- ================================================
-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = auth.uid());

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Admins podem ver todos os usuários
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (is_admin());

-- Admins podem gerenciar todos os usuários
CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (is_admin());

-- ================================================
-- POLÍTICAS: TERMINALS
-- ================================================
-- Usuários veem seus próprios terminais
CREATE POLICY "Users see own terminals" ON terminals
    FOR SELECT USING (owner_id = auth.uid() OR owner_id IS NULL);

-- Usuários podem atualizar seus terminais
CREATE POLICY "Users can update own terminals" ON terminals
    FOR UPDATE USING (owner_id = auth.uid());

-- Terminais não pareados podem ser reivindicados
CREATE POLICY "Unclaimed terminals can be claimed" ON terminals
    FOR UPDATE USING (owner_id IS NULL);

-- Admins veem todos os terminais
CREATE POLICY "Admins see all terminals" ON terminals
    FOR ALL USING (is_admin());

-- Permitir insert para pareamento (service role ou anônimo autenticado)
CREATE POLICY "Allow terminal pairing" ON terminals
    FOR INSERT WITH CHECK (true);

-- ================================================
-- POLÍTICAS: MEDIA
-- ================================================
CREATE POLICY "Users see own media" ON media
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can manage own media" ON media
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Admins can manage all media" ON media
    FOR ALL USING (is_admin());

-- ================================================
-- POLÍTICAS: ADVERTISERS
-- ================================================
CREATE POLICY "Users see own advertisers" ON advertisers
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can manage own advertisers" ON advertisers
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Admins can manage all advertisers" ON advertisers
    FOR ALL USING (is_admin());

-- ================================================
-- POLÍTICAS: CAMPAIGNS
-- ================================================
CREATE POLICY "Users see own campaigns" ON campaigns
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can manage own campaigns" ON campaigns
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Admins can manage all campaigns" ON campaigns
    FOR ALL USING (is_admin());

-- ================================================
-- POLÍTICAS: PLAYLISTS
-- ================================================
CREATE POLICY "Users see own playlists" ON playlists
    FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can manage own playlists" ON playlists
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Admins can manage all playlists" ON playlists
    FOR ALL USING (is_admin());

-- ================================================
-- POLÍTICAS: PLAYLIST_SLOTS
-- ================================================
-- Slots seguem a política da playlist pai
CREATE POLICY "Users can view slots of own playlists" ON playlist_slots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM playlists 
            WHERE id = playlist_slots.playlist_id 
            AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage slots of own playlists" ON playlist_slots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM playlists 
            WHERE id = playlist_slots.playlist_id 
            AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all slots" ON playlist_slots
    FOR ALL USING (is_admin());

-- ================================================
-- POLÍTICAS: PLAYBACK_LOGS (POE)
-- ================================================
-- Usuários veem logs de seus terminais
CREATE POLICY "Users see own terminal POE" ON playback_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM terminals 
            WHERE id = playback_logs.terminal_id 
            AND owner_id = auth.uid()
        )
    );

-- Terminais podem inserir seus próprios logs
CREATE POLICY "Terminals can insert POE" ON playback_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all POE" ON playback_logs
    FOR SELECT USING (is_admin());

-- ================================================
-- POLÍTICAS: TERMINAL_LOGS
-- ================================================
CREATE POLICY "Users see own terminal logs" ON terminal_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM terminals 
            WHERE id = terminal_logs.terminal_id 
            AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Terminals can insert logs" ON terminal_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all logs" ON terminal_logs
    FOR SELECT USING (is_admin());

-- ================================================
-- POLÍTICAS: TRANSACTIONS
-- ================================================
CREATE POLICY "Users see own transactions" ON transactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage transactions" ON transactions
    FOR ALL USING (is_admin());
