/**
 * InlineUploader — Drag-and-drop upload component for campaigns
 * 
 * Reusable component that handles file selection, validation (vertical, ≤16s, ≤100MB),
 * upload to Supabase Storage, media record creation, and thumbnail generation.
 * Returns the new media ID via onUploadComplete callback.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileVideo, CheckCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { supabase, uploadMediaFile, createMedia } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_VIDEO_DURATION = 16; // 15s comerciais + 1s reserva

const getFileDimensions = (file) => {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const timeout = setTimeout(() => {
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
                resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
            };
            video.onerror = () => {
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

const generateVideoThumbnail = (file) => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);

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
                const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
                URL.revokeObjectURL(url);
                resolve(thumbnailUrl);
            } catch {
                URL.revokeObjectURL(url);
                resolve(null);
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };

        setTimeout(() => {
            URL.revokeObjectURL(url);
            resolve(null);
        }, 5000);

        video.src = url;
        video.load();
    });
};

const InlineUploader = ({ onUploadComplete, label = 'Envie seu vídeo', compact = false }) => {
    const { currentUser } = useAuth();
    const [state, setState] = useState('idle'); // idle | validating | uploading | done | error
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [uploadedMedia, setUploadedMedia] = useState(null); // { id, name, thumbnail }
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const resetState = () => {
        setState('idle');
        setProgress(0);
        setError('');
        setUploadedMedia(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const processFile = useCallback(async (file) => {
        if (!file) return;
        setError('');

        // Basic type check
        if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
            setError('Formato não suportado. Use vídeo (MP4, WebM) ou imagem (JPG, PNG).');
            return;
        }

        // Size check
        if (file.size > MAX_FILE_SIZE) {
            setError('Arquivo muito grande! Máximo 100MB.');
            return;
        }

        setState('validating');

        try {
            const dims = await getFileDimensions(file);
            if (dims.width === 0) {
                setError('Não foi possível ler o arquivo. Verifique se o formato é válido.');
                setState('error');
                return;
            }

            // Vertical check
            if (dims.height <= dims.width) {
                setError('Formato incorreto! Use apenas mídias verticais (9:16). O vídeo deve ser mais alto que largo.');
                setState('error');
                return;
            }

            // Duration check
            if (file.type.startsWith('video/') && dims.duration && dims.duration > MAX_VIDEO_DURATION) {
                setError(`Duração excedida! O vídeo tem ${Math.ceil(dims.duration)}s. O máximo é 15 segundos.`);
                setState('error');
                return;
            }

            // Validation passed — start upload
            setState('uploading');
            setProgress(10);

            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 12, 85));
            }, 300);

            const storagePath = `${currentUser.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const { data: uploadData, error: uploadError } = await uploadMediaFile(file, storagePath);

            clearInterval(progressInterval);

            if (uploadError) {
                setError(`Erro no upload: ${uploadError.message}`);
                setState('error');
                return;
            }

            setProgress(90);

            // Generate thumbnail for videos
            let thumbnailUrl = null;
            const isVideo = file.type.startsWith('video/');
            if (isVideo) {
                thumbnailUrl = await generateVideoThumbnail(file);
            }

            setProgress(95);

            // Create media record
            const { data: mediaRecord, error: dbError } = await createMedia({
                name: file.name,
                url: uploadData.url,
                type: isVideo ? 'video' : 'image',
                orientation: 'portrait',
                storage_path: uploadData.path,
                file_size: file.size,
                owner_id: currentUser.id,
                thumbnail: thumbnailUrl,
                duration: isVideo && dims.duration ? Math.round(dims.duration) : null
            });

            if (dbError) {
                setError(`Erro ao salvar: ${dbError.message}`);
                setState('error');
                return;
            }

            setProgress(100);
            setState('done');
            setUploadedMedia({
                id: mediaRecord.id,
                name: file.name,
                thumbnail: thumbnailUrl,
                url: uploadData.url
            });

            onUploadComplete && onUploadComplete(mediaRecord.id);

        } catch (err) {
            console.error('[InlineUploader] Erro:', err);
            setError(`Erro inesperado: ${err.message}`);
            setState('error');
        }
    }, [currentUser, onUploadComplete]);

    const handleFileSelect = (e) => {
        processFile(e.target.files[0]);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        processFile(file);
    }, [processFile]);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    // Done state — show uploaded file info
    if (state === 'done' && uploadedMedia) {
        return (
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">{label}</label>
                <div className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-4 border-2 border-emerald-200">
                    {uploadedMedia.thumbnail ? (
                        <img src={uploadedMedia.thumbnail} alt="" className="w-14 h-14 rounded-xl object-cover border border-emerald-200" />
                    ) : (
                        <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <FileVideo className="w-6 h-6 text-emerald-500" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-emerald-700 truncate">{uploadedMedia.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-500">Upload concluído</span>
                        </div>
                    </div>
                    <button
                        onClick={resetState}
                        className="p-2 hover:bg-emerald-100 rounded-xl transition-colors"
                        title="Trocar arquivo"
                    >
                        <X className="w-4 h-4 text-emerald-400" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">{label}</label>

            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => state !== 'uploading' && state !== 'validating' && fileInputRef.current?.click()}
                className={`
                    relative rounded-2xl border-2 border-dashed transition-all cursor-pointer
                    ${isDragging
                        ? 'border-cyan-400 bg-cyan-50 scale-[1.02]'
                        : state === 'error'
                            ? 'border-red-300 bg-red-50/50 hover:border-red-400'
                            : 'border-slate-200 bg-slate-50/50 hover:border-cyan-300 hover:bg-cyan-50/30'
                    }
                    ${compact ? 'p-4' : 'p-6'}
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="video/*,image/*"
                    onChange={handleFileSelect}
                    disabled={state === 'uploading' || state === 'validating'}
                />

                {/* Idle / Error state */}
                {(state === 'idle' || state === 'error') && (
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${state === 'error' ? 'bg-red-100 text-red-500' : 'bg-cyan-100 text-cyan-500'
                            }`}>
                            {state === 'error' ? <AlertTriangle className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                        </div>
                        <p className={`text-sm font-black ${state === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
                            {state === 'error' ? 'Tente novamente' : 'Arraste seu vídeo aqui'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                            ou clique para selecionar • Vertical 9:16 • Até 15 segundos
                        </p>
                        {error && (
                            <div className="mt-3 px-3 py-2 bg-red-100 rounded-xl text-[11px] font-bold text-red-600 w-full text-left">
                                ⚠️ {error}
                            </div>
                        )}
                    </div>
                )}

                {/* Validating state */}
                {state === 'validating' && (
                    <div className="flex flex-col items-center text-center py-2">
                        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-2" />
                        <p className="text-sm font-black text-slate-600">Verificando arquivo...</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">Checando formato, orientação e duração</p>
                    </div>
                )}

                {/* Uploading state */}
                {state === 'uploading' && (
                    <div className="flex flex-col items-center text-center py-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm font-black text-cyan-600">{progress < 90 ? 'Enviando...' : 'Finalizando...'}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">{progress}%</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InlineUploader;
