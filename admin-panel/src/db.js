/**
 * Database Compatibility Layer
 * 
 * DEPRECATED: Este arquivo agora é um re-export de supabase.js
 * Todas as funções foram movidas para supabase.js como fonte única de verdade.
 * Novos imports devem usar: import { ... } from './supabase'
 */

export {
    supabase,
    db,
    fetchCollection,
    getDocument,
    createDocument,
    updateDocument,
    deleteDocument,
    subscribeToCollection,
    subscribeToDocument,
    uploadFile,
    deleteFile,
    getPublicUrl,
    batchWrite,
} from './supabase';
