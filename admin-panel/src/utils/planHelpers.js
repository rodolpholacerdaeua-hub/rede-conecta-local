// ============================================
// HELPERS DE PLANOS E ASSINATURAS
// ============================================

// Definição dos planos disponíveis
export const PLANS = {
    start: {
        id: 'start',
        name: 'Start',
        displayName: 'Plano Start',
        quota: 1,
        price: 99.90,
        validityDays: 30, // Período de veiculação das campanhas
        features: [
            '1 tela de exibição ativa',
            '1 upload de vídeo/mês (renovável)',
            'Campanhas com 30 dias de veiculação',
            'Relatórios Proof-of-Play (POP)',
            'Monitoramento Operacional Live'
        ]
    },
    business: {
        id: 'business',
        name: 'Business',
        displayName: 'Plano Business',
        quota: 3,
        price: 249.90,
        validityDays: 60, // Período de veiculação das campanhas
        features: [
            '3 telas de exibição',
            'Upload de mídias ilimitado',
            'Campanhas com 60 dias de veiculação',
            'Suporte prioritário',
            'Relatórios avançados',
            'Agendamento de campanhas'
        ]
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        displayName: 'Plano Premium',
        quota: 5,
        price: 399.90,
        validityDays: 90, // Período de veiculação das campanhas
        features: [
            '5 telas de exibição',
            'Upload de mídias ilimitado',
            'Campanhas com 90 dias de veiculação',
            'Suporte 24/7',
            'Relatórios completos',
            'Agendamento de campanhas',
            'Analytics em tempo real'
        ]
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        displayName: 'Plano Enterprise',
        quota: 10,
        price: 699.90,
        validityDays: 180, // Período de veiculação das campanhas
        features: [
            '10 telas de exibição',
            'Upload de mídias ilimitado',
            'Campanhas com 180 dias de veiculação',
            'Suporte dedicado 24/7',
            'Relatórios personalizados',
            'Agendamento avançado',
            'Analytics em tempo real',
            'API de integração',
            'White-label'
        ]
    },
    unlimited: {
        id: 'unlimited',
        name: 'Unlimited',
        displayName: 'Rede Ilimitada',
        quota: Infinity,
        price: 0,
        validityDays: 365, // Admin/unlimited = 1 ano
        features: [
            'Telas ilimitadas',
            'Campanhas com 365 dias de veiculação',
            'Todos os recursos',
            'Apenas para administradores'
        ]
    }
};

/**
 * Retorna a quota de telas de um plano
 * @param {string} plan - ID do plano
 * @returns {number} Número de telas permitidas
 */
export function getPlanQuota(plan) {
    return PLANS[plan]?.quota || 1;
}

/**
 * Retorna o período de veiculação de campanhas do plano (em dias)
 * @param {string} plan - ID do plano
 * @returns {number} Dias de veiculação
 */
export function getPlanValidityDays(plan) {
    return PLANS[plan]?.validityDays || 30;
}

/**
 * Retorna a quota efetiva considerando o role do usuário
 * Admin sempre tem acesso ilimitado independente do plano
 * @param {object} userData - Dados do usuário (com role e plan)
 * @returns {number} Número de telas permitidas (Infinity para admin)
 */
export function getEffectivePlanQuota(userData) {
    if (!userData) return 1;

    // Admin sempre tem quota ilimitada
    if (userData.role === 'admin') {
        return Infinity;
    }

    return PLANS[userData.plan]?.quota || 1;
}

/**
 * Verifica se o usuário é admin (helper para uso em componentes)
 * @param {object} userData - Dados do usuário
 * @returns {boolean} True se for admin
 */
export function isAdmin(userData) {
    return userData?.role === 'admin';
}

/**
 * Retorna o nome formatado de um plano
 * @param {string} plan - ID do plano
 * @returns {string} Nome do plano
 */
export function getPlanName(plan) {
    return PLANS[plan]?.displayName || 'Plano Start';
}

/**
 * Retorna o preço mensal de um plano
 * @param {string} plan - ID do plano
 * @returns {number} Preço em reais
 */
export function getPlanPrice(plan) {
    return PLANS[plan]?.price || 0;
}

/**
 * Retorna as features de um plano
 * @param {string} plan - ID do plano
 * @returns {string[]} Lista de features
 */
export function getPlanFeatures(plan) {
    return PLANS[plan]?.features || [];
}

/**
 * Verifica se um plano está vencido
 * @param {Date|Timestamp} planExpiresAt - Data de vencimento
 * @returns {boolean} True se vencido
 */
export function isPlanExpired(planExpiresAt) {
    const expirationDate = toDate(planExpiresAt);
    if (!expirationDate) return false;
    return expirationDate < new Date();
}

/**
 * Converte um valor (Date, Timestamp ou string) para um objeto Date real com segurança
Original-Line-Number: 132-142
 */
function toDate(val) {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Retorna quantos dias faltam para o plano vencer
 * @param {Date|Timestamp} planExpiresAt - Data de vencimento
 * @returns {number} Dias restantes (negativo se vencido)
 */
export function getDaysUntilExpiration(planExpiresAt) {
    const expirationDate = toDate(planExpiresAt);
    if (!expirationDate) return 30; // Default para 30 dias se não houver data

    try {
        const today = new Date();
        const diffTime = expirationDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return isNaN(diffDays) ? 30 : diffDays;
    } catch (e) {
        return 30;
    }
}

/**
 * Formata a data de vencimento para exibição
 * @param {Date|Timestamp} planExpiresAt - Data de vencimento
 * @returns {string} Data formatada
 */
export function formatExpirationDate(planExpiresAt) {
    const expirationDate = toDate(planExpiresAt);
    if (!expirationDate) return 'Sem vencimento';

    try {
        return expirationDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return 'Data inválida';
    }
}

/**
 * Retorna o status do plano (ativo, vencido, próximo do vencimento)
 * @param {Date|Timestamp} planExpiresAt - Data de vencimento
 * @returns {object} Status com tipo e mensagem
 */
export function getPlanStatus(planExpiresAt) {
    try {
        const daysLeft = getDaysUntilExpiration(planExpiresAt);

        if (daysLeft < 0) {
            return {
                type: 'expired',
                label: 'Vencido',
                color: 'red',
                message: `Seu plano venceu há ${Math.abs(daysLeft)} dia(s)`
            };
        }

        if (daysLeft <= 7) {
            return {
                type: 'expiring',
                label: 'Vence em breve',
                color: 'amber',
                message: `Seu plano vence em ${daysLeft} dia(s)`
            };
        }

        return {
            type: 'active',
            label: 'Ativo',
            color: 'green',
            message: `Seu plano está ativo por mais ${daysLeft} dia(s)`
        };
    } catch (e) {
        return {
            type: 'active',
            label: 'Ativo',
            color: 'green',
            message: 'Plano em processamento'
        };
    }
}

/**
 * Calcula quantas telas estão sendo usadas atualmente
 * @param {Array} campaigns - Lista de campanhas
 * @returns {number} Total de telas ocupadas
 */
export function calculateUsedScreens(campaigns) {
    if (!Array.isArray(campaigns)) return 0;
    return campaigns
        .filter(c => c && c.moderation_status === 'approved')
        .reduce((acc, c) => acc + (Number(c.screensQuota) || 0), 0);
}

/**
 * Verifica se o usuário pode criar uma nova campanha
 * @param {object} userData - Dados do usuário
 * @param {Array} campaigns - Campanhas existentes do usuário
 * @param {number} newCampaignScreens - Telas da nova campanha
 * @returns {object} Resultado com can (boolean) e reason (string)
 */
export function canCreateCampaign(userData, campaigns, newCampaignScreens = 1) {
    if (!userData) return { can: false, reason: 'Carregando perfil do usuário...' };

    // Admin e unlimited sempre podem
    if (userData.role === 'admin' || userData.plan === 'unlimited') {
        return { can: true, reason: '' };
    }

    // Verificar se plano está vencido
    if (isPlanExpired(userData.planExpiresAt)) {
        return {
            can: false,
            reason: 'Seu plano está vencido! Renove para continuar criando campanhas.'
        };
    }

    // Calcular uso atual
    const usedScreens = calculateUsedScreens(campaigns);
    const planQuota = getPlanQuota(userData.plan);
    const totalAfterNew = usedScreens + newCampaignScreens;

    // Verificar se vai exceder quota
    if (totalAfterNew > planQuota) {
        return {
            can: false,
            reason: `Você atingiu o limite do seu plano (${planQuota} tela(s)). Atualmente usando ${usedScreens} tela(s). Faça upgrade para continuar!`
        };
    }

    return { can: true, reason: '' };
}

/**
 * Verifica se o usuário pode criar um novo terminal/player
 * @param {object} userData - Dados do usuário
 * @param {number} currentTerminalsCount - Quantidade atual de terminais ativos
 * @returns {object} Resultado com can (boolean) e reason (string)
 */
export function canCreateTerminal(userData, currentTerminalsCount) {
    if (!userData) return { can: false, reason: 'Carregando perfil...' };

    if (userData.role === 'admin' || userData.plan === 'unlimited') {
        return { can: true, reason: '' };
    }

    if (isPlanExpired(userData.planExpiresAt)) {
        return {
            can: false,
            reason: 'Seu plano está vencido! Renove para adicionar novos pontos.'
        };
    }

    const planQuota = getPlanQuota(userData.plan);

    if (currentTerminalsCount >= planQuota) {
        return {
            can: false,
            reason: `Limite de telas atingido (${planQuota}). Faça upgrade do seu plano para expandir a rede.`
        };
    }

    return { can: true, reason: '' };
}

/**
 * Retorna a data de vencimento padrão (30 dias a partir de agora)
 * @returns {Date} Data de vencimento
 */
export function getDefaultExpirationDate() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
}

/**
 * Estende o plano por N dias
 * @param {Date|Timestamp} currentExpiration - Vencimento atual
 * @param {number} days - Dias para adicionar
 * @returns {Date} Nova data de vencimento
 */
export function extendPlan(currentExpiration, days = 30) {
    const current = currentExpiration?.toDate ? currentExpiration.toDate() : new Date(currentExpiration);
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

/**
 * Compara dois planos e retorna se é upgrade ou downgrade
 * @param {string} currentPlan - Plano atual
 * @param {string} newPlan - Novo plano
 * @returns {string} 'upgrade', 'downgrade' ou 'same'
 */
export function comparePlans(currentPlan, newPlan) {
    const planOrder = ['start', 'business', 'premium', 'enterprise', 'unlimited'];
    const currentIndex = planOrder.indexOf(currentPlan);
    const newIndex = planOrder.indexOf(newPlan);

    if (currentIndex === newIndex) return 'same';
    return newIndex > currentIndex ? 'upgrade' : 'downgrade';
}
