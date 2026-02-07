/**
 * usePartnerData — Hook para carregar dados do parceiro
 * 
 * Carrega: códigos de afiliado, comissões, terminal, slots ocupados
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export function usePartnerData(userId) {
    const [partnerCodes, setPartnerCodes] = useState([]);
    const [commissions, setCommissions] = useState([]);
    const [terminal, setTerminal] = useState(null);
    const [occupiedSlots, setOccupiedSlots] = useState(0);
    const [totalLocalSlots] = useState(10);
    const [monthlyEarnings, setMonthlyEarnings] = useState(0);
    const [pendingPayout, setPendingPayout] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Buscar códigos do parceiro
            const { data: codes, error: codesErr } = await supabase
                .from('partner_codes')
                .select('*')
                .eq('partner_id', userId)
                .order('created_at', { ascending: false });

            if (codesErr) throw codesErr;
            setPartnerCodes(codes || []);

            // 2. Buscar terminal associado (via partner_codes)
            const terminalIds = (codes || [])
                .filter(c => c.terminal_id)
                .map(c => c.terminal_id);

            let terminalData = null;
            let slotsOccupied = 0;

            if (terminalIds.length > 0) {
                const { data: term } = await supabase
                    .from('terminals')
                    .select('id, name, status, last_seen, assigned_playlist_id, location, city')
                    .eq('id', terminalIds[0])
                    .single();

                terminalData = term;

                // 3. Buscar slots locais ocupados na playlist do terminal
                if (term?.assigned_playlist_id) {
                    const { data: slots } = await supabase
                        .from('playlist_slots')
                        .select('id, slot_index, slot_type, media_id')
                        .eq('playlist_id', term.assigned_playlist_id)
                        .eq('slot_type', 'local');

                    slotsOccupied = (slots || []).filter(s => s.media_id).length;
                }
            }

            setTerminal(terminalData);
            setOccupiedSlots(slotsOccupied);

            // 4. Buscar comissões
            const { data: comms, error: commsErr } = await supabase
                .from('partner_commissions')
                .select('*')
                .eq('partner_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (commsErr) throw commsErr;
            setCommissions(comms || []);

            // 5. Calcular ganhos do mês atual
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const thisMonthComms = (comms || []).filter(
                c => new Date(c.created_at) >= new Date(monthStart)
            );

            const earned = thisMonthComms
                .filter(c => c.status === 'approved' || c.status === 'paid')
                .reduce((sum, c) => sum + Number(c.commission || 0), 0);

            const pending = thisMonthComms
                .filter(c => c.status === 'pending')
                .reduce((sum, c) => sum + Number(c.commission || 0), 0);

            setMonthlyEarnings(earned);
            setPendingPayout(pending);

        } catch (err) {
            console.error('[usePartnerData] Erro:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        partnerCodes,
        commissions,
        terminal,
        occupiedSlots,
        totalLocalSlots,
        monthlyEarnings,
        pendingPayout,
        loading,
        error,
        refresh: fetchData
    };
}
