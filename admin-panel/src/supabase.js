/**
 * Supabase Client - Admin Panel
 * Rede Conecta DOOH
 */

import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase via variáveis de ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação de configuração
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('⚠️ Variáveis de ambiente do Supabase não configuradas!');
}

// Cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: window.localStorage
    }
});


// ================================================
// AUTENTICAÇÃO
// ================================================

/**
 * Login com email e senha
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    return { data, error };
}

/**
 * Registro de novo usuário
 */
export async function signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata
        }
    });
    return { data, error };
}

/**
 * Logout
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Obter usuário atual
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * Obter sessão atual
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Listener de mudanças de auth
 */
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

/**
 * Enviar email de recuperação de senha
 */
export async function resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
    });
    return { data, error };
}

/**
 * Atualizar senha do usuário (usado após clicar no link do email)
 */
export async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword
    });
    return { data, error };
}

// ================================================
// USUÁRIOS
// ================================================

/**
 * Buscar perfil do usuário
 */
export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
}

/**
 * Atualizar perfil do usuário
 */
export async function updateUserProfile(userId, updates) {
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    return { data, error };
}

// ================================================
// TERMINAIS
// ================================================

/**
 * Listar terminais do usuário
 */
export async function listTerminals(ownerId = null) {
    let query = supabase
        .from('terminals')
        .select('*')
        .order('created_at', { ascending: false });

    if (ownerId) {
        query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    return { data, error };
}

/**
 * Buscar terminal por ID
 */
export async function getTerminal(terminalId) {
    const { data, error } = await supabase
        .from('terminals')
        .select('*')
        .eq('id', terminalId)
        .single();
    return { data, error };
}

/**
 * Criar terminal
 */
export async function createTerminal(terminalData) {
    const { data, error } = await supabase
        .from('terminals')
        .insert(terminalData)
        .select()
        .single();
    return { data, error };
}

/**
 * Atualizar terminal
 */
export async function updateTerminal(terminalId, updates) {
    const { data, error } = await supabase
        .from('terminals')
        .update(updates)
        .eq('id', terminalId)
        .select()
        .single();
    return { data, error };
}

/**
 * Deletar terminal
 */
export async function deleteTerminal(terminalId) {
    const { error } = await supabase
        .from('terminals')
        .delete()
        .eq('id', terminalId);
    return { error };
}

/**
 * Parear terminal por código
 */
export async function pairTerminalByCode(pairingCode, ownerId, name) {
    const { data, error } = await supabase
        .from('terminals')
        .update({
            owner_id: ownerId,
            name: name,
            status: 'online'
        })
        .eq('pairing_code', pairingCode)
        .is('owner_id', null)
        .select()
        .single();
    return { data, error };
}

// ================================================
// MÍDIA
// ================================================

/**
 * Listar mídia do usuário (RLS filtra automaticamente por auth.uid())
 */
export async function listMedia(ownerId = null) {
    let query = supabase
        .from('media')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

    // Filtro manual apenas se passado (para admins que podem ver tudo)
    if (ownerId) {
        query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    return { data, error };
}

/**
 * Criar registro de mídia
 */
export async function createMedia(mediaData) {
    const { data, error } = await supabase
        .from('media')
        .insert(mediaData)
        .select()
        .single();
    return { data, error };
}

/**
 * Upload de arquivo para Storage
 */
export async function uploadMediaFile(file, path) {
    const { data, error } = await supabase.storage
        .from('media')
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) return { data: null, error };

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(path);

    return { data: { path: data.path, url: publicUrl }, error: null };
}

/**
 * Deletar mídia
 */
export async function deleteMedia(mediaId) {
    const { error } = await supabase
        .from('media')
        .update({ status: 'deleted' })
        .eq('id', mediaId);
    return { error };
}

// ================================================
// PLAYLISTS
// ================================================

/**
 * Buscar playlist com slots
 */
export async function getPlaylistWithSlots(playlistId) {
    const { data, error } = await supabase
        .from('playlists')
        .select(`
      *,
      playlist_slots (
        *,
        media (*)
      )
    `)
        .eq('id', playlistId)
        .single();
    return { data, error };
}

/**
 * Listar todas as playlists
 */
export async function listPlaylists(ownerId = null) {
    let query = supabase
        .from('playlists')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

    if (ownerId) {
        query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    return { data, error };
}

/**
 * Criar playlist
 */
export async function createPlaylist(playlistData) {
    const { data, error } = await supabase
        .from('playlists')
        .insert(playlistData)
        .select()
        .single();
    return { data, error };
}

/**
 * Atualizar playlist
 */
export async function updatePlaylist(playlistId, updates) {
    const { data, error } = await supabase
        .from('playlists')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', playlistId)
        .select()
        .single();
    return { data, error };
}

/**
 * Deletar playlist (soft delete)
 */
export async function deletePlaylist(playlistId) {
    const { data, error } = await supabase
        .from('playlists')
        .update({ status: 'deleted' })
        .eq('id', playlistId);
    return { data, error };
}

/**
 * Atualizar slot da playlist
 */
export async function updatePlaylistSlot(slotId, updates) {
    const { data, error } = await supabase
        .from('playlist_slots')
        .update(updates)
        .eq('id', slotId)
        .select()
        .single();
    return { data, error };
}

/**
 * Criar ou atualizar slot
 */
export async function upsertPlaylistSlot(slotData) {
    const { data, error } = await supabase
        .from('playlist_slots')
        .upsert(slotData, { onConflict: 'playlist_id,slot_index' })
        .select()
        .single();
    return { data, error };
}

// ================================================
// CAMPANHAS
// ================================================

/**
 * Listar campanhas do usuário
 */
export async function listCampaigns(ownerId) {
    const { data, error } = await supabase
        .from('campaigns')
        .select(`
      *,
      advertiser:advertisers(name)
    `)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });
    return { data, error };
}

/**
 * Criar campanha
 */
export async function createCampaign(campaignData) {
    const { data, error } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single();
    return { data, error };
}

// ================================================
// ANUNCIANTES
// ================================================

/**
 * Listar anunciantes do usuário
 */
export async function listAdvertisers(ownerId) {
    const { data, error } = await supabase
        .from('advertisers')
        .select('*')
        .eq('owner_id', ownerId)
        .order('name');
    return { data, error };
}

/**
 * Criar anunciante
 */
export async function createAdvertiser(advertiserData) {
    const { data, error } = await supabase
        .from('advertisers')
        .insert(advertiserData)
        .select()
        .single();
    return { data, error };
}

// ================================================
// RELATÓRIOS POE
// ================================================

/**
 * Relatório de POE por terminal
 */
export async function getTerminalPOEReport(terminalId, startDate, endDate) {
    const { data, error } = await supabase
        .rpc('get_terminal_poe_report', {
            p_terminal_id: terminalId,
            p_start_date: startDate,
            p_end_date: endDate
        });
    return { data, error };
}

/**
 * Audiência por horário
 */
export async function getHourlyAudience(terminalId, days = 7) {
    const { data, error } = await supabase
        .rpc('get_hourly_audience', {
            p_terminal_id: terminalId,
            p_days: days
        });
    return { data, error };
}

/**
 * Dashboard stats do owner
 */
export async function getOwnerDashboardStats(ownerId) {
    const { data, error } = await supabase
        .rpc('get_owner_dashboard_stats', {
            p_owner_id: ownerId
        });
    return { data, error };
}

/**
 * Logs de playback recentes
 */
export async function getRecentPlaybackLogs(terminalId, limit = 50) {
    const { data, error } = await supabase
        .from('playback_logs')
        .select('*')
        .eq('terminal_id', terminalId)
        .order('played_at', { ascending: false })
        .limit(limit);
    return { data, error };
}

// ================================================
// REALTIME SUBSCRIPTIONS
// ================================================

/**
 * Subscrever a mudanças nos terminais
 */
export function subscribeToTerminals(ownerId, callback) {
    return supabase
        .channel('terminals-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'terminals',
                filter: `owner_id=eq.${ownerId}`
            },
            callback
        )
        .subscribe();
}

export default supabase;
