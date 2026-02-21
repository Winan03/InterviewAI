import { useState, useRef, useEffect } from 'react';

/**
 * Small modal for creating a new chat session.
 * Auto-generates a name or lets user type one.
 */
export function NewChatModal({ onConfirm, onCancel }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);
    const defaultName = `Entrevista ${new Date().toLocaleTimeString('es', {
        hour: '2-digit', minute: '2-digit'
    })}`;

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(name.trim() || defaultName);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <form
                onSubmit={handleSubmit}
                className="glass rounded-xl p-4 border-2 border-cyber-cyan/40 w-80 space-y-3 animate-slide-up"
            >
                <h3 className="text-sm font-bold text-cyber-cyan neon-text">
                    ✨ Nueva Entrevista
                </h3>
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={defaultName}
                    className="w-full px-3 py-2 glass rounded-lg border border-cyber-cyan/30 
                        text-white text-xs font-mono bg-transparent 
                        focus:outline-none focus:border-cyber-cyan/60
                        placeholder:text-gray-500"
                />
                <div className="flex gap-2">
                    <button
                        type="submit"
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold
                            bg-gradient-to-r from-cyber-cyan to-cyber-blue text-black
                            hover:opacity-90 transition-opacity"
                    >
                        Crear
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono
                            glass border border-gray-600 text-gray-400
                            hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
}
