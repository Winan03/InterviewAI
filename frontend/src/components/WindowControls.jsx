import { useState, useEffect } from 'react';

// Check if running in Electron
const isElectron = () => navigator.userAgent.toLowerCase().includes('electron');

/**
 * Custom window control buttons for frameless Electron window.
 * Minimize, pin/unpin (always-on-top), and close.
 */
export function WindowControls() {
    const [isPinned, setIsPinned] = useState(true);

    if (!isElectron()) return null;

    const { ipcRenderer } = window.require('electron');

    useEffect(() => {
        const handler = (event, pinned) => setIsPinned(pinned);
        ipcRenderer.on('window-pin-changed', handler);
        return () => ipcRenderer.removeListener('window-pin-changed', handler);
    }, []);

    return (
        <div className="flex items-center gap-1 no-drag">
            {/* Pin/Unpin toggle */}
            <button
                onClick={() => ipcRenderer.send('window-toggle-pin')}
                className={`w-5 h-5 rounded flex items-center justify-center text-[10px]
                    transition-colors ${isPinned
                        ? 'text-cyber-cyan hover:bg-cyber-cyan/20'
                        : 'text-gray-500 hover:bg-white/10'
                    }`}
                title={isPinned ? 'Desfijar ventana' : 'Fijar ventana encima'}
            >
                📌
            </button>

            {/* Minimize */}
            <button
                onClick={() => ipcRenderer.send('window-minimize')}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 
                    hover:bg-yellow-500/20 hover:text-yellow-400 transition-colors text-[10px]"
                title="Minimizar"
            >
                ─
            </button>

            {/* Close */}
            <button
                onClick={() => ipcRenderer.send('window-close')}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 
                    hover:bg-red-500/20 hover:text-red-400 transition-colors text-[10px]"
                title="Cerrar"
            >
                ✕
            </button>
        </div>
    );
}
