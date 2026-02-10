import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Error Boundary para captar erros de renderização e prevenir crash total
 * Útil durante a migração Firebase → Supabase
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Erro capturado:', error, errorInfo);
        Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
        this.setState({ error, errorInfo });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            const isFirebaseError = this.state.error?.message?.includes('Firebase') ||
                this.state.error?.message?.includes('permission') ||
                this.state.error?.code?.includes('permission');

            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="bg-white rounded-2xl border border-amber-200 shadow-lg p-8 max-w-lg w-full text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-amber-600" />
                        </div>

                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            {isFirebaseError ? '🔄 Migração em Andamento' : 'Erro Temporário'}
                        </h2>

                        <p className="text-slate-500 text-sm mb-6">
                            {isFirebaseError
                                ? 'Esta página está sendo migrada para o novo sistema. Alguns recursos podem estar temporariamente indisponíveis.'
                                : 'Ocorreu um erro ao carregar esta página. Por favor, tente novamente.'
                            }
                        </p>

                        {this.state.error && (
                            <div className="bg-slate-50 rounded-lg p-3 mb-6 text-left">
                                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Detalhes Técnicos</p>
                                <p className="text-xs font-mono text-red-600 break-all">
                                    {this.state.error.message || 'Erro desconhecido'}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tentar Novamente
                            </button>
                            <a
                                href="/"
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Voltar ao Dashboard
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
