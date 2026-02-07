import React, { useEffect } from 'react';
import { supabase } from '../supabase';
import { updateDocument, createDocument } from '../db';
import { useAuth } from '../contexts/AuthContext';

/**
 * AIAgentSimulator - Background component that mocks the AI Video Generation process.
 * In a real production environment, this would be an Edge Function or a microservice.
 */
const AIAgentSimulator = () => {
    const auth = useAuth();
    const processingRequests = React.useRef(new Set());
    const timeouts = React.useRef([]);

    // Safety check
    if (!auth) return null;

    const { currentUser, userData } = auth;

    useEffect(() => {
        if (!currentUser || !userData) return;

        // Limpar timeouts anteriores se o efeito rodar novamente
        const clearAllTimeouts = () => {
            timeouts.current.forEach(clearTimeout);
            timeouts.current = [];
        };

        const loadPendingRequests = async () => {
            try {
                let query = supabase
                    .from('generation_requests')
                    .select('*')
                    .eq('status', 'pending');

                if (userData.role !== 'admin') {
                    query = query.eq('owner_id', currentUser.id);
                }

                const { data, error } = await query;
                if (error) throw error;

                (data || []).forEach((request) => processRequest(request));
            } catch (error) {
                console.error("AIAgentSimulator: Erro ao carregar pedidos:", error);
            }
        };

        const processRequest = async (request) => {
            if (processingRequests.current.has(request.id)) return;
            processingRequests.current.add(request.id);

            const isRefinement = request.type === 'refinement';
            console.log(`🤖 IA Agent: Iniciando ${isRefinement ? 'refinamento' : 'criação'}: ${request.campaign_name}`);

            try {
                await updateDocument('generation_requests', request.id, {
                    status: 'processing',
                    progress: 10
                });

                const t1 = setTimeout(async () => {
                    try {
                        await updateDocument('generation_requests', request.id, { progress: 60 });

                        const t2 = setTimeout(async () => {
                            try {
                                // Sistema vertical-only: gerar apenas mídia vertical
                                const vMediaId = await createDocument('media', {
                                    name: `AI_GEN_V_${request.campaign_name}`,
                                    url: '/mock-ads/burger_king_ad_v.png',
                                    type: 'image',
                                    orientation: 'portrait',
                                    created_at: new Date().toISOString(),
                                    is_ai_generated: true,
                                    owner_id: request.owner_id || currentUser.id
                                });

                                await updateDocument('campaigns', request.campaign_id, {
                                    name: request.campaign_name,
                                    h_media_id: null,
                                    v_media_id: vMediaId,
                                    is_ai_generating: false,
                                    ai_creation_fee: 49.90
                                });

                                if (!isRefinement) {
                                    await createDocument('billing', {
                                        campaign_id: request.campaign_id,
                                        campaign_name: request.campaign_name,
                                        amount: 49.90,
                                        type: 'creation_fee',
                                        created_at: new Date().toISOString(),
                                        status: 'completed'
                                    });
                                }

                                await updateDocument('generation_requests', request.id, {
                                    status: 'completed',
                                    progress: 100,
                                    completed_at: new Date().toISOString()
                                });

                                console.log(`🤖 IA Agent: Entregue - ${request.campaign_name}`);
                                processingRequests.current.delete(request.id);
                            } catch (err) {
                                console.error("IA Agent Error (Final):", err);
                                processingRequests.current.delete(request.id);
                            }
                        }, 5000);
                        timeouts.current.push(t2);
                    } catch (err) {
                        console.error("IA Agent Error (Progress):", err);
                        processingRequests.current.delete(request.id);
                    }
                }, 3000);
                timeouts.current.push(t1);

            } catch (err) {
                console.error("IA Agent Error (Start):", err);
                processingRequests.current.delete(request.id);
            }
        };

        loadPendingRequests();

        // Subscribe to new pending requests
        const channel = supabase
            .channel('generation-requests-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'generation_requests' }, (payload) => {
                if (payload.new.status === 'pending') {
                    processRequest(payload.new);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearAllTimeouts();
        };
    }, [currentUser?.id, userData?.role]);

    return null;
};

export default AIAgentSimulator;
