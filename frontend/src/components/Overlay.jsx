import { useEffect, useRef } from 'react';
import { WindowControls } from './WindowControls';

/**
 * Main overlay showing chat messages (accumulated transcriptions + AI responses).
 * Scrollable, compact, draggable, with window controls.
 */
export function Overlay({ messages, status, isConnected, chatName, onNewChat, onShowHistory, user, onLogout }) {
    const contentRef = useRef(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [messages, status]);

    return (
        <div
            className="glass rounded-2xl border-2 border-cyber-cyan/30 flex flex-col"
            style={{ width: '480px', maxHeight: '340px' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyber-cyan/20 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-2 h-2 rounded-full bg-cyber-cyan shadow-neon-cyan animate-pulse-slow flex-shrink-0" />
                    <h1 className="text-sm font-bold text-cyber-cyan neon-text tracking-wider flex-shrink-0">
                        VOZ<span className="text-cyber-magenta">INTERVIEW</span>
                    </h1>
                    {chatName && (
                        <span className="text-[10px] text-gray-400 font-mono truncate ml-1">
                            — {chatName}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* History Button */}
                    <button
                        onClick={onShowHistory}
                        className="text-[10px] text-gray-400 hover:text-cyber-purple font-mono transition-colors"
                        title="Historial"
                    >
                        📋
                    </button>

                    {/* New Chat Button */}
                    <button
                        onClick={onNewChat}
                        className="text-[10px] text-gray-400 hover:text-cyber-cyan font-mono transition-colors"
                        title="Nueva entrevista"
                    >
                        ➕
                    </button>

                    {/* Connection Status */}
                    <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-[9px] text-gray-500 font-mono">
                            {isConnected ? 'ON' : 'OFF'}
                        </span>
                    </div>

                    {/* User info + Logout */}
                    {user && (
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-gray-500 font-mono truncate max-w-[80px]" title={user.email}>
                                {user.name || user.email}
                            </span>
                            <button
                                onClick={onLogout}
                                className="text-[10px] text-gray-400 hover:text-red-400 font-mono transition-colors"
                                title="Cerrar sesión"
                            >
                                🚪
                            </button>
                        </div>
                    )}

                    {/* Window Controls (Electron only) */}
                    <WindowControls />
                </div>
            </div>

            {/* Scrollable Chat Content */}
            <div
                ref={contentRef}
                className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-2"
                style={{ maxHeight: '290px' }}
            >
                {/* Status Message */}
                {status && (
                    <div className="p-2 glass rounded-lg border border-cyber-blue/30 animate-slide-up">
                        <p className="text-[10px] text-cyber-blue font-mono">{status}</p>
                    </div>
                )}

                {/* Chat Messages */}
                {messages && messages.length > 0 ? (
                    messages.map((msg, idx) => (
                        <ChatMessage key={idx} message={msg} />
                    ))
                ) : !status && (
                    <div className="text-center py-6">
                        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple opacity-20 animate-pulse-slow" />
                        <p className="text-gray-400 text-[10px] font-mono">
                            Esperando pregunta de entrevista...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Individual chat message component.
 */
function ChatMessage({ message }) {
    const { type, content } = message;

    if (type === 'transcription') {
        return (
            <div className="animate-slide-up">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-1 h-2.5 bg-cyber-cyan rounded-full" />
                    <span className="text-[9px] font-bold text-cyber-cyan uppercase tracking-wider">
                        Pregunta
                    </span>
                </div>
                <div className="p-2 glass rounded-lg border border-cyber-cyan/20">
                    <p className="text-white text-xs leading-relaxed">{content}</p>
                </div>
            </div>
        );
    }

    if (type === 'ai_response' && content) {
        return (
            <div className="space-y-2 animate-slide-up ml-2">
                {/* Translation */}
                {content.translation && content.translation !== 'N/A' && (
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-1 h-2.5 bg-cyber-magenta rounded-full" />
                            <span className="text-[9px] font-bold text-cyber-magenta uppercase tracking-wider">
                                Traducción
                            </span>
                        </div>
                        <div className="p-2 glass rounded-lg border border-cyber-magenta/20">
                            <p className="text-gray-200 text-[11px] leading-relaxed italic">
                                {content.translation}
                            </p>
                        </div>
                    </div>
                )}

                {/* Suggested Answer */}
                {content.suggested_answer && (
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-1 h-2.5 bg-cyber-purple rounded-full" />
                            <span className="text-[9px] font-bold text-cyber-purple uppercase tracking-wider">
                                Respuesta
                            </span>
                        </div>
                        <div className="p-2 glass rounded-lg border border-cyber-purple/20">
                            <p className="text-white text-[11px] leading-relaxed">
                                {content.suggested_answer}
                            </p>
                        </div>
                    </div>
                )}

                {/* Technical Terms */}
                {content.key_technical_terms && content.key_technical_terms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {content.key_technical_terms.map((term, i) => (
                            <span
                                key={i}
                                className="px-1.5 py-0.5 glass rounded-full text-[9px] text-cyber-cyan border border-cyber-cyan/30 font-mono"
                            >
                                {term}
                            </span>
                        ))}
                    </div>
                )}

                {/* Divider */}
                <div className="border-b border-white/5" />
            </div>
        );
    }

    return null;
}
