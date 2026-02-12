import React, { useState, useMemo } from 'react';
import {
    HelpCircle, BookOpen, Upload, BarChart3, CreditCard, RefreshCw,
    Users, Monitor, ChevronDown, ChevronRight, Search, MessageCircle,
    Tv, Zap, FileVideo, CheckCircle, AlertTriangle, Smartphone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AccordionItem = ({ icon: Icon, title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-slate-200/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-blue-200">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-5 bg-white hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-bold text-slate-800 text-left">{title}</span>
                </div>
                {isOpen
                    ? <ChevronDown className="w-5 h-5 text-slate-400" />
                    : <ChevronRight className="w-5 h-5 text-slate-400" />
                }
            </button>
            {isOpen && (
                <div className="px-5 pb-5 bg-slate-50/50 border-t border-slate-100">
                    <div className="pt-4 text-slate-600 text-sm leading-relaxed space-y-3">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

const StepCard = ({ number, title, description }) => (
    <div className="flex gap-4 items-start">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
            {number}
        </div>
        <div>
            <p className="font-bold text-slate-800">{title}</p>
            <p className="text-slate-500 text-sm mt-1">{description}</p>
        </div>
    </div>
);

const ClienteHelpContent = () => (
    <div className="space-y-4">
        <AccordionItem icon={Zap} title="Primeiros passos — Como começar a anunciar" defaultOpen={true}>
            <div className="space-y-4">
                <StepCard number={1} title="Faça upload da sua mídia" description="Vá em 'Minha Biblioteca' e clique em 'Upload'. Aceitamos vídeos (MP4, MOV) e imagens (JPG, PNG). Orientação vertical (9:16) é ideal para as telas." />
                <StepCard number={2} title="Crie uma campanha" description="Em 'Minhas Campanhas', clique em 'Nova Campanha'. Dê um nome, selecione seu vídeo e defina o período de exibição." />
                <StepCard number={3} title="Aguarde a aprovação" description="Sua campanha será revisada pela equipe. Após aprovação, ela vai automaticamente para as telas da rede!" />
                <StepCard number={4} title="Acompanhe os resultados" description="Em 'Relatórios', veja quantas vezes seu anúncio foi exibido em cada tela (Proof of Play)." />
            </div>
        </AccordionItem>

        <AccordionItem icon={FileVideo} title="Formatos de mídia aceitos">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="text-left py-2 font-bold text-slate-700">Tipo</th>
                            <th className="text-left py-2 font-bold text-slate-700">Formatos</th>
                            <th className="text-left py-2 font-bold text-slate-700">Recomendação</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-600">
                        <tr className="border-b border-slate-50">
                            <td className="py-2">📹 Vídeo</td>
                            <td>MP4, MOV, AVI, MKV</td>
                            <td>Vertical 9:16, até 16s</td>
                        </tr>
                        <tr>
                            <td className="py-2">🖼️ Imagem</td>
                            <td>JPG, PNG, WebP</td>
                            <td>1080x1920px</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p className="text-slate-500 mt-2">
                <strong>Dica:</strong> Vídeos são automaticamente convertidos para o formato ideal. Não se preocupe com o codec!
            </p>
        </AccordionItem>

        <AccordionItem icon={RefreshCw} title="Como trocar a mídia de uma campanha ativa">
            <p>Se sua campanha já está no ar e você quer trocar o vídeo ou imagem:</p>
            <div className="space-y-3 mt-2">
                <StepCard number={1} title="Acesse 'Minhas Campanhas'" description="Encontre a campanha que deseja alterar." />
                <StepCard number={2} title="Clique em 'Trocar Mídia'" description="Use o botão de troca rápida (ícone de setas) na campanha." />
                <StepCard number={3} title="Selecione a nova mídia" description="Escolha da biblioteca ou faça um novo upload. A troca é instantânea!" />
            </div>
        </AccordionItem>

        <AccordionItem icon={CreditCard} title="Como funcionam os créditos">
            <p><strong>1 crédito = R$1,00</strong></p>
            <p className="mt-2">Cada exibição na rede consome uma quantidade de créditos baseada no plano contratado. Você pode:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Comprar créditos pelo painel (seção Financeiro)</li>
                <li>Ver seu saldo atual no topo da tela</li>
                <li>Acompanhar o consumo em "Relatórios"</li>
            </ul>
        </AccordionItem>

        <AccordionItem icon={BarChart3} title="Proof of Play — Relatórios de exibição">
            <p>O <strong>Proof of Play</strong> é seu comprovante de que o anúncio foi realmente exibido. Cada vez que seu vídeo/imagem aparece em uma tela, registramos:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
                <li><strong>Data e hora</strong> da exibição</li>
                <li><strong>Qual tela</strong> exibiu</li>
                <li><strong>Duração</strong> da exibição</li>
                <li><strong>Local</strong> do estabelecimento</li>
            </ul>
            <p className="mt-2 text-blue-600 font-semibold">Em breve: relatório em PDF para enviar ao seu cliente!</p>
        </AccordionItem>
    </div>
);

const ParceiroHelpContent = () => (
    <div className="space-y-4">
        <AccordionItem icon={Users} title="Como funciona o programa de parceiros" defaultOpen={true}>
            <p>Como parceiro, você instala e gerencia terminais em estabelecimentos. Cada exibição de campanha nos seus terminais gera comissão pra você.</p>
            <div className="bg-blue-50 rounded-xl p-4 mt-3 border border-blue-100">
                <p className="font-bold text-blue-800">💰 Modelo de receita</p>
                <p className="text-blue-700 text-sm mt-1">
                    Anunciante paga → Créditos consumidos → Sua comissão é calculada automaticamente por terminal.
                </p>
            </div>
        </AccordionItem>

        <AccordionItem icon={Monitor} title="Como instalar um terminal">
            <div className="space-y-3">
                <StepCard number={1} title="Prepare o hardware" description="PC com Windows 10+, conexão com internet e uma TV/monitor na orientação vertical." />
                <StepCard number={2} title="Instale o Player" description="Baixe o instalador do Conecta Local Player e execute no PC. O código de pareamento aparecerá na tela." />
                <StepCard number={3} title="Pareie no painel" description="No painel admin, vá em 'Telas (Players)' e digite o código que aparece na tela do terminal." />
                <StepCard number={4} title="Configure a playlist" description="Vincule uma playlist ao terminal. Pronto! O conteúdo começa a ser exibido automaticamente." />
            </div>
        </AccordionItem>

        <AccordionItem icon={CreditCard} title="Comissões e financeiro">
            <p>Acompanhe seus ganhos na seção <strong>Financeiro</strong>:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Comissão por terminal</li>
                <li>Receita acumulada no mês</li>
                <li>Histórico de pagamentos</li>
            </ul>
        </AccordionItem>

        <AccordionItem icon={AlertTriangle} title="O que fazer se um terminal ficar offline">
            <p>Se um terminal parar de responder:</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
                <li><strong>Verifique a internet</strong> — O terminal precisa de conexão estável</li>
                <li><strong>Reinicie o PC</strong> — O player reinicia automaticamente com o Windows</li>
                <li><strong>Verifique no painel</strong> — O status aparece em tempo real em "Telas"</li>
                <li><strong>Contate o suporte</strong> — Se o problema persistir</li>
            </ol>
        </AccordionItem>
    </div>
);

const FAQContent = () => (
    <div className="space-y-4">
        <AccordionItem icon={HelpCircle} title="Perguntas Frequentes (FAQ)">
            <div className="space-y-4">
                <div>
                    <p className="font-bold text-slate-800">Meu vídeo precisa estar em formato vertical?</p>
                    <p className="text-slate-500 mt-1">Recomendamos fortemente 9:16 (vertical), mas aceitamos outros formatos. O player ajusta automaticamente.</p>
                </div>
                <hr className="border-slate-100" />
                <div>
                    <p className="font-bold text-slate-800">Quanto tempo leva para minha campanha ir ao ar?</p>
                    <p className="text-slate-500 mt-1">Após aprovação, em até 5 minutos seu conteúdo já estará exibindo nos terminais.</p>
                </div>
                <hr className="border-slate-100" />
                <div>
                    <p className="font-bold text-slate-800">Posso pausar minha campanha?</p>
                    <p className="text-slate-500 mt-1">Sim! Em "Minhas Campanhas", use o botão de pausa. Seus créditos deixam de ser consumidos enquanto a campanha estiver pausada.</p>
                </div>
                <hr className="border-slate-100" />
                <div>
                    <p className="font-bold text-slate-800">O que acontece se a internet do terminal cair?</p>
                    <p className="text-slate-500 mt-1">O player funciona offline! Todos os vídeos ficam em cache local. Quando a internet voltar, os relatórios são sincronizados automaticamente.</p>
                </div>
                <hr className="border-slate-100" />
                <div>
                    <p className="font-bold text-slate-800">O player atualiza sozinho?</p>
                    <p className="text-slate-500 mt-1">Sim! As atualizações são automáticas e silenciosas. Não é necessária nenhuma ação manual.</p>
                </div>
            </div>
        </AccordionItem>
    </div>
);

const HelpCenter = () => {
    const { userData } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const isAdmin = userData?.role === 'admin';
    const isParceiro = userData?.role === 'parceiro';

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 p-8 md:p-12 text-white">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-20 w-48 h-48 bg-cyan-300 rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Central de Ajuda</h1>
                            <p className="text-blue-200 text-sm font-medium">Conecta Local — Tudo que você precisa saber</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative mt-6 max-w-lg">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar ajuda... ex: 'como criar campanha'"
                            className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-blue-200 focus:ring-2 focus:ring-white/30 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { icon: Upload, label: 'Upload de Mídia', color: 'bg-emerald-50 text-emerald-600' },
                    { icon: Tv, label: 'Criar Campanha', color: 'bg-blue-50 text-blue-600' },
                    { icon: BarChart3, label: 'Ver Relatórios', color: 'bg-amber-50 text-amber-600' },
                    { icon: Smartphone, label: 'Instalar Player', color: 'bg-cyan-50 text-cyan-600' },
                ].map((item) => (
                    <div
                        key={item.label}
                        className="bg-white rounded-2xl p-4 border border-slate-200/60 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
                    >
                        <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                            <item.icon className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="space-y-6">
                {/* Role-specific content */}
                {isAdmin ? (
                    <>
                        <h2 className="text-xl font-black text-slate-800">Guia do Administrador</h2>
                        <ClienteHelpContent />
                        <h2 className="text-xl font-black text-slate-800 mt-8">Guia do Parceiro</h2>
                        <ParceiroHelpContent />
                    </>
                ) : isParceiro ? (
                    <ParceiroHelpContent />
                ) : (
                    <ClienteHelpContent />
                )}

                {/* FAQ - always show */}
                <FAQContent />
            </div>

            {/* Footer */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60 text-center">
                <MessageCircle className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 mb-1">Ainda precisa de ajuda?</h3>
                <p className="text-slate-500 text-sm">
                    Entre em contato com nosso suporte técnico. Estamos prontos para te ajudar!
                </p>
            </div>
        </div>
    );
};

export default HelpCenter;
