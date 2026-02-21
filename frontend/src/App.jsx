import { useState, useEffect, useRef } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { Overlay } from './components/Overlay';
import { AudioCapture } from './components/AudioCapture';
import { NewChatModal } from './components/NewChatModal';
import { ChatHistory } from './components/ChatHistory';
import { AuthScreen } from './components/AuthScreen';
import { useWebSocket } from './hooks/useWebSocket';
import { useChatHistory } from './hooks/useChatHistory';
import { useAuth } from './hooks/useAuth';

function App() {
    // Auth state
    const auth = useAuth();

    // Setup state
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const [sessionId] = useState(() => `session_${Date.now()}`);
    const [setupInfo, setSetupInfo] = useState(null);

    // Interview state
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('');
    const statusTimeoutRef = useRef(null);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const { isConnected, lastMessage, sendAudio, sendText, sendMessage, error } = useWebSocket(auth.token);
    const {
        chats,
        activeChat,
        activeChatId,
        createChat,
        ensureActiveChat,
        addMessage,
        deleteChat,
        switchChat,
    } = useChatHistory();

    // Handle setup completion
    const handleSetupComplete = (info) => {
        setSetupInfo(info);
        setIsSetupComplete(true);

        // Tell the WebSocket connection to use this session's context
        if (isConnected) {
            sendMessage({
                type: 'set_context',
                session_id: info.sessionId || sessionId
            });
        }
    };

    // Send context when WebSocket reconnects
    useEffect(() => {
        if (isConnected && isSetupComplete && setupInfo) {
            sendMessage({
                type: 'set_context',
                session_id: setupInfo.sessionId || sessionId
            });
        }
    }, [isConnected]);

    // Handle WebSocket messages from backend
    useEffect(() => {
        if (!lastMessage) return;

        switch (lastMessage.type) {
            case 'status':
                setStatus(lastMessage.message);
                break;

            case 'transcription':
                ensureActiveChat();
                addMessage('transcription', lastMessage.text);
                setStatus('Generando respuesta con IA...');
                // Auto-clear if no response arrives in 20 seconds
                if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                statusTimeoutRef.current = setTimeout(() => {
                    setStatus('⏰ Sin respuesta de la IA. Intenta de nuevo.');
                    setTimeout(() => setStatus(''), 3000);
                }, 20000);
                break;

            case 'ai_response':
                if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                addMessage('ai_response', lastMessage.data);
                setStatus('');
                break;

            case 'error':
                if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                setStatus(`❌ ${lastMessage.message}`);
                // Auto-clear error after 5 seconds
                setTimeout(() => setStatus(''), 5000);
                break;

            case 'pong':
                break;

            default:
                break;
        }
    }, [lastMessage]);

    // Web Speech API transcription (browser mode)
    const handleTranscription = (text) => {
        console.log('📝 Browser transcription:', text);
        ensureActiveChat();
        addMessage('transcription', text);
        setStatus('Generando respuesta con IA...');
        sendText(text);
    };

    // Audio blob capture (Electron/server mode)
    const handleAudioCapture = (audioBlob) => {
        console.log('🎤 Audio captured:', audioBlob.size, 'bytes');
        setStatus('Transcribiendo audio...');
        sendAudio(audioBlob, 'webm');
    };

    // New chat flow
    const handleNewChat = () => setShowNewChatModal(true);
    const handleCreateChat = (name) => {
        createChat(name);
        setShowNewChatModal(false);
        setStatus('');
    };

    // Back to setup
    const handleBackToSetup = () => {
        setIsSetupComplete(false);
        setSetupInfo(null);
        setIsRecording(false);
        setStatus('');
    };

    // ─── AUTH SCREEN ───
    if (auth.isLoading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center"
                style={{ background: '#0a0a0f' }}>
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#00f3ff',
                    fontSize: '14px',
                }}>⏳ Verificando sesión...</div>
            </div>
        );
    }

    if (!auth.isAuthenticated) {
        return <AuthScreen authHook={auth} />;
    }

    // ─── SETUP SCREEN ───
    if (!isSetupComplete) {
        return <SetupScreen onComplete={handleSetupComplete} sessionId={sessionId} />;
    }

    // ─── INTERVIEW SCREEN ───
    return (
        <div className="w-screen h-screen flex flex-col items-center justify-start p-3 gap-2">
            {/* Main Overlay */}
            <Overlay
                messages={activeChat?.messages || []}
                status={status}
                isConnected={isConnected}
                chatName={activeChat?.name}
                onNewChat={handleNewChat}
                onShowHistory={() => setShowHistory(true)}
                user={auth.user}
                onLogout={auth.logout}
            />

            {/* Audio Controls */}
            <div className="glass rounded-xl p-3 border border-cyber-blue/30 w-[480px] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <AudioCapture
                            onTranscription={handleTranscription}
                            onAudioCapture={handleAudioCapture}
                            isRecording={isRecording}
                            setIsRecording={setIsRecording}
                        />
                    </div>
                    {/* Back to setup */}
                    <button
                        onClick={handleBackToSetup}
                        className="text-[10px] text-gray-500 hover:text-cyber-cyan font-mono 
                            px-2 py-1 rounded-lg glass border border-gray-700 
                            hover:border-cyber-cyan/30 transition-all"
                        title="Cambiar CV / Puesto"
                    >
                        ⚙️
                    </button>
                </div>

                {/* Context indicator */}
                {setupInfo && (setupInfo.cvUploaded || setupInfo.jobDescriptionSet) && (
                    <div className="mt-2 flex gap-2 text-[9px] font-mono">
                        {setupInfo.cvUploaded && (
                            <span className="text-green-400/70">✓ CV cargado</span>
                        )}
                        {setupInfo.jobDescriptionSet && (
                            <span className="text-green-400/70">✓ Puesto configurado</span>
                        )}
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="glass rounded-lg p-2 border border-red-500/30 w-[480px]">
                    <p className="text-red-400 text-xs font-mono">⚠️ {error}</p>
                </div>
            )}

            {/* Modals */}
            {showNewChatModal && (
                <NewChatModal
                    onConfirm={handleCreateChat}
                    onCancel={() => setShowNewChatModal(false)}
                />
            )}
            {showHistory && (
                <ChatHistory
                    chats={chats}
                    activeChatId={activeChatId}
                    onSwitch={switchChat}
                    onDelete={deleteChat}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}

export default App;
