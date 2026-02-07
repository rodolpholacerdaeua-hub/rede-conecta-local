import React, { useState, useEffect } from 'react';
import { Upload, FileVideo, Image as ImageIcon, Trash2, Loader2, Star, Edit2, Calendar, X, RefreshCw } from 'lucide-react';
import { supabase, uploadMediaFile, createMedia, deleteMedia, listMedia } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

const MediaCard = ({ file, onDelete, onRegenerate, isAdmin, isLocked }) => {
    // Determinar a imagem de preview: thumbnail para vídeos, url para imagens
    const previewImage = file.type === 'video'
        ? (file.thumbnail || null)
        : file.url;

    return (
        <div className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            {/* Thumbnail Preview */}
            <div className="aspect-video bg-slate-100 flex items-center justify-center relative bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: previewImage ? `url(${previewImage})` : 'none' }}>
                {file.type === 'video' && !previewImage && <FileVideo className="w-12 h-12 text-slate-400" />}
                {file.type === 'video' && previewImage && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                            <FileVideo className="w-6 h-6 text-white" />
                        </div>
                    </div>
                )}
                {file.type === 'image' && !file.url && <ImageIcon className="w-12 h-12 text-slate-400" />}

                {/* Orientation Badge - Sempre Vertical */}
                <div className="absolute top-2 left-2 bg-indigo-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    Vertical 9:16
                </div>

                {/* Validity Badge */}
                {(file.start_date || file.end_date) && (
                    <div className="absolute bottom-2 left-2 bg-amber-500/80 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {file.end_date ? `Até ${new Date(file.end_date).toLocaleDateString('pt-BR')}` : 'Agendado'}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <h4 className="text-sm font-medium text-slate-800 truncate" title={file.name}>
                    {file.name}
                </h4>
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 font-bold">
                    <span>{file.resolution || '--x--'}</span>
                    <span>{file.file_size ? (file.file_size / 1024 / 1024).toFixed(2) : '0'} MB</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                    {file.created_at
                        ? new Date(file.created_at).toLocaleDateString()
                        : 'Processando...'}
                </div>
            </div>

            {/* Actions (Hover) */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                {/* Botão de regenerar thumbnail para vídeos sem preview */}
                {file.type === 'video' && !file.thumbnail && onRegenerate && (
                    <button
                        onClick={() => onRegenerate(file)}
                        className="p-1.5 bg-white rounded-full shadow-sm hover:bg-green-50 text-slate-600 hover:text-green-600"
                        title="Gerar miniatura"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                )}

                {/* Botão de excluir - desabilitado se mídia está em campanha em moderação */}
                <button
                    onClick={() => !isLocked && onDelete(file)}
                    className={`p-1.5 bg-white rounded-full shadow-sm ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50 text-slate-600 hover:text-red-600'}`}
                    title={isLocked ? 'Mídia vinculada a campanha em moderação' : 'Excluir mídia'}
                    disabled={isLocked}
                >
                    <Trash2 className={`w-4 h-4 ${isLocked ? 'text-slate-400' : ''}`} />
                </button>
            </div>
        </div>
    );
};

const MediaLibrary = () => {
    const { currentUser, userData } = useAuth();
    const [files, setFiles] = useState([]);
    const [campaigns, setCampaigns] = useState([]); // Campanhas do usuário
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    // Sistema vertical-only: orientação fixa portrait


    // Estado para modal de confirmação de exclusão
    const [deletingMedia, setDeletingMedia] = useState(null);

    // Verificar se mídia está bloqueada (vinculada a campanha em moderação/aprovada)
    const isMediaLocked = (mediaId) => {
        return campaigns.some(campaign =>
            (campaign.h_media_id === mediaId || campaign.v_media_id === mediaId) &&
            ['pending', 'approved'].includes(campaign.moderation_status)
        );
    };

    // Buscar arquivos e campanhas do Supabase
    const loadMedia = async () => {
        if (!currentUser || !userData) return;
        try {
            // Carregar mídias
            const { data: mediaData, error: mediaError } = await listMedia(currentUser.id);
            if (mediaError) {
                console.error("Erro ao carregar mídia:", mediaError);
                setFiles([]);
                return;
            }
            setFiles(mediaData || []);

            // Carregar campanhas do usuário para verificar bloqueio
            const { data: campaignsData, error: campaignsError } = await supabase
                .from('campaigns')
                .select('id, h_media_id, v_media_id, moderation_status')
                .eq('owner_id', currentUser.id);

            if (!campaignsError) {
                setCampaigns(campaignsData || []);
            }
        } catch (error) {
            console.error("Erro na query de mídia:", error);
            setFiles([]);
        }
    };

    // Effect para carregar mídia e configurar realtime
    useEffect(() => {
        if (!currentUser || !userData) return;

        loadMedia();

        // Realtime subscription com filtro no servidor
        const channel = supabase
            .channel(`media-${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'media',
                    filter: `owner_id=eq.${currentUser.id}`
                },
                (payload) => {
                    console.log('[Realtime] Media change:', payload.eventType);
                    loadMedia();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, userData?.role]);

    const getFileDimensions = (file) => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const timeout = setTimeout(() => {
                console.warn("Timeout ao ler dimensões do arquivo:", file.name);
                URL.revokeObjectURL(url);
                resolve({ width: 0, height: 0 });
            }, 5000);

            if (file.type.startsWith('image/')) {
                const img = new Image();
                img.onload = () => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(url);
                    resolve({ width: img.naturalWidth, height: img.naturalHeight });
                };
                img.onerror = () => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(url);
                    resolve({ width: 0, height: 0 });
                };
                img.src = url;
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(url);
                    resolve({ width: video.videoWidth, height: video.videoHeight });
                };
                video.onerror = (e) => {
                    console.error("Erro no elemento de vídeo:", e);
                    clearTimeout(timeout);
                    URL.revokeObjectURL(url);
                    resolve({ width: 0, height: 0 });
                };
                video.src = url;
                video.load();
            } else {
                clearTimeout(timeout);
                resolve({ width: 0, height: 0 });
            }
        });
    };

    // Gerar thumbnail de vídeo usando canvas
    const generateVideoThumbnail = (file) => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const url = URL.createObjectURL(file);

            video.onloadeddata = () => {
                // Pula para 1 segundo ou 25% do vídeo
                video.currentTime = Math.min(1, video.duration * 0.25);
            };

            video.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Converter para base64 (qualidade 0.7 para menor tamanho)
                    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
                    URL.revokeObjectURL(url);
                    resolve(thumbnailUrl);
                } catch (e) {
                    console.error('Erro ao gerar thumbnail:', e);
                    URL.revokeObjectURL(url);
                    resolve(null);
                }
            };

            video.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };

            // Timeout de 5 segundos
            setTimeout(() => {
                URL.revokeObjectURL(url);
                resolve(null);
            }, 5000);

            video.src = url;
            video.load();
        });
    };
    const handleUpload = async (e) => {
        console.log("🚀 [UPLOAD] Iniciando processo...");
        const file = e.target.files[0];
        if (!file) {
            console.log("⚠️ [UPLOAD] Nenhum arquivo selecionado.");
            return;
        }

        const resetInput = () => { e.target.value = ''; };
        console.log("📂 [UPLOAD] Arquivo selecionado:", file.name, file.type, file.size);

        // 1. Validação de Quota
        if (userData?.role === 'cliente' && userData?.plan === 'start') {
            const currentMediaCount = files.length;
            console.log("📊 [UPLOAD] Quota Start:", currentMediaCount, "/ 1");
            if (currentMediaCount >= 1) {
                alert('🚀 LIMITE DO PLANO PILOTO: Seu plano permite apenas 1 vídeo/imagem ativo na biblioteca. Para trocar de conteúdo, exclua o arquivo atual ou faça upgrade.');
                resetInput();
                return;
            }
        }

        // 2. Validação básica de tamanho
        if (file.size > 100 * 1024 * 1024) {
            alert('Arquivo muito grande! Máximo 100MB.');
            resetInput();
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            console.log("🔍 [UPLOAD] Analisando dimensões...");
            const dims = await getFileDimensions(file);
            console.log("📏 [UPLOAD] Dimensões detectadas:", dims);

            if (dims.width === 0) {
                alert("Não foi possível ler as dimensões do arquivo. Verifique se o formato é válido.");
                setUploading(false);
                resetInput();
                return;
            }

            const isVertical = dims.height > dims.width;

            if (!isVertical) {
                alert(`❌ FORMATO INCORRETO: O sistema aceita apenas mídias no formato VERTICAL (9:16).\n\nSeu arquivo está em formato paisagem. Por favor, use um vídeo ou imagem na orientação retrato (mais alto que largo).`);
                setUploading(false);
                resetInput();
                return;
            }

            // Simular progresso (Supabase não tem callback de progresso nativo)
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            console.log("☁️ [UPLOAD] Enviando para o Supabase Storage...");
            const storagePath = `${currentUser.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

            const { data: uploadData, error: uploadError } = await uploadMediaFile(file, storagePath);

            clearInterval(progressInterval);

            if (uploadError) {
                console.error("❌ [UPLOAD] Storage Error:", uploadError);
                alert(`Erro no upload (Storage): ${uploadError.message}`);
                setUploading(false);
                resetInput();
                return;
            }

            setProgress(95);
            console.log("📝 [UPLOAD] Salvando no Supabase Database...");

            // Gerar thumbnail para vídeos
            let thumbnailUrl = null;
            const isVideo = file.type.startsWith('video/');
            if (isVideo) {
                console.log("🖼️ [UPLOAD] Gerando thumbnail do vídeo...");
                thumbnailUrl = await generateVideoThumbnail(file);
                console.log("🖼️ [UPLOAD] Thumbnail gerada:", thumbnailUrl ? 'Sucesso' : 'Falhou');
            }

            const { error: dbError } = await createMedia({
                name: file.name,
                url: uploadData.url,
                type: isVideo ? 'video' : 'image',
                orientation: 'portrait',
                storage_path: uploadData.path,
                file_size: file.size,
                owner_id: currentUser.id,
                thumbnail: thumbnailUrl
            });

            if (dbError) {
                console.error("❌ [UPLOAD] Database Error:", dbError);
                alert(`Arquivo enviado, mas falhou ao salvar dados: ${dbError.message}`);
            } else {
                console.log("✅ [UPLOAD] Concluído com sucesso!");
            }

            setProgress(100);
            setUploading(false);
            resetInput();

        } catch (error) {
            console.error("❌ [UPLOAD] Erro Crítico:", error);
            alert(`Falha fatal no upload: ${error.message || 'Erro desconhecido'}`);
            setUploading(false);
            resetInput();
        }
    };
    const handleDeleteClick = (file) => {
        console.log("🗑️ [DELETE] Abrindo modal para:", file.name);
        setDeletingMedia(file);
    };

    const confirmDelete = async () => {
        const file = deletingMedia;
        if (!file) return;

        console.log("🗑️ [DELETE] Confirmado, processando:", file.name);
        setDeletingMedia(null); // Fechar modal

        try {
            // 1. Deletar do Storage (se existir path)
            if (file.storage_path) {
                const { error: storageError } = await supabase.storage
                    .from('media')
                    .remove([file.storage_path]);

                if (storageError) {
                    console.warn("Aviso: Não foi possível deletar do Storage:", storageError);
                }
            }

            // 2. Marcar como deleted no banco (soft delete)
            const { error } = await deleteMedia(file.id);
            if (error) throw error;

            console.log("✅ [DELETE] Mídia excluída com sucesso");
            loadMedia(); // Recarregar lista

        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert('Erro ao excluir arquivo');
        }
    };

    // Regenerar thumbnail de vídeo existente
    const handleRegenerate = async (file) => {
        if (!file.url) {
            alert('Vídeo sem URL disponível');
            return;
        }

        try {
            console.log("🖼️ [REGENERATE] Gerando thumbnail para:", file.name);

            // Criar elemento de vídeo com a URL existente
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';

            const thumbnailUrl = await new Promise((resolve) => {
                video.onloadeddata = () => {
                    video.currentTime = Math.min(1, video.duration * 0.25);
                };

                video.onseeked = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const thumb = canvas.toDataURL('image/jpeg', 0.7);
                        resolve(thumb);
                    } catch (e) {
                        console.error('Erro ao capturar frame:', e);
                        resolve(null);
                    }
                };

                video.onerror = (e) => {
                    console.error('Erro ao carregar vídeo:', e);
                    resolve(null);
                };

                setTimeout(() => resolve(null), 10000);
                video.src = file.url;
                video.load();
            });

            if (thumbnailUrl) {
                // Atualizar no banco de dados
                const { error } = await supabase
                    .from('media')
                    .update({ thumbnail: thumbnailUrl })
                    .eq('id', file.id);

                if (error) throw error;

                console.log("✅ [REGENERATE] Thumbnail atualizada com sucesso!");
                loadMedia(); // Recarregar lista
            } else {
                alert('Não foi possível gerar a miniatura. O vídeo pode não estar acessível.');
            }
        } catch (error) {
            console.error("Erro ao regenerar thumbnail:", error);
            alert('Erro ao regenerar miniatura: ' + error.message);
        }
    };



    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Biblioteca de Mídia</h2>
                    <p className="text-slate-500">Gerencie seus vídeos e imagens.</p>
                    {userData?.plan === 'start' && (
                        <div className="mt-2 inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-100 uppercase tracking-wider">
                            <Star className="w-3 h-3 fill-current" />
                            Quota Pilot: {files.length}/1 Mídia Ativa
                        </div>
                    )}
                </div>

                <div className="flex items-center bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">📱 Formato: Vertical 9:16</span>
                </div>

                <label className={`flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    <span>{uploading ? `Enviando ${progress.toFixed(0)}%` : 'Fazer Upload'}</span>
                    <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                        accept="image/*,video/*"
                        disabled={uploading}
                    />
                </label>
            </div>

            {/* Upload Zone (Estética) */}
            {!uploading && files.length === 0 && (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 transition-colors">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800">Sua biblioteca está vazia</h3>
                    <p className="text-sm text-slate-500 mt-1">Clique no botão "Fazer Upload" para começar.</p>
                </div>
            )}

            {/* Media Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {files.map(file => (
                    <MediaCard
                        key={file.id}
                        file={file}
                        onDelete={handleDeleteClick}
                        onRegenerate={handleRegenerate}
                        isAdmin={userData?.role === 'admin'}
                        isLocked={isMediaLocked(file.id)}
                    />
                ))}
            </div>


            {/* Modal de Confirmação de Exclusão */}
            {deletingMedia && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                            Excluir Mídia?
                        </h3>
                        <p className="text-sm text-slate-500 text-center mb-6">
                            Tem certeza que deseja excluir <strong>{deletingMedia.name}</strong>? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingMedia(null)}
                                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaLibrary;
