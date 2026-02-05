/**
 * Supabase Client - Player App
 * Rede Conecta DOOH
 */

import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const SUPABASE_URL = 'https://tmohttbxrdpxtfjjlkkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtb2h0dGJ4cmRweHRmampsa2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDk4MTEsImV4cCI6MjA4NTYyNTgxMX0.0G6oBHWZ7pftGzQW4Xg43EWi0_6yUeha9scEX2alW0Y';

// Cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: window.localStorage
    }
});

// ================================================
// AUTENTICAÇÃO ANÔNIMA (PARA TERMINAIS)
// ================================================

/**
 * Login anônimo para terminal
 */
export async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
        console.error('[Supabase] Erro ao autenticar:', error.message);
        throw error;
    }
    console.log('[Supabase] Autenticado anonimamente:', data.user?.id);
    return data;
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
        console.log('[Supabase] Auth event:', event);
        callback(event, session);
    });
}

// ================================================
// TERMINAIS
// ================================================

/**
 * Buscar terminal por hardware_id
 */
export async function getTerminalByHardwareId(hardwareId) {
    const { data, error } = await supabase
        .from('terminals')
        .select('*')
        .eq('hardware_id', hardwareId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Erro ao buscar terminal:', error);
    }
    return { data, error };
}

/**
 * Criar ou atualizar terminal (pareamento)
 */
export async function upsertTerminal(terminalData) {
    const { data, error } = await supabase
        .from('terminals')
        .upsert(terminalData, {
            onConflict: 'hardware_id',
            ignoreDuplicates: false
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Erro ao upsert terminal:', error);
    }
    return { data, error };
}

/**
 * Registrar código de pareamento na tabela pairing_codes
 */
export async function registerPairingCode(code, hardwareId) {
    const { data, error } = await supabase
        .from('pairing_codes')
        .upsert({
            code: code.toUpperCase(),
            hardware_id: hardwareId,
            status: 'pending',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }, {
            onConflict: 'code'
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Erro ao registrar pairing code:', error);
    }
    return { data, error };
}

/**
 * Verificar se o código foi pareado (polling)
 */
export async function checkPairingStatus(code) {
    const { data, error } = await supabase
        .from('pairing_codes')
        .select('*, terminal_id')
        .eq('code', code.toUpperCase())
        .single();

    if (error) {
        console.error('[Supabase] Erro ao verificar pairing status:', error);
        return { paired: false, terminalId: null };
    }

    return {
        paired: data?.status === 'paired' && data?.terminal_id,
        terminalId: data?.terminal_id
    };
}

/**
 * Atualizar status do terminal (heartbeat)
 */
export async function updateTerminalHeartbeat(terminalId, status = 'online', appVersion = null) {
    const updateData = {
        status,
        last_seen: new Date().toISOString()
    };

    if (appVersion) {
        updateData.app_version = appVersion;
    }

    const { error } = await supabase
        .from('terminals')
        .update(updateData)
        .eq('id', terminalId);

    if (error) {
        console.error('[Supabase] Erro ao atualizar heartbeat:', error);
    }
    return { error };
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
            (payload) => {
                console.log('[Supabase] Terminal update:', payload);
                callback(payload);
            }
        )
        .subscribe();
}

// ================================================
// PLAYLISTS
// ================================================

/**
 * Buscar playlist com slots e mídia
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

    if (error) {
        console.error('[Supabase] Erro ao buscar playlist:', error);
    }
    return { data, error };
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
                table: 'playlist_slots',
                filter: `playlist_id=eq.${playlistId}`
            },
            (payload) => {
                console.log('[Supabase] Playlist update:', payload);
                callback(payload);
            }
        )
        .subscribe();
}

// ================================================
// PLAYBACK LOGS (POE)
// ================================================

/**
 * Registrar log de playback (PoP Simplificado)
 * Apenas registra que a mídia foi exibida, sem garantias de duração
 */
export async function logPlayback(logData) {
    const { error } = await supabase
        .from('playback_logs')
        .insert({
            terminal_id: logData.terminalId,
            media_id: logData.mediaId || null,
            playlist_id: logData.playlistId || null,
            media_name: logData.mediaName,
            media_url: logData.mediaUrl,
            slot_index: logData.slotIndex,
            slot_type: logData.slotType,
            status: logData.status || 'played',
            app_version: logData.appVersion
        });

    if (error) {
        console.error('[Supabase] Erro ao registrar POE:', error);
    }
    return { error };
}

/**
 * Enviar logs em lote (batch) - Versão Simplificada
 */
export async function logPlaybackBatch(logs) {
    const { error } = await supabase
        .from('playback_logs')
        .insert(logs.map(log => ({
            terminal_id: log.terminalId,
            media_id: log.mediaId || null,
            playlist_id: log.playlistId || null,
            media_name: log.mediaName,
            media_url: log.mediaUrl,
            slot_index: log.slotIndex,
            slot_type: log.slotType,
            status: log.status || 'played',
            app_version: log.appVersion,
            played_at: log.playedAt || new Date().toISOString()
        })));

    if (error) {
        console.error('[Supabase] Erro ao enviar batch POE:', error);
    }
    return { error };
}

// ================================================
// TERMINAL LOGS (TELEMETRIA)
// ================================================

/**
 * Registrar log de sistema
 */
export async function logTerminalEvent(terminalId, level, message, metadata = null) {
    const { error } = await supabase
        .from('terminal_logs')
        .insert({
            terminal_id: terminalId,
            level,
            message,
            metadata
        });

    if (error) {
        console.error('[Supabase] Erro ao registrar log:', error);
    }
    return { error };
}

export default supabase;
