import { useState } from 'react';

/**
 * Sidebar dropdown showing chat history.
 * Allows switching between chats and deleting old ones.
 */
export function ChatHistory({ chats, activeChatId, onSwitch, onDelete, onClose }) {
    return (
        <div className="fixed inset-0 z-40" onClick={onClose}>
            <div
                className="absolute top-0 left-0 glass rounded-xl border-2 border-cyber-purple/30 
                    w-72 max-h-80 overflow-hidden animate-slide-up"
                style={{ margin: '8px' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-cyber-purple/20">
                    <h3 className="text-xs font-bold text-cyber-purple uppercase tracking-wider">
                        📋 Historial
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xs"
                    >
                        ✕
                    </button>
                </div>

                {/* Chat List */}
                <div className="overflow-y-auto max-h-64 p-2 space-y-1">
                    {chats.length === 0 ? (
                        <p className="text-gray-500 text-[10px] font-mono text-center py-4">
                            No hay chats guardados
                        </p>
                    ) : (
                        [...chats].reverse().map(chat => (
                            <div
                                key={chat.id}
                                className={`
                                    flex items-center justify-between p-2 rounded-lg cursor-pointer
                                    transition-all duration-200 group
                                    ${chat.id === activeChatId
                                        ? 'glass border border-cyber-cyan/40 text-cyber-cyan'
                                        : 'hover:bg-white/5 text-gray-300'
                                    }
                                `}
                                onClick={() => { onSwitch(chat.id); onClose(); }}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-mono truncate">
                                        {chat.name}
                                    </p>
                                    <p className="text-[9px] text-gray-500">
                                        {chat.messages.length} mensajes · {
                                            new Date(chat.createdAt).toLocaleDateString('es', {
                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })
                                        }
                                    </p>
                                </div>

                                {/* Delete button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 
                                        text-xs ml-2 transition-opacity p-1"
                                    title="Eliminar"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
