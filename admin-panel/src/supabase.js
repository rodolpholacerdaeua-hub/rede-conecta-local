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

// ================================================
// GENERIC CRUD OPERATIONS
// (centralizado aqui para eliminar duplicação com db.js)
// ================================================

const COLLECTION_MAP = {
    'terminals': 'terminals',
    'users': 'users',
    'media': 'media',
    'playlists': 'playlists',
    'campaigns': 'campaigns',
    'advertisers': 'advertisers',
    'proof_of_play': 'playback_logs',
    'playback_logs': 'playback_logs',
    'terminal_logs': 'terminal_logs',
    'transactions': 'transactions',
    'playlist_slots': 'playlist_slots'
};

export async function fetchCollection(collectionName, options = {}) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;
    let query = supabase.from(tableName).select(options.select || '*');

    if (options.where) {
        for (const [field, op, value] of options.where) {
            if (op === '==') query = query.eq(field, value);
            else if (op === '!=') query = query.neq(field, value);
            else if (op === '>') query = query.gt(field, value);
            else if (op === '>=') query = query.gte(field, value);
            else if (op === '<') query = query.lt(field, value);
            else if (op === '<=') query = query.lte(field, value);
            else if (op === 'in') query = query.in(field, value);
        }
    }

    if (options.orderBy) {
        const [field, direction = 'asc'] = options.orderBy;
        query = query.order(field, { ascending: direction === 'asc' });
    }

    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function getDocument(collectionName, docId) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', docId)
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

export async function createDocument(collectionName, data) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;
    const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();
    if (error) throw error;
    return result;
}

export async function updateDocument(collectionName, docId, data) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;
    const { data: result, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', docId)
        .select()
        .single();
    if (error) throw error;
    return result;
}

export async function deleteDocument(collectionName, docId) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;
    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', docId);
    if (error) throw error;
    return true;
}

// ================================================
// GENERIC REALTIME SUBSCRIPTIONS
// ================================================

export function subscribeToCollection(collectionName, options = {}, callback) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;

    let filter = undefined;
    if (options.where && options.where.length > 0) {
        const [field, op, value] = options.where[0];
        if (op === '==') filter = `${field}=eq.${value}`;
    }

    const channel = supabase
        .channel(`${tableName}-changes-${Date.now()}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: tableName, filter
        }, async () => {
            try {
                const data = await fetchCollection(collectionName, options);
                callback(data);
            } catch (err) {
                console.error('Subscription refetch error:', err);
            }
        })
        .subscribe();

    fetchCollection(collectionName, options).then(callback).catch(console.error);

    return () => { supabase.removeChannel(channel); };
}

export function subscribeToDocument(collectionName, docId, callback) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;

    const channel = supabase
        .channel(`${tableName}-${docId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: tableName, filter: `id=eq.${docId}`
        }, (payload) => { callback(payload.new); })
        .subscribe();

    getDocument(collectionName, docId).then(callback).catch(console.error);

    return () => { supabase.removeChannel(channel); };
}

// ================================================
// STORAGE HELPERS
// ================================================

export async function uploadFile(path, file, options = {}) {
    let fileToUpload = file;

    if (file.type && file.type.startsWith('video/')) {
        try {
            const { processVideoFile } = await import('./utils/videoTranscoder.js');
            const result = await processVideoFile(
                file,
                options.onTranscodeProgress || null,
                options.onTranscodeStatus || null
            );
            fileToUpload = result.file;
            if (result.wasTranscoded) {
                console.log(`[Upload] Vídeo convertido de ${result.originalCodec} para H.264`);
                if (!path.endsWith('.mp4')) {
                    path = path.replace(/\.[^.]+$/, '.mp4');
                }
            }
        } catch (err) {
            console.warn('[Upload] Transcodificação falhou, enviando original:', err.message);
        }
    }

    const { data, error } = await supabase.storage
        .from('media')
        .upload(path, fileToUpload, {
            cacheControl: '3600',
            upsert: options.upsert || false,
            ...options
        });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(path);

    return { path: data.path, url: publicUrl };
}

export async function deleteFile(path) {
    const { error } = await supabase.storage
        .from('media')
        .remove([path]);
    if (error) throw error;
    return true;
}

export function getPublicUrl(path) {
    const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(path);
    return publicUrl;
}

// ================================================
// BATCH OPERATIONS
// ================================================

export async function batchWrite(operations) {
    const promises = operations.map(async (op, index) => {
        if (op.type === 'set' || op.type === 'update') {
            return updateDocument(op.collection, op.docId, op.data);
        } else if (op.type === 'delete') {
            await deleteDocument(op.collection, op.docId);
            return { deleted: true };
        } else if (op.type === 'create') {
            return createDocument(op.collection, op.data);
        }
        throw new Error(`Tipo de operação desconhecido: ${op.type} (índice ${index})`);
    });

    const results = await Promise.allSettled(promises);

    const failures = results
        .map((r, i) => r.status === 'rejected' ? { index: i, reason: r.reason?.message || r.reason } : null)
        .filter(Boolean);

    if (failures.length > 0) {
        const details = failures.map(f => `[op ${f.index}]: ${f.reason}`).join('; ');
        throw new Error(`batchWrite: ${failures.length}/${operations.length} operações falharam — ${details}`);
    }

    return results.map(r => r.value);
}

// ================================================
// FIREBASE-STYLE ADAPTER (backward compat)
// ================================================

export const db = {
    collection: (name) => ({
        doc: (id) => ({
            get: () => getDocument(name, id),
            set: (data) => createDocument(name, { id, ...data }),
            update: (data) => updateDocument(name, id, data),
            delete: () => deleteDocument(name, id),
            onSnapshot: (callback) => subscribeToDocument(name, id, callback)
        }),
        add: (data) => createDocument(name, data),
        where: (field, op, value) => ({
            _where: [[field, op, value]],
            where: function (f, o, v) { this._where.push([f, o, v]); return this; },
            orderBy: function (field, dir = 'asc') { this._orderBy = [field, dir]; return this; },
            limit: function (n) { this._limit = n; return this; },
            get: async function () {
                return fetchCollection(name, { where: this._where, orderBy: this._orderBy, limit: this._limit });
            },
            onSnapshot: function (callback) {
                return subscribeToCollection(name, { where: this._where, orderBy: this._orderBy, limit: this._limit }, callback);
            }
        }),
        orderBy: (field, dir = 'asc') => ({
            _orderBy: [field, dir],
            limit: function (n) { this._limit = n; return this; },
            get: async function () {
                return fetchCollection(name, { orderBy: this._orderBy, limit: this._limit });
            },
            onSnapshot: function (callback) {
                return subscribeToCollection(name, { orderBy: this._orderBy, limit: this._limit }, callback);
            }
        }),
        onSnapshot: (callback) => subscribeToCollection(name, {}, callback)
    })
};
