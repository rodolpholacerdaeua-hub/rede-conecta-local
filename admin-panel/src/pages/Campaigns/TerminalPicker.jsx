import React from 'react';
import { CheckCircle, Users } from 'lucide-react';

const TerminalPicker = ({ quota, selectedTerminals, onToggle, terminals }) => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center pl-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit">
                    Selecionar Telas ({selectedTerminals.length}/{quota === -1 ? '∞' : quota})
                </label>
                {selectedTerminals.length >= quota && quota !== -1 && (
                    <span className="text-[9px] text-amber-600 font-black bg-amber-50 px-2 py-1 rounded-full border border-amber-200 uppercase tracking-tighter">
                        LIMITE ATINGIDO
                    </span>
                )}
            </div>
            <div className="space-y-6 max-h-96 overflow-y-auto p-4 bg-slate-50/50 rounded-[2rem] border border-slate-200">
                {[...new Set(terminals.map(t => t.group || 'Default'))].sort().map(groupName => (
                    <div key={groupName} className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-2">
                            <Users className="w-3 h-3" /> {groupName}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {terminals.filter(t => (t.group || 'Default') === groupName).map(t => {
                                const isSelected = selectedTerminals.includes(t.id);
                                const isDisabled = !isSelected && quota !== -1 && selectedTerminals.length >= quota;

                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => onToggle(t.id)}
                                        disabled={isDisabled}
                                        className={`flex flex-col p-4 rounded-2xl border-2 text-left transition-all duration-300 relative group overflow-hidden ${isSelected
                                            ? 'bg-white border-indigo-600 shadow-lg shadow-indigo-600/10'
                                            : isDisabled
                                                ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                                                : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'
                                            }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-2 right-2">
                                                <CheckCircle className="w-4 h-4 text-indigo-600 animate-in zoom-in" />
                                            </div>
                                        )}
                                        <span className={`text-xs font-black Outfit mb-1 truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                            {t.name}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                                                Vertical 9:16
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TerminalPicker;
