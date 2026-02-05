/**
 * Supabase Client Configuration
 * Rede Conecta DOOH - Shared configuration
 * 
 * INSTRUÇÕES:
 * 1. Crie um projeto no Supabase (https://supabase.com)
 * 2. Copie as credenciais do projeto
 * 3. Substitua os valores abaixo
 */

import { createClient } from '@supabase/supabase-js';

// ================================================
// CONFIGURAÇÃO DO SUPABASE
// ================================================
const SUPABASE_URL = 'https://tmohttbxrdpxtfjjlkkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtb2h0dGJ4cmRweHRmampsa2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDk4MTEsImV4cCI6MjA4NTYyNTgxMX0.0G6oBHWZ7pftGzQW4Xg43EWi0_6yUeha9scEX2alW0Y';

// ================================================
// CLIENTE SUPABASE
// ================================================
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

// ================================================
// HELPERS DE AUTENTICAÇÃO
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
 * Login anônimo (para terminais)
 */
export async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();
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
 * Listener de mudanças de auth
 */
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

// ================================================
// HELPERS DE DATABASE
// ================================================

/**
 * Buscar terminal por hardware_id
 */
export async function getTerminalByHardwareId(hardwareId) {
    const { data, error } = await supabase
        .from('terminals')
        .select('*')
        .eq('hardware_id', hardwareId)
        .single();
    return { data, error };
}

/**
 * Atualizar status do terminal
 */
export async function updateTerminalStatus(terminalId, status) {
    const { data, error } = await supabase
        .from('terminals')
        .update({
            status,
            last_seen: new Date().toISOString()
        })
        .eq('id', terminalId);
    return { data, error };
}

/**
 * Registrar log de playback (POE)
 */
export async function logPlayback(logData) {
    const { data, error } = await supabase
        .from('playback_logs')
        .insert({
            terminal_id: logData.terminalId,
            media_id: logData.mediaId,
            playlist_id: logData.playlistId,
            media_name: logData.mediaName,
            media_url: logData.mediaUrl,
            slot_index: logData.slotIndex,
            slot_type: logData.slotType,
            duration_played: logData.durationPlayed,
            completed: logData.completed ?? true,
            app_version: logData.appVersion
        });
    return { data, error };
}

/**
 * Buscar playlist completa com slots e mídia
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
 * Subscrever a mudanças no terminal (realtime)
 */
export function subscribeToTerminal(terminalId, callback) {
    return supabase
        .channel(`terminal:${terminalId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'terminals',
                filter: `id=eq.${terminalId}`
            },
            callback
        )
        .subscribe();
}

/**
 * Subscrever a mudanças na playlist (realtime)
 */
export function subscribeToPlaylist(playlistId, callback) {
    return supabase
        .channel(`playlist:${playlistId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'playlists',
                filter: `id=eq.${playlistId}`
            },
            callback
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'playlist_slots',
                filter: `playlist_id=eq.${playlistId}`
            },
            callback
        )
        .subscribe();
}

// ================================================
// HELPERS DE RELATÓRIO (POE)
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

export default supabase;
