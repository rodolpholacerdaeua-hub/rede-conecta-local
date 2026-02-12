/**
 * PartnerAdPage — Página para o parceiro gerenciar seu anúncio
 * 
 * O parceiro tem 1 slot dedicado (tipo 'partner', index 1) na playlist
 * do terminal vinculado. Ele pode fazer upload/trocar tua mídia livremente.
 */
import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Film, RefreshCw, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePartnerData } from '../hooks/usePartnerData';

const MAX_VIDEO_DURATION_SECONDS = 16;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

const PartnerAdPage = () => {
    const { userData } = useAuth();
    const { terminal, partnerSlot, loading, refresh } = usePartnerData(userData?.id);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const fileInputRef = useRef(null);

    const currentMedia = partnerSlot?.media;
    const hasMedia = !!currentMedia;
    const playlistId = terminal?.assigned_playlist_id;

    // Validar duração do vídeo antes do upload
    const validateVideoDuration = (file) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                if (video.duration > MAX_VIDEO_DURATION_SECONDS) {
                    reject(new Error(`Vídeo tem ${Math.round(video.duration)}s — máximo permitido é ${MAX_VIDEO_DURATION_SECONDS}s`));
                } else {
                    resolve(video.duration);
                }
            };
            video.onerror = () => reject(new Error('Não foi possível ler o vídeo'));
            video.src = URL.createObjectURL(file);
        });
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setSuccess(null);

        // Validar tipo
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError('Formato não suportado. Use JPG, PNG, WebP, MP4 ou WebM.');
            return;
        }

        // Validar tamanho (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            setError('Arquivo muito grande. Máximo 50MB.');
            return;
        }

        const isVideo = file.type.startsWith('video/');

        try {
            setUploading(true);

            // Validar duração do vídeo
            let duration = 10; // default para imagem
            if (isVideo) {
                setUploadProgress('Verificando duração...');
                duration = await validateVideoDuration(file);
            }

            // Upload para Supabase Storage
            setUploadProgress('Enviando arquivo...');
            const ext = file.name.split('.').pop();
            const fileName = `partner-ad-${userData.id}-${Date.now()}.${ext}`;
            const storagePath = `media/${userData.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(storagePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Obter URL pública
            const { data: urlData } = supabase.storage
                .from('media')
                .getPublicUrl(storagePath);

            const publicUrl = urlData.publicUrl;

            // Criar registro na tabela media
            setUploadProgress('Registrando mídia...');
            const { data: newMedia, error: mediaError } = await supabase
                .from('media')
                .insert({
                    owner_id: userData.id,
                    name: `Anúncio ${userData.name || 'Parceiro'}`,
                    type: isVideo ? 'video' : 'image',
                    url: publicUrl,
                    storage_path: storagePath,
                    duration: Math.round(duration),
                    file_size: file.size,
                    orientation: 'portrait',
                    status: 'active'
                })
                .select()
                .single();

            if (mediaError) throw mediaError;

            // Atualizar o slot do parceiro com a nova mídia
            setUploadProgress('Vinculando ao seu slot...');

            if (!partnerSlot?.id) {
                throw new Error('Slot do parceiro não encontrado. Contate o administrador.');
            }

            const { error: slotError } = await supabase
                .from('playlist_slots')
                .update({
                    media_id: newMedia.id,
                    duration: Math.round(duration)
                })
                .eq('id', partnerSlot.id);

            if (slotError) throw slotError;

            // Remover mídia antiga do storage (se existia)
            if (currentMedia?.storage_path) {
                await supabase.storage.from('media').remove([currentMedia.storage_path]);
            }

            setSuccess(hasMedia ? 'Anúncio trocado com sucesso!' : 'Anúncio publicado com sucesso!');
            setUploadProgress('');
            refresh(); // Recarregar dados
        } catch (err) {
            console.error('[PartnerAd] Upload error:', err);
            setError(err.message || 'Erro ao enviar anúncio');
        } finally {
            setUploading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveAd = async () => {
        if (!partnerSlot?.id) return;

        try {
            setUploading(true);
            setUploadProgress('Removendo anúncio...');

            // Limpar slot
            const { error: slotError } = await supabase
                .from('playlist_slots')
                .update({ media_id: null })
                .eq('id', partnerSlot.id);

            if (slotError) throw slotError;

            // Remover do storage
            if (currentMedia?.storage_path) {
                await supabase.storage.from('media').remove([currentMedia.storage_path]);
            }

            setSuccess('Anúncio removido.');
            refresh();
        } catch (err) {
            setError(err.message || 'Erro ao remover');
        } finally {
            setUploading(false);
            setUploadProgress('');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!terminal) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-black text-slate-800 mb-2">Nenhum terminal vinculado</h2>
                    <p className="text-slate-500 text-sm">
                        Seu anúncio aparecerá no terminal vinculado à sua conta. Entre em contato com o administrador para vincular um terminal.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Meu Anúncio</h1>
                <p className="text-slate-500 mt-1">
                    Gerencie o anúncio que exibe na sua tela <span className="font-bold text-slate-700">{terminal.name}</span>
                </p>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 text-sm">Este é o seu espaço exclusivo</p>
                        <p className="text-slate-500 text-xs mt-1">
                            Você pode trocar seu anúncio quantas vezes quiser, sem necessidade de aprovação.
                            Formatos aceitos: JPG, PNG, WebP, MP4, WebM (máx {MAX_VIDEO_DURATION_SECONDS}s para vídeos).
                        </p>
                    </div>
                </div>
            </div>

            {/* Alertas */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-bold">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <p className="text-emerald-700 text-sm font-bold">{success}</p>
                </div>
            )}

            {/* Preview / Upload Zone */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {hasMedia ? (
                    <>
                        {/* Preview da mídia */}
                        <div className="bg-slate-900 flex items-center justify-center" style={{ minHeight: '320px' }}>
                            {currentMedia.type === 'video' ? (
                                <video
                                    src={currentMedia.url}
                                    className="max-h-[400px] w-auto"
                                    controls
                                    muted
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={currentMedia.url}
                                    alt={currentMedia.name}
                                    className="max-h-[400px] w-auto object-contain"
                                />
                            )}
                        </div>

                        {/* Info + Actions */}
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                {currentMedia.type === 'video'
                                    ? <Film className="w-5 h-5 text-blue-500" />
                                    : <ImageIcon className="w-5 h-5 text-emerald-500" />
                                }
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{currentMedia.name}</p>
                                    <p className="text-xs text-slate-400">
                                        {currentMedia.type === 'video' ? 'Vídeo' : 'Imagem'}
                                        {currentMedia.duration ? ` • ${currentMedia.duration}s` : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <label className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all cursor-pointer ${uploading
                                    ? 'bg-slate-100 text-slate-400 cursor-wait'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                                    }`}>
                                    <RefreshCw className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} />
                                    {uploading ? (uploadProgress || 'Enviando...') : 'Trocar Anúncio'}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={ACCEPTED_TYPES.join(',')}
                                        onChange={handleUpload}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                </label>

                                <button
                                    onClick={handleRemoveAd}
                                    disabled={uploading}
                                    className="px-4 py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 active:scale-[0.98] transition-all font-bold text-sm disabled:opacity-40"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Upload Zone — Sem mídia */
                    <label className={`flex flex-col items-center justify-center p-12 cursor-pointer transition-all ${uploading
                        ? 'bg-slate-50 cursor-wait'
                        : 'hover:bg-indigo-50/50 group'
                        }`}>
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all ${uploading
                            ? 'bg-indigo-100'
                            : 'bg-indigo-50 group-hover:bg-indigo-100 group-hover:scale-110'
                            }`}>
                            {uploading
                                ? <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                                : <Upload className="w-8 h-8 text-indigo-500" />
                            }
                        </div>

                        <h3 className="text-lg font-black text-slate-800 mb-2">
                            {uploading ? (uploadProgress || 'Enviando...') : 'Enviar Meu Anúncio'}
                        </h3>
                        <p className="text-slate-400 text-sm text-center max-w-sm">
                            Clique para selecionar uma imagem ou vídeo.
                            Ele aparecerá automaticamente na sua tela.
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_TYPES.join(',')}
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                )}
            </div>
        </div>
    );
};

export default PartnerAdPage;
