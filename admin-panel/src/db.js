/**
 * Database Compatibility Layer
 * Permite migração gradual de Firebase para Supabase
 * 
 * As páginas podem continuar usando 'db' e queries similares
 * enquanto migramos internamente para Supabase
 */

import { supabase } from './supabase';

// ================================================
// COLLECTION MAPPER (Firebase → Supabase)
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

// ================================================
// QUERY HELPERS
// ================================================

/**
 * Listar todos os documentos de uma collection com filtros
 */
export async function fetchCollection(collectionName, options = {}) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;

    let query = supabase.from(tableName).select(options.select || '*');

    // Aplicar filtros where
    if (options.where) {
        for (const [field, op, value] of options.where) {
            if (op === '==') {
                query = query.eq(field, value);
            } else if (op === '!=') {
                query = query.neq(field, value);
            } else if (op === '>') {
                query = query.gt(field, value);
            } else if (op === '>=') {
                query = query.gte(field, value);
            } else if (op === '<') {
                query = query.lt(field, value);
            } else if (op === '<=') {
                query = query.lte(field, value);
            } else if (op === 'in') {
                query = query.in(field, value);
            }
        }
    }

    // Ordenação
    if (options.orderBy) {
        const [field, direction = 'asc'] = options.orderBy;
        query = query.order(field, { ascending: direction === 'asc' });
    }

    // Limite
    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
}

/**
 * Buscar documento por ID
 */
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

/**
 * Criar documento
 */
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

/**
 * Atualizar documento
 */
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

/**
 * Deletar documento
 */
export async function deleteDocument(collectionName, docId) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;

    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', docId);

    if (error) throw error;
    return true;
}

/**
 * Subscription realtime para collection
 */
export function subscribeToCollection(collectionName, options = {}, callback) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;

    let filter = undefined;
    if (options.where && options.where.length > 0) {
        const [field, op, value] = options.where[0];
        if (op === '==') {
            filter = `${field}=eq.${value}`;
        }
    }

    const channel = supabase
        .channel(`${tableName}-changes-${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: tableName,
                filter
            },
            async (payload) => {
                // Após mudança, refetch completo
                try {
                    const data = await fetchCollection(collectionName, options);
                    callback(data);
                } catch (err) {
                    console.error('Subscription refetch error:', err);
                }
            }
        )
        .subscribe();

    // Fetch inicial
    fetchCollection(collectionName, options).then(callback).catch(console.error);

    // Retorna função de unsubscribe
    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Subscription realtime para documento único
 */
export function subscribeToDocument(collectionName, docId, callback) {
    const tableName = COLLECTION_MAP[collectionName] || collectionName;

    const channel = supabase
        .channel(`${tableName}-${docId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: tableName,
                filter: `id=eq.${docId}`
            },
            (payload) => {
                callback(payload.new);
            }
        )
        .subscribe();

    // Fetch inicial
    getDocument(collectionName, docId).then(callback).catch(console.error);

    return () => {
        supabase.removeChannel(channel);
    };
}

// ================================================
// STORAGE HELPERS
// ================================================

/**
 * Upload de arquivo (com transcodificação automática de vídeo H.265→H.264)
 */
export async function uploadFile(path, file, options = {}) {
    let fileToUpload = file;

    // Transcodificar vídeo se necessário (H.265 → H.264)
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
                // Atualizar o path se extensão mudou
                if (!path.endsWith('.mp4')) {
                    path = path.replace(/\.[^.]+$/, '.mp4');
                }
            }
        } catch (err) {
            console.warn('[Upload] Transcodificação falhou, enviando original:', err.message);
            // Continuar com arquivo original se a transcodificação falhar
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

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(path);

    return { path: data.path, url: publicUrl };
}

/**
 * Deletar arquivo
 */
export async function deleteFile(path) {
    const { error } = await supabase.storage
        .from('media')
        .remove([path]);

    if (error) throw error;
    return true;
}

/**
 * Obter URL pública
 */
export function getPublicUrl(path) {
    const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(path);
    return publicUrl;
}

// ================================================
// BATCH OPERATIONS
// ================================================

/**
 * Operação em lote com tratamento de falha parcial
 * Executa todas as operações em paralelo e reporta falhas
 * @throws {Error} Se qualquer operação falhar (inclui detalhes de todas as falhas)
 */
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

// Export supabase para uso direto quando necessário
export { supabase };

// Alias para compatibilidade
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
