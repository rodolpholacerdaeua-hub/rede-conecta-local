import React, { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

const TOUR_STYLES = {
    options: {
        arrowColor: '#1e293b',
        backgroundColor: '#1e293b',
        overlayColor: 'rgba(0, 0, 0, 0.7)',
        textColor: '#e2e8f0',
        primaryColor: '#3b82f6',
        zIndex: 10000,
    },
    buttonNext: {
        backgroundColor: '#3b82f6',
        borderRadius: '12px',
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 700,
    },
    buttonBack: {
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: 600,
    },
    buttonSkip: {
        color: '#64748b',
        fontSize: '13px',
    },
    tooltip: {
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
    },
    tooltipTitle: {
        fontSize: '18px',
        fontWeight: 800,
        marginBottom: '8px',
    },
    tooltipContent: {
        fontSize: '14px',
        lineHeight: '1.6',
    },
};

const CLIENTE_STEPS = [
    {
        target: 'body',
        placement: 'center',
        title: '🎉 Bem-vindo ao Conecta Local!',
        content: 'Vamos fazer um tour rápido pelo painel para você começar a anunciar em poucos minutos.',
        disableBeacon: true,
    },
    {
        target: '[data-tour="menu-dashboard"]',
        title: '📊 Seu Dashboard',
        content: 'Aqui você acompanha tudo: créditos, campanhas ativas e o desempenho das suas exibições.',
        disableBeacon: true,
    },
    {
        target: '[data-tour="menu-biblioteca"]',
        title: '📁 Biblioteca de Mídia',
        content: 'Faça upload dos seus vídeos aqui. Aceitamos vídeos verticais (9:16) de até 16 segundos.',
        disableBeacon: true,
    },
    {
        target: '[data-tour="menu-campanhas"]',
        title: '📢 Suas Campanhas',
        content: 'Crie campanhas, vincule mídias e acompanhe a moderação. Após aprovação, seu anúncio vai pro ar!',
        disableBeacon: true,
    },
    {
        target: '[data-tour="menu-relatorios"]',
        title: '📈 Relatórios de Exibição',
        content: 'Acompanhe quantas vezes seu anúncio foi exibido (Proof of Play). Transparência total!',
        disableBeacon: true,
    },
    {
        target: '[data-tour="credits-display"]',
        title: '💰 Seus Créditos',
        content: 'Cada crédito vale R$1. Adquira créditos para ativar campanhas. O saldo aparece sempre aqui em cima.',
        disableBeacon: true,
    },
];

const PARCEIRO_STEPS = [
    {
        target: 'body',
        placement: 'center',
        title: '🤝 Bem-vindo, Parceiro!',
        content: 'Vamos conhecer o painel de parceiro. Aqui você acompanha seus ganhos e gerencia seus terminais.',
        disableBeacon: true,
    },
    {
        target: '[data-tour="menu-dashboard"]',
        title: '📊 Seu Dashboard',
        content: 'Visão geral: seu código de afiliado, comissões acumuladas e terminais vinculados.',
        disableBeacon: true,
    },
    {
        target: '[data-tour="menu-campanhas"]',
        title: '📢 Campanhas',
        content: 'Veja as campanhas ativas nos terminais da sua rede. Cada exibição gera comissão pra você!',
        disableBeacon: true,
    },
    {
        target: '[data-tour="menu-financeiro"]',
        title: '💰 Financeiro',
        content: 'Acompanhe suas comissões, receita por terminal e histórico de pagamentos.',
        disableBeacon: true,
    },
];

const OnboardingTour = () => {
    const { userData } = useAuth();
    const [run, setRun] = useState(false);
    const [steps, setSteps] = useState([]);

    useEffect(() => {
        if (!userData) return;

        // Não rodar se já completou ou se for admin
        if (userData.onboarding_completed || userData.role === 'admin') return;

        // Selecionar steps por role
        const roleSteps = userData.role === 'parceiro' ? PARCEIRO_STEPS : CLIENTE_STEPS;
        setSteps(roleSteps);

        // Pequeno delay para garantir que os elementos do menu renderizaram
        const timer = setTimeout(() => setRun(true), 1000);
        return () => clearTimeout(timer);
    }, [userData?.id, userData?.onboarding_completed, userData?.role]);

    const handleCallback = async (data) => {
        const { status } = data;
        const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);

            // Marcar onboarding como concluído no Supabase
            try {
                await supabase
                    .from('users')
                    .update({ onboarding_completed: true })
                    .eq('id', userData.id);
                console.log('✅ Onboarding concluído!');
            } catch (err) {
                console.error('Erro ao salvar onboarding:', err);
            }
        }
    };

    if (!run || steps.length === 0) return null;

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showSkipButton
            showProgress
            disableOverlayClose
            callback={handleCallback}
            styles={TOUR_STYLES}
            locale={{
                back: 'Voltar',
                close: 'Fechar',
                last: 'Finalizar',
                next: 'Próximo',
                skip: 'Pular tour',
                open: 'Abrir',
            }}
            floaterProps={{
                disableAnimation: false,
            }}
        />
    );
};

export default OnboardingTour;
