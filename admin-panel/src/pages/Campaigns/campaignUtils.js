/**
 * Campaign Utilities — Pricing, cost calculation, and global propagation
 */
import { supabase } from '../../supabase';

export const AI_CREATION_COST = 50;

// Sistema de Créditos - Plano Start
// 1 crédito = R$ 1,00
export const SLOT_PRICES = {
    1: { base: 150, discount: 0, final: 150 },     // Sem desconto
    2: { base: 300, discount: 0.10, final: 270 },  // 10% desconto
    3: { base: 450, discount: 0.15, final: 382 },  // 15% desconto
};

// Calcula o custo final baseado na quantidade de slots
export const calculateCampaignCost = (slotsCount) => {
    const pricing = SLOT_PRICES[slotsCount] || SLOT_PRICES[1];
    return pricing.final;
};

// Taxa de alteração de campanha dentro da vigência
export const EDIT_FEE = 35;

/**
 * Propagação de campanhas globais.
 * Quando uma campanha global é aprovada, atualiza o slot 'global'
 * de todas as playlists que têm orientação compatível com a mídia.
 */
export const propagateGlobalCampaign = async (campData) => {
    try {
        // 1. Determinar mídia (vertical-only)
        const mediaId = campData.v_media_id || campData.h_media_id;
        if (!mediaId) {
            console.warn('[GLOBAL] Campanha sem mídia definida');
            return { success: false, message: 'Campanha sem mídia' };
        }

        // 2. Buscar a orientação da mídia
        const { data: mediaData, error: mediaError } = await supabase
            .from('media')
            .select('id, orientation, name, url, type, duration')
            .eq('id', mediaId)
            .single();

        if (mediaError || !mediaData) {
            console.error('[GLOBAL] Erro ao buscar mídia:', mediaError);
            return { success: false, message: 'Mídia não encontrada' };
        }

        console.log(`[GLOBAL] 📡 Propagando campanha global: "${campData.name}"`);
        console.log(`[GLOBAL] Mídia: ${mediaData.name} (${mediaData.orientation})`);

        // 3. Buscar todas as playlists
        const { data: playlists, error: playlistError } = await supabase
            .from('playlists')
            .select('id, name');

        if (playlistError) {
            console.error('[GLOBAL] Erro ao buscar playlists:', playlistError);
            return { success: false, message: 'Erro ao buscar playlists' };
        }

        // 4. Para cada playlist, atualizar o slot 'global' (índice 0)
        let updatedCount = 0;
        for (const playlist of playlists) {
            const { data: existingSlot } = await supabase
                .from('playlist_slots')
                .select('id')
                .eq('playlist_id', playlist.id)
                .eq('slot_index', 0)
                .single();

            if (existingSlot) {
                const { error: updateError } = await supabase
                    .from('playlist_slots')
                    .update({
                        media_id: mediaId,
                        duration: mediaData.duration || 10
                    })
                    .eq('id', existingSlot.id);

                if (!updateError) updatedCount++;
            } else {
                const { error: insertError } = await supabase
                    .from('playlist_slots')
                    .insert({
                        playlist_id: playlist.id,
                        slot_index: 0,
                        slot_type: 'global',
                        media_id: mediaId,
                        duration: mediaData.duration || 10
                    });

                if (!insertError) updatedCount++;
            }
        }

        console.log(`[GLOBAL] ✅ Atualizado ${updatedCount} playlists com campanha global`);
        return { success: true, updatedCount };

    } catch (error) {
        console.error('[GLOBAL] Erro na propagação:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Propagação do Slot Coringa (Slot 7).
 * Atualiza a mídia do slot 7 (wildcard) em todas as playlists da rede.
 */
export const propagateWildcardContent = async (mediaId) => {
    try {
        const { data: mediaData, error: mediaError } = await supabase
            .from('media')
            .select('id, name, duration')
            .eq('id', mediaId)
            .single();

        if (mediaError || !mediaData) {
            return { success: false, message: 'Mídia não encontrada' };
        }

        console.log(`[WILDCARD] 📡 Propagando conteúdo coringa: "${mediaData.name}"`);

        const { data: playlists } = await supabase
            .from('playlists')
            .select('id');

        let updatedCount = 0;
        for (const playlist of (playlists || [])) {
            const { data: existingSlot } = await supabase
                .from('playlist_slots')
                .select('id')
                .eq('playlist_id', playlist.id)
                .eq('slot_index', 7)
                .single();

            if (existingSlot) {
                const { error } = await supabase
                    .from('playlist_slots')
                    .update({
                        media_id: mediaId,
                        duration: mediaData.duration || 20
                    })
                    .eq('id', existingSlot.id);
                if (!error) updatedCount++;
            } else {
                const { error } = await supabase
                    .from('playlist_slots')
                    .insert({
                        playlist_id: playlist.id,
                        slot_index: 7,
                        slot_type: 'wildcard',
                        media_id: mediaId,
                        duration: mediaData.duration || 20
                    });
                if (!error) updatedCount++;
            }
        }

        console.log(`[WILDCARD] ✅ Atualizado ${updatedCount} playlists com conteúdo coringa`);
        return { success: true, updatedCount };
    } catch (error) {
        console.error('[WILDCARD] Erro na propagação:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Alocação Inteligente de Campanha nos Slots Locais.
 * 
 * Ordem: 2→3→4→5→6 (pula 7=coringa) → 8→9→10→11→12
 * 
 * @param {string} campaignId - ID da campanha aprovada
 * @param {string} mediaId - ID da mídia da campanha
 * @param {string[]} terminalIds - IDs dos terminais alvo
 * @returns {{ success, allocations[], fullTerminals[] }}
 */
export const LOCAL_SLOT_ORDER = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

export const allocateCampaignToSlots = async (campaignId, mediaId, terminalIds) => {
    try {
        const { data: mediaData } = await supabase
            .from('media')
            .select('duration')
            .eq('id', mediaId)
            .single();

        const duration = mediaData?.duration || 15;
        const allocations = [];
        const fullTerminals = [];

        for (const terminalId of terminalIds) {
            // Buscar playlist do terminal
            const { data: terminal } = await supabase
                .from('terminals')
                .select('id, name, assigned_playlist_id')
                .eq('id', terminalId)
                .single();

            if (!terminal?.assigned_playlist_id) {
                console.warn(`[ALOCAÇÃO] Terminal ${terminalId} sem playlist vinculada`);
                continue;
            }

            // Buscar slots locais desta playlist
            const { data: slots } = await supabase
                .from('playlist_slots')
                .select('id, slot_index, media_id')
                .eq('playlist_id', terminal.assigned_playlist_id)
                .in('slot_type', ['local'])
                .order('slot_index', { ascending: true });

            // Montar mapa de ocupação
            const occupiedIndexes = new Set(
                (slots || []).filter(s => s.media_id).map(s => s.slot_index)
            );

            // Encontrar primeiro slot livre na ordem definida
            let allocated = false;
            for (const targetIndex of LOCAL_SLOT_ORDER) {
                if (!occupiedIndexes.has(targetIndex)) {
                    // Verificar se o slot existe
                    const existingSlot = (slots || []).find(s => s.slot_index === targetIndex);

                    if (existingSlot) {
                        await supabase
                            .from('playlist_slots')
                            .update({
                                media_id: mediaId,
                                campaign_id: campaignId,
                                duration
                            })
                            .eq('id', existingSlot.id);
                    } else {
                        await supabase
                            .from('playlist_slots')
                            .insert({
                                playlist_id: terminal.assigned_playlist_id,
                                slot_index: targetIndex,
                                slot_type: 'local',
                                media_id: mediaId,
                                campaign_id: campaignId,
                                duration
                            });
                    }

                    allocations.push({
                        terminalId,
                        terminalName: terminal.name,
                        slotIndex: targetIndex,
                        playlistId: terminal.assigned_playlist_id
                    });

                    console.log(`[ALOCAÇÃO] ✅ Campanha alocada no slot ${targetIndex} do terminal "${terminal.name}"`);
                    allocated = true;
                    break;
                }
            }

            if (!allocated) {
                fullTerminals.push({ terminalId, terminalName: terminal.name });
                console.warn(`[ALOCAÇÃO] ⚠️ Terminal "${terminal.name}" com todos os 10 slots locais ocupados`);
            }
        }

        return { success: true, allocations, fullTerminals };
    } catch (error) {
        console.error('[ALOCAÇÃO] Erro:', error);
        return { success: false, message: error.message, allocations: [], fullTerminals: [] };
    }
};
