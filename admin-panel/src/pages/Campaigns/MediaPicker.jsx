import React from 'react';
import { FileVideo, Image as ImageIcon, ChevronRight } from 'lucide-react';

const MediaPicker = ({ label, selectedId, onSelect, mediaFiles }) => {
    // Sistema vertical-only: mostrar todas as mídias
    const filteredMedia = mediaFiles;
    const selected = mediaFiles.find(m => m.id === selectedId);

    return (
        <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1">{label}</label>
            <div className="relative group">
                <select
                    value={selectedId || ''}
                    onChange={(e) => onSelect(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none appearance-none transition-all cursor-pointer"
                >
                    <option value="">Selecione uma mídia vertical...</option>
                    {filteredMedia.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
            </div>

            {selected && (
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center space-x-4 animate-in fade-in slide-in-from-top-2">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-indigo-200/50">
                        {selected.type === 'video' ? <FileVideo className="w-6 h-6 text-indigo-500" /> : <ImageIcon className="w-6 h-6 text-indigo-500" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-indigo-900 truncate Outfit">{selected.name}</span>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Mídia Confirmada • Vertical 9:16</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaPicker;
