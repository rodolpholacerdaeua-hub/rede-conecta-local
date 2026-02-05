/**
 * useSupabaseRealtime Hook
 * Padrões de otimização Context7 para Supabase Realtime
 * 
 * Benefícios:
 * - Prevenção de race conditions (ignore flag)
 * - Canais únicos por usuário (reduz conflitos)
 * - Filtros no servidor (reduz tráfego de rede)
 * - Cleanup automático (evita memory leaks)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';

/**
 * Hook genérico para dados com Supabase Realtime
 * @param {string} table - Nome da tabela
 * @param {Function} fetchFn - Função async que retorna { data, error }
 * @param {Object} options - Opções de configuração
 * @param {string} options.userId - ID do usuário para filtro
 * @param {string} options.filterColumn - Coluna para filtro (default: 'owner_id')
 * @param {Array} options.deps - Dependências do useEffect
 */
export function useSupabaseRealtime(table, fetchFn, options = {}) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const ignoreRef = useRef(false);

    const {
        userId = null,
        filterColumn = 'owner_id',
        deps = []
    } = options;

    const fetchData = useCallback(async () => {
        if (ignoreRef.current) return;

        try {
            setLoading(true);
            const result = await fetchFn();

            if (ignoreRef.current) return;

            if (result.error) {
                console.error(`[Realtime] ${table} fetch error:`, result.error);
                setError(result.error);
                setData([]);
            } else {
                setData(result.data || []);
                setError(null);
            }
        } catch (err) {
            if (!ignoreRef.current) {
                console.error(`[Realtime] ${table} error:`, err);
                setError(err);
                setData([]);
            }
        } finally {
            if (!ignoreRef.current) {
                setLoading(false);
            }
        }
    }, [table, fetchFn]);

    useEffect(() => {
        ignoreRef.current = false;

        // Fetch inicial
        fetchData();

        // Configurar Realtime subscription
        const channelName = userId
            ? `${table}-${userId}`
            : `${table}-all`;

        const channelConfig = {
            event: '*',
            schema: 'public',
            table: table
        };

        // Adicionar filtro se userId fornecido
        if (userId && filterColumn) {
            channelConfig.filter = `${filterColumn}=eq.${userId}`;
        }

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', channelConfig, (payload) => {
                if (!ignoreRef.current) {
                    console.log(`[Realtime] ${table} ${payload.eventType}`);
                    fetchData();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[Realtime] Subscribed to ${table}`);
                }
            });

        // Cleanup
        return () => {
            ignoreRef.current = true;
            supabase.removeChannel(channel);
        };
    }, [table, userId, filterColumn, fetchData, ...deps]);

    // Função para forçar refresh
    const refresh = useCallback(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refresh };
}

/**
 * Hook simplificado para lista de terminais
 */
export function useTerminalsRealtime(userId) {
    const [terminals, setTerminals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;

        const fetch = async () => {
            const { data, error } = await supabase
                .from('terminals')
                .select('*')
                .eq('owner_id', userId)
                .order('name');

            if (!ignore && !error) {
                setTerminals(data || []);
            }
            if (!ignore) setLoading(false);
        };

        if (userId) {
            fetch();

            const channel = supabase
                .channel(`terminals-${userId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'terminals',
                    filter: `owner_id=eq.${userId}`
                }, () => {
                    if (!ignore) fetch();
                })
                .subscribe();

            return () => {
                ignore = true;
                supabase.removeChannel(channel);
            };
        }
    }, [userId]);

    return { terminals, loading };
}

export default useSupabaseRealtime;
