/**
 * CampaignDetails — Preview modal + Refinement modal
 */
import React from 'react';
import { Eye, X, Sparkles, Wand2, AlertTriangle } from 'lucide-react';

const CampaignDetails = ({
    // Preview
    previewCamp, setPreviewCamp,
    mediaFiles,
    onApprove,
    onReject,

    // Refinement
    refiningCamp, setRefiningCamp,
    refinementText, setRefinementText,
    submitRefinement,
}) => {
    return (
        <>
            {/* Preview Modal */}
            {previewCamp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                                <Eye className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-xl font-black Outfit uppercase tracking-tight">Revisar Campanha: {previewCamp.name}</h3>
                            </div>
                            <button onClick={() => setPreviewCamp(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50">
                            {/* Vertical Preview */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Formato Vertical (9:16)</label>
                                <div className="aspect-[9/16] bg-black rounded-2xl overflow-hidden border-4 border-white shadow-xl flex items-center justify-center mx-auto max-h-[400px]">
                                    {mediaFiles.find(m => m.id === previewCamp.v_media_id) ? (
                                        mediaFiles.find(m => m.id === previewCamp.v_media_id).type === 'video' ? (
                                            <video src={mediaFiles.find(m => m.id === previewCamp.v_media_id).url} className="w-full h-full object-contain" controls />
                                        ) : (
                                            <img src={mediaFiles.find(m => m.id === previewCamp.v_media_id).url} className="w-full h-full object-contain" alt="V" />
                                        )
                                    ) : (
                                        <div className="text-slate-600 italic text-xs">Mídia vertical não definida</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-white border-t border-slate-100 flex justify-center space-x-4">
                            <button
                                onClick={() => { onReject(previewCamp); setPreviewCamp(null); }}
                                className="flex-1 max-w-[200px] px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black uppercase text-xs hover:bg-red-100 transition-all"
                            >
                                Rejeitar Conteúdo
                            </button>
                            <button
                                onClick={() => {
                                    console.log("🟢 [APROVAR] Abrindo modal de aprovação");
                                    setPreviewCamp(null);
                                    onApprove(previewCamp);
                                }}
                                className="flex-1 max-w-[200px] px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                            >
                                Aprovar e Publicar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Refinement Modal */}
            {refiningCamp && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-700 p-8 text-white relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                                <Sparkles className="w-24 h-24" />
                            </div>
                            <div className="flex items-center space-x-3 mb-2">
                                <Wand2 className="w-6 h-6 text-indigo-300" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] Outfit text-indigo-200">AI Design Refinement</span>
                            </div>
                            <h3 className="text-2xl font-black Outfit">Solicitar Ajuste</h3>
                            <p className="text-indigo-100/70 text-sm mt-1 font-medium italic">O que deseja mudar em "{refiningCamp.name}"?</p>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1">Feedback de Revisão</label>
                                <textarea
                                    value={refinementText}
                                    onChange={(e) => setRefinementText(e.target.value)}
                                    placeholder="Ex: Mude a cor da fonte para dourado e adicione um brilho no produto..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all resize-none h-40 shadow-inner"
                                    autoFocus
                                />
                            </div>

                            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 mt-1 flex-shrink-0" />
                                <p className="text-[11px] text-amber-700 font-bold leading-relaxed italic">
                                    Nota: Este pedido gerará nova mídia Vertical automaticamente baseada na versão anterior e no seu feedback atual.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setRefiningCamp(null)}
                                    className="flex-1 px-4 py-4 rounded-2xl text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all Outfit uppercase tracking-widest"
                                >
                                    Desistir
                                </button>
                                <button
                                    onClick={submitRefinement}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-indigo-600/20 transition-all transform hover:translate-y-[-2px] active:scale-95 Outfit uppercase tracking-[0.1em]"
                                >
                                    Enviar para IA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CampaignDetails;
