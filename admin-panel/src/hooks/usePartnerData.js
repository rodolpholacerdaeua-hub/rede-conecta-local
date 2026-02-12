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
    const [partnerSlot, setPartnerSlot] = useState(null);
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
            let pSlot = null;

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
                        .select('id, slot_index, slot_type, media_id, campaign_id')
                        .eq('playlist_id', term.assigned_playlist_id)
                        .eq('slot_type', 'local');

                    slotsOccupied = (slots || []).filter(s => s.media_id).length;

                    // ── Auto-generate Revenue Share for existing campaigns ──
                    // Slots locais com campaign_id → buscar custo → gerar comissão 20%
                    const occupiedSlots = (slots || []).filter(s => s.media_id && s.campaign_id);
                    if (occupiedSlots.length > 0 && codes?.[0]) {
                        const campaignIds = [...new Set(occupiedSlots.map(s => s.campaign_id).filter(Boolean))];

                        // Buscar comissões existentes para evitar duplicatas
                        const { data: existingComms } = await supabase
                            .from('partner_commissions')
                            .select('campaign_id')
                            .eq('partner_id', userId)
                            .eq('type', 'revenue_share')
                            .in('campaign_id', campaignIds);

                        const existingCampIds = new Set((existingComms || []).map(c => c.campaign_id));
                        const missingCampIds = campaignIds.filter(id => !existingCampIds.has(id));

                        if (missingCampIds.length > 0) {
                            // Buscar dados das campanhas faltantes
                            const { data: campData } = await supabase
                                .from('campaigns')
                                .select('id, credits_cost, target_terminals, moderation_status')
                                .in('id', missingCampIds)
                                .eq('moderation_status', 'approved');

                            const REVENUE_SHARE_PCT = 0.20;
                            const now = new Date();
                            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

                            for (const camp of (campData || [])) {
                                const termCount = (camp.target_terminals || []).length || 1;
                                const costPerSlot = Number(camp.credits_cost || 0) / termCount;
                                const commission = costPerSlot * REVENUE_SHARE_PCT;

                                if (commission > 0) {
                                    await supabase.from('partner_commissions').insert({
                                        partner_id: userId,
                                        campaign_id: camp.id,
                                        partner_code_id: codes[0].id,
                                        type: 'revenue_share',
                                        gross_amount: costPerSlot,
                                        net_amount: costPerSlot,
                                        commission: commission,
                                        status: 'pending',
                                        period_start: periodStart,
                                        period_end: periodEnd
                                    });
                                    console.log(`[RETROACTIVE] Revenue Share: R$${commission.toFixed(2)} for campaign ${camp.id}`);
                                }
                            }
                        }
                    }

                    // 4. Buscar slot do parceiro
                    const { data: partnerSlots } = await supabase
                        .from('playlist_slots')
                        .select('id, slot_index, slot_type, media_id, duration')
                        .eq('playlist_id', term.assigned_playlist_id)
                        .eq('slot_type', 'partner')
                        .limit(1);

                    const pSlotRaw = partnerSlots?.[0] || null;

                    // Se o slot tem mídia, buscar dados dela separadamente
                    if (pSlotRaw?.media_id) {
                        const { data: mediaData } = await supabase
                            .from('media')
                            .select('*')
                            .eq('id', pSlotRaw.media_id)
                            .single();

                        pSlot = { ...pSlotRaw, media: mediaData || null };
                    } else {
                        pSlot = pSlotRaw ? { ...pSlotRaw, media: null } : null;
                    }
                }
            }

            setTerminal(terminalData);
            setOccupiedSlots(slotsOccupied);
            setPartnerSlot(pSlot);

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
        partnerSlot,
        occupiedSlots,
        totalLocalSlots,
        monthlyEarnings,
        pendingPayout,
        loading,
        error,
        refresh: fetchData
    };
}
