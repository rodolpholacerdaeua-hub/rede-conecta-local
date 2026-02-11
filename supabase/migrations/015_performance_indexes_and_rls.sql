-- ================================================
-- REDE CONECTA DOOH - PERFORMANCE OPTIMIZATION
-- Migration 015: Indexes + RLS initplan fix
-- ================================================
--
-- O QUE ESTA MIGRATION FAZ:
-- 1. Cria 14 índices para FKs sem índice (evita sequential scans em JOINs)
-- 2. Reescreve ~50 RLS policies trocando auth.uid() por (select auth.uid())
--    para usar initplan optimization (avaliado 1x por query em vez de 1x por row)
-- ================================================

-- ============================================
-- PART 1: INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_campaigns_h_media_id ON campaigns (h_media_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_v_media_id ON campaigns (v_media_id);
CREATE INDEX IF NOT EXISTS idx_generation_requests_user_id ON generation_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads (user_id);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_user_id ON pairing_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_partner_codes_terminal_id ON partner_codes (terminal_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_campaign_id ON partner_commissions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_code_id ON partner_commissions (partner_code_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_playlist_id ON playback_logs (playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_slots_media_id ON playlist_slots (media_id);
CREATE INDEX IF NOT EXISTS idx_screen_alerts_terminal_id ON screen_alerts (terminal_id);
CREATE INDEX IF NOT EXISTS idx_terminal_groups_owner_id ON terminal_groups (owner_id);
CREATE INDEX IF NOT EXISTS idx_terminals_active_playlist ON terminals (active_playlist_id);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users (referred_by);

-- ============================================
-- PART 2: FIX RLS INITPLAN
-- auth.uid() → (select auth.uid()) para performance
-- ============================================

-- users table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users" ON users FOR DELETE USING ((select public.is_admin()));

-- terminals table
DROP POLICY IF EXISTS "Users see own terminals" ON terminals;
CREATE POLICY "Users see own terminals" ON terminals FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Anonymous terminals read self" ON terminals;
CREATE POLICY "Anonymous terminals read self" ON terminals FOR SELECT TO anon USING (
  hardware_id = (select current_setting('request.headers', true)::json->>'x-hardware-id')
);

DROP POLICY IF EXISTS "Authenticated can register terminals" ON terminals;
CREATE POLICY "Authenticated can register terminals" ON terminals FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

-- media table
DROP POLICY IF EXISTS "Users see own media" ON media;
CREATE POLICY "Users see own media" ON media FOR SELECT USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own media" ON media;
CREATE POLICY "Users can manage own media" ON media FOR ALL USING (owner_id = (select auth.uid()));

-- advertisers table
DROP POLICY IF EXISTS "Users see own advertisers" ON advertisers;
CREATE POLICY "Users see own advertisers" ON advertisers FOR SELECT USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own advertisers" ON advertisers;
CREATE POLICY "Users can manage own advertisers" ON advertisers FOR ALL USING (owner_id = (select auth.uid()));

-- campaigns table
DROP POLICY IF EXISTS "Users see own campaigns" ON campaigns;
CREATE POLICY "Users see own campaigns" ON campaigns FOR SELECT USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert campaigns" ON campaigns;
CREATE POLICY "Users can insert campaigns" ON campaigns FOR INSERT WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
CREATE POLICY "Users can update own campaigns" ON campaigns FOR UPDATE USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;
CREATE POLICY "Users can delete own campaigns" ON campaigns FOR DELETE USING (owner_id = (select auth.uid()));

-- playlists table
DROP POLICY IF EXISTS "Users see own playlists" ON playlists;
CREATE POLICY "Users see own playlists" ON playlists FOR SELECT USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own playlists" ON playlists;
CREATE POLICY "Users can manage own playlists" ON playlists FOR ALL USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Terminals can read assigned playlists" ON playlists;
CREATE POLICY "Terminals can read assigned playlists" ON playlists FOR SELECT USING (
  id IN (SELECT active_playlist_id FROM terminals WHERE hardware_id = (select current_setting('request.headers', true)::json->>'x-hardware-id'))
);

-- playlist_slots table
DROP POLICY IF EXISTS "Users can view slots of own playlists" ON playlist_slots;
CREATE POLICY "Users can view slots of own playlists" ON playlist_slots FOR SELECT USING (
  playlist_id IN (SELECT id FROM playlists WHERE owner_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can manage slots of own playlists" ON playlist_slots;
CREATE POLICY "Users can manage slots of own playlists" ON playlist_slots FOR ALL USING (
  playlist_id IN (SELECT id FROM playlists WHERE owner_id = (select auth.uid()))
);

-- playback_logs table
DROP POLICY IF EXISTS "Users see own terminal POE" ON playback_logs;
CREATE POLICY "Users see own terminal POE" ON playback_logs FOR SELECT USING (
  terminal_id IN (SELECT id FROM terminals WHERE owner_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Authenticated can insert POE" ON playback_logs;
CREATE POLICY "Authenticated can insert POE" ON playback_logs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

-- terminal_logs table
DROP POLICY IF EXISTS "Users see own terminal logs" ON terminal_logs;
CREATE POLICY "Users see own terminal logs" ON terminal_logs FOR SELECT USING (
  terminal_id IN (SELECT id FROM terminals WHERE owner_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Authenticated can insert logs" ON terminal_logs;
CREATE POLICY "Authenticated can insert logs" ON terminal_logs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

-- transactions table
DROP POLICY IF EXISTS "Users see own transactions" ON transactions;
CREATE POLICY "Users see own transactions" ON transactions FOR SELECT USING (user_id = (select auth.uid()));

-- credit_transactions table
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all transactions" ON credit_transactions;
CREATE POLICY "Admins can manage all transactions" ON credit_transactions FOR ALL USING ((select public.is_admin()));

-- terminal_groups table
DROP POLICY IF EXISTS "Users see own groups" ON terminal_groups;
CREATE POLICY "Users see own groups" ON terminal_groups FOR SELECT USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users create groups" ON terminal_groups;
CREATE POLICY "Users create groups" ON terminal_groups FOR INSERT WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own groups" ON terminal_groups;
CREATE POLICY "Users update own groups" ON terminal_groups FOR UPDATE USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own groups" ON terminal_groups;
CREATE POLICY "Users delete own groups" ON terminal_groups FOR DELETE USING (owner_id = (select auth.uid()));

-- screen_alerts table
DROP POLICY IF EXISTS "Users see own alerts" ON screen_alerts;
CREATE POLICY "Users see own alerts" ON screen_alerts FOR SELECT USING (
  terminal_id IN (SELECT id FROM terminals WHERE owner_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Users update own alerts" ON screen_alerts;
CREATE POLICY "Users update own alerts" ON screen_alerts FOR UPDATE USING (
  terminal_id IN (SELECT id FROM terminals WHERE owner_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Authenticated can create alerts" ON screen_alerts;
CREATE POLICY "Authenticated can create alerts" ON screen_alerts FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

-- generation_requests table
DROP POLICY IF EXISTS "Users see own requests" ON generation_requests;
CREATE POLICY "Users see own requests" ON generation_requests FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own requests" ON generation_requests;
CREATE POLICY "Users update own requests" ON generation_requests FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert generation_requests" ON generation_requests;
CREATE POLICY "Users can insert generation_requests" ON generation_requests FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- pairing_codes table
DROP POLICY IF EXISTS "Users see own pairing codes" ON pairing_codes;
CREATE POLICY "Users see own pairing codes" ON pairing_codes FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users create pairing codes" ON pairing_codes;
CREATE POLICY "Users create pairing codes" ON pairing_codes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own codes" ON pairing_codes;
CREATE POLICY "Users update own codes" ON pairing_codes FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own codes" ON pairing_codes;
CREATE POLICY "Users delete own codes" ON pairing_codes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- referrals table
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals" ON referrals FOR SELECT USING (
  referrer_id = (select auth.uid()) OR referred_id = (select auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage all referrals" ON referrals;
CREATE POLICY "Admins can manage all referrals" ON referrals FOR ALL USING ((select public.is_admin()));

-- partner_codes table (uses partner_id, not owner_id)
DROP POLICY IF EXISTS "partner_codes_admin" ON partner_codes;
CREATE POLICY "partner_codes_admin" ON partner_codes FOR ALL USING ((select public.is_admin()));

DROP POLICY IF EXISTS "partner_codes_own" ON partner_codes;
CREATE POLICY "partner_codes_own" ON partner_codes FOR ALL USING (partner_id = (select auth.uid()));

DROP POLICY IF EXISTS "partner_codes_validate" ON partner_codes;
CREATE POLICY "partner_codes_validate" ON partner_codes FOR SELECT USING (is_active = true);

-- partner_commissions table (uses partner_id)
DROP POLICY IF EXISTS "partner_commissions_admin" ON partner_commissions;
CREATE POLICY "partner_commissions_admin" ON partner_commissions FOR ALL USING ((select public.is_admin()));

DROP POLICY IF EXISTS "partner_commissions_own" ON partner_commissions;
CREATE POLICY "partner_commissions_own" ON partner_commissions FOR SELECT USING (
  partner_code_id IN (SELECT id FROM partner_codes WHERE partner_id = (select auth.uid()))
);
