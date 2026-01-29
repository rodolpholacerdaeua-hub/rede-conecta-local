import React, { useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

/**
 * AIAgentSimulator - Background component that mocks the AI Video Generation process.
 * In a real production environment, this would be a Cloud Function or a microservice.
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

        const q = userData.role === 'admin'
            ? query(collection(db, "generation_requests"), where("status", "==", "pending"))
            : query(collection(db, "generation_requests"), where("ownerId", "==", currentUser.uid), where("status", "==", "pending"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docs.forEach((requestDoc) => {
                if (processingRequests.current.has(requestDoc.id)) return;

                const request = requestDoc.data();
                processingRequests.current.add(requestDoc.id);

                const processRequest = async () => {
                    const isRefinement = request.type === 'refinement';
                    console.log(`🤖 IA Agent: Iniciando ${isRefinement ? 'refinamento' : 'criação'}: ${request.campaignName}`);

                    try {
                        await updateDoc(doc(db, "generation_requests", requestDoc.id), {
                            status: 'processing',
                            progress: 10
                        });

                        const t1 = setTimeout(async () => {
                            try {
                                await updateDoc(doc(db, "generation_requests", requestDoc.id), { progress: 60 });

                                const t2 = setTimeout(async () => {
                                    try {
                                        const hMediaRef = await addDoc(collection(db, "media"), {
                                            name: `AI_GEN_H_${request.campaignName}`,
                                            url: '/mock-ads/burger_king_ad_h.png',
                                            type: 'image',
                                            orientation: 'horizontal',
                                            createdAt: new Date(),
                                            isAIGenerated: true,
                                            ownerId: request.ownerId || currentUser.uid
                                        });

                                        const vMediaRef = await addDoc(collection(db, "media"), {
                                            name: `AI_GEN_V_${request.campaignName}`,
                                            url: '/mock-ads/burger_king_ad_v.png',
                                            type: 'image',
                                            orientation: 'vertical',
                                            createdAt: new Date(),
                                            isAIGenerated: true,
                                            ownerId: request.ownerId || currentUser.uid
                                        });

                                        await updateDoc(doc(db, "campaigns", request.campaignId), {
                                            name: request.campaignName,
                                            hMediaId: hMediaRef.id,
                                            vMediaId: vMediaRef.id,
                                            isAIGenerating: false,
                                            ai_creation_fee: 49.90
                                        });

                                        if (!isRefinement) {
                                            await addDoc(collection(db, "billing"), {
                                                campaignId: request.campaignId,
                                                campaignName: request.campaignName,
                                                amount: 49.90,
                                                type: 'creation_fee',
                                                createdAt: new Date(),
                                                status: 'completed'
                                            });
                                        }

                                        await updateDoc(doc(db, "generation_requests", requestDoc.id), {
                                            status: 'completed',
                                            progress: 100,
                                            completedAt: new Date()
                                        });

                                        console.log(`🤖 IA Agent: Entregue - ${request.campaignName}`);
                                        processingRequests.current.delete(requestDoc.id);
                                    } catch (err) {
                                        console.error("IA Agent Error (Final):", err);
                                        processingRequests.current.delete(requestDoc.id);
                                    }
                                }, 5000);
                                timeouts.current.push(t2);
                            } catch (err) {
                                console.error("IA Agent Error (Progress):", err);
                                processingRequests.current.delete(requestDoc.id);
                            }
                        }, 3000);
                        timeouts.current.push(t1);

                    } catch (err) {
                        console.error("IA Agent Error (Start):", err);
                        processingRequests.current.delete(requestDoc.id);
                    }
                };

                processRequest();
            });
        }, (error) => {
            console.error("AIAgentSimulator: Erro ao monitorar pedidos:", error);
        });

        return () => {
            unsubscribe();
            clearAllTimeouts();
        };
    }, [currentUser?.uid, userData?.role]);

    return null;
};

export default AIAgentSimulator;
