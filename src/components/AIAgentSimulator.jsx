import React, { useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';

/**
 * AIAgentSimulator - Background component that mocks the AI Video Generation process.
 * In a real production environment, this would be a Cloud Function or a microservice.
 */
const AIAgentSimulator = () => {
    useEffect(() => {
        // Listen for pending generation requests
        const q = query(collection(db, "generation_requests"), where("status", "==", "pending"));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            snapshot.docs.forEach(async (requestDoc) => {
                const request = requestDoc.data();
                const photoCount = request.referencePhotos?.length || 0;
                console.log(`🤖 IA Agent: Recebido novo pedido: ${request.campaignName} (${photoCount} fotos de ref)`);

                // 1. Marcar como "Em processamento"
                const isRefinement = request.type === 'refinement';
                console.log(`🤖 IA Agent: ${isRefinement ? 'Refinando' : 'Criando'} campanha: ${request.campaignName}`);

                await updateDoc(doc(db, "generation_requests", requestDoc.id), {
                    status: 'processing',
                    progress: 10
                });

                // Simular tempo de renderização (IA trabalhando...)
                setTimeout(async () => {
                    console.log("🤖 IA Agent: Renderizando formatos V/H...");
                    await updateDoc(doc(db, "generation_requests", requestDoc.id), { progress: 60 });

                    setTimeout(async () => {
                        // 2. Criar as mídias no banco (mockando o upload do bucket)
                        // Usaremos as imagens geradas como "Vídeos" para o teste
                        const hMediaRef = await addDoc(collection(db, "media"), {
                            name: `AI_GEN_H_${request.campaignName}`,
                            url: '/mock-ads/burger_king_ad_h.png',
                            type: 'image',
                            orientation: 'horizontal',
                            createdAt: new Date(),
                            isAIGenerated: true
                        });

                        const vMediaRef = await addDoc(collection(db, "media"), {
                            name: `AI_GEN_V_${request.campaignName}`,
                            url: '/mock-ads/burger_king_ad_v.png',
                            type: 'image',
                            orientation: 'vertical',
                            createdAt: new Date(),
                            isAIGenerated: true
                        });

                        // 3. Vincular à campanha e remover o flag de placeholder
                        await updateDoc(doc(db, "campaigns", request.campaignId), {
                            name: request.campaignName, // Remove o "(Gerando...)"
                            hMediaId: hMediaRef.id,
                            vMediaId: vMediaRef.id,
                            isAIGenerating: false,
                            ai_creation_fee: 49.90
                        });

                        // 3.5 Registrar COBRANÇA no Financeiro (MaaS Billing)
                        // Apenas se for criação nova, refinamento pode ser cortesia ou taxa menor
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

                        // 4. Finalizar o pedido
                        await updateDoc(doc(db, "generation_requests", requestDoc.id), {
                            status: 'completed',
                            progress: 100,
                            completedAt: new Date()
                        });

                        console.log(`🤖 IA Agent: ${isRefinement ? 'Ajuste entregue' : 'Campanha entregue'} com sucesso!`);
                    }, 5000);
                }, 3000);
            });
        });

        return () => unsubscribe();
    }, []);

    return null; // Componente invisível
};

export default AIAgentSimulator;
