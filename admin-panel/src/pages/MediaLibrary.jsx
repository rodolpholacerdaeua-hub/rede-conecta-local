import React, { useState, useEffect } from 'react';
import { Upload, FileVideo, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const MediaCard = ({ file, onDelete }) => (
    // ... (mantenho o componente igual)
    <div className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
        {/* Thumbnail Preview */}
        <div className="aspect-video bg-slate-100 flex items-center justify-center relative bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: file.type === 'image' ? `url(${file.url})` : 'none' }}>
            {file.type === 'video' && <FileVideo className="w-12 h-12 text-slate-400" />}
            {file.type === 'image' && !file.url && <ImageIcon className="w-12 h-12 text-slate-400" />}

            {/* Orientation Badge */}
            <div className="absolute top-2 left-2 bg-slate-900/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                {file.orientation === 'vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'}
            </div>
        </div>

        {/* Info */}
        <div className="p-3">
            <h4 className="text-sm font-medium text-slate-800 truncate" title={file.name}>
                {file.name}
            </h4>
            <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 font-bold">
                <span>{file.resolution || '--x--'}</span>
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
                {new Date(file.createdAt?.seconds * 1000).toLocaleDateString()}
            </div>
        </div>

        {/* Actions (Hover) */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
            <button
                onClick={() => onDelete(file)}
                className="p-1.5 bg-white rounded-full shadow-sm hover:bg-red-50 text-slate-600 hover:text-red-600"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    </div>
);

const MediaLibrary = () => {
    const { currentUser, userData } = useAuth();
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [orientation, setOrientation] = useState('horizontal');

    // Buscar arquivos do Firestore em Tempo Real
    useEffect(() => {
        if (!currentUser || !userData) return;

        try {
            // Admin vê tudo, Cliente vê as suas
            const q = userData.role === 'admin'
                ? query(collection(db, "media"), orderBy("createdAt", "desc"))
                : query(collection(db, "media"), where("ownerId", "==", currentUser.uid), orderBy("createdAt", "desc"));

            const unsubscribe = onSnapshot(q,
                (snapshot) => {
                    const mediaFiles = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setFiles(mediaFiles);
                },
                (error) => {
                    console.error("Erro ao carregar mídia:", error);
                    setFiles([]); // Fallback para array vazio
                }
            );

            return () => unsubscribe();
        } catch (error) {
            console.error("Erro na query de mídia:", error);
            setFiles([]);
        }
    }, [currentUser?.uid, userData?.role]);

    const getFileDimensions = (file) => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            if (file.type.startsWith('image/')) {
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve({ width: img.naturalWidth, height: img.naturalHeight });
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve({ width: 0, height: 0 });
                };
                img.src = url;
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    URL.revokeObjectURL(url);
                    resolve({ width: video.videoWidth, height: video.videoHeight });
                };
                video.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve({ width: 0, height: 0 });
                };
                video.src = url;
                video.load();
            } else {
                resolve({ width: 0, height: 0 });
            }
        });
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Resetar o input para permitir selecionar o mesmo arquivo se der erro
        const resetInput = () => { e.target.value = ''; };

        // Validação básica
        if (file.size > 100 * 1024 * 1024) { // 100MB
            alert('Arquivo muito grande! Máximo 100MB.');
            resetInput();
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            // 1. Detectar Dimensões e Orientação Real
            const dims = await getFileDimensions(file);

            if (dims.width === 0) {
                alert("Não foi possível ler as dimensões do arquivo. Verifique se o formato é válido.");
                setUploading(false);
                resetInput();
                return;
            }

            const isVertical = dims.height > dims.width;
            const detectedOrientation = isVertical ? 'vertical' : 'horizontal';

            // 2. Validar Proporção e Orientação Selecionada
            if (detectedOrientation !== orientation) {
                alert(`❌ ERRO DE PROPORÇÃO: Você selecionou o modo "${orientation.toUpperCase()}", mas o seu arquivo está na "${detectedOrientation.toUpperCase()}". \n\nTroque a chave acima para "${detectedOrientation.toUpperCase()}" e tente novamente.`);
                setUploading(false);
                resetInput();
                return;
            }

            // 3. Validar Aspect Ratio (Aceitar margem de erro maior - 20%)
            const ratio = isVertical ? (dims.height / dims.width) : (dims.width / dims.height);
            const targetRatio = 16 / 9; // 1.777
            if (Math.abs(ratio - targetRatio) > 0.4) {
                const confirmRes = window.confirm(`⚠️ PROPORÇÃO NÃO PADRÃO: Este arquivo parece ter uma proporção diferente de 16:9 (${ratio.toFixed(2)}). Isso pode causar barras pretas ou distorção na TV. Deseja continuar assim mesmo?`);
                if (!confirmRes) {
                    setUploading(false);
                    resetInput();
                    return;
                }
            }

            const fileRef = ref(storage, `media/${currentUser.uid}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(p);
                },
                (error) => {
                    console.error("Storage Error:", error);
                    alert(`Erro no upload: ${error.message}`);
                    setUploading(false);
                    resetInput();
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    // Salvar no Banco de Dados com metadados detalhados
                    await addDoc(collection(db, "media"), {
                        name: file.name,
                        url: downloadURL,
                        type: file.type.startsWith('image/') ? 'image' : 'video',
                        orientation: detectedOrientation,
                        resolution: `${dims.width}x${dims.height}`,
                        size: file.size,
                        storagePath: uploadTask.snapshot.ref.fullPath,
                        ownerId: currentUser.uid,
                        createdAt: new Date()
                    });

                    setUploading(false);
                    resetInput();
                }
            );
        } catch (error) {
            console.error("Erro geral no upload:", error);
            alert('Falha interna ao processar mídia. Verifique sua conexão.');
            setUploading(false);
            resetInput();
        }
    };

    const handleDelete = async (file) => {
        if (!window.confirm('Tem certeza que deseja excluir este arquivo?')) return;

        try {
            // 1. Deletar do Storage (Nuvem de arquivos)
            const fileRef = ref(storage, file.storagePath);
            await deleteObject(fileRef);

            // 2. Deletar do Firestore (Banco de dados)
            await deleteDoc(doc(db, "media", file.id));
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert('Erro ao excluir arquivo');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Biblioteca de Mídia</h2>
                    <p className="text-slate-500">Gerencie seus vídeos e imagens.</p>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                        onClick={() => setOrientation('horizontal')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${orientation === 'horizontal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        HORIZONTAL
                    </button>
                    <button
                        onClick={() => setOrientation('vertical')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${orientation === 'vertical' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        VERTICAL
                    </button>
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
                    <MediaCard key={file.id} file={file} onDelete={handleDelete} />
                ))}
            </div>
        </div>
    );
};

export default MediaLibrary;
