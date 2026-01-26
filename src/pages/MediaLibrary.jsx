import React, { useState, useEffect } from 'react';
import { Upload, FileVideo, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

const MediaCard = ({ file, onDelete }) => (
    <div className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
        {/* Thumbnail Preview */}
        <div className="aspect-video bg-slate-100 flex items-center justify-center relative bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: file.type === 'image' ? `url(${file.url})` : 'none' }}>
            {file.type === 'video' && <FileVideo className="w-12 h-12 text-slate-400" />}
            {file.type === 'image' && !file.url && <ImageIcon className="w-12 h-12 text-slate-400" />}
        </div>

        {/* Info */}
        <div className="p-3">
            <h4 className="text-sm font-medium text-slate-800 truncate" title={file.name}>
                {file.name}
            </h4>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <span>{new Date(file.createdAt?.seconds * 1000).toLocaleDateString()}</span>
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
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Buscar arquivos do Firestore em Tempo Real
    useEffect(() => {
        const q = query(collection(db, "media"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const mediaFiles = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setFiles(mediaFiles);
        });

        return () => unsubscribe();
    }, []);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validação básica
        if (file.size > 100 * 1024 * 1024) { // 100MB
            alert('Arquivo muito grande! Máximo 100MB.');
            return;
        }

        setUploading(true);
        setProgress(0);

        /* Estratégia de Upload:
           1. Cria referência no Storage
           2. Sobe o arquivo
           3. Pega a URL pública
           4. Salva os metadados no Firestore
        */

        try {
            const fileRef = ref(storage, `media/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(p);
                },
                (error) => {
                    console.error(error);
                    alert('Erro no upload');
                    setUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    // Salvar no Banco de Dados
                    await addDoc(collection(db, "media"), {
                        name: file.name,
                        url: downloadURL,
                        type: file.type.startsWith('image/') ? 'image' : 'video',
                        size: file.size,
                        storagePath: uploadTask.snapshot.ref.fullPath,
                        createdAt: new Date()
                    });

                    setUploading(false);
                }
            );
        } catch (error) {
            console.error("Erro:", error);
            setUploading(false);
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
