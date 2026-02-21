import { useState, useRef, useEffect, useCallback } from 'react';

// Check if running in Electron
const isElectron = () => {
    return navigator.userAgent.toLowerCase().includes('electron');
};

/**
 * AudioCapture component with system audio capture for Electron.
 * In Electron: captures system audio (what plays through speakers/headphones)
 * In Chrome: uses Web Speech API (microphone)
 */
export function AudioCapture({ onTranscription, onAudioCapture, isRecording, setIsRecording }) {
    const [audioLevel, setAudioLevel] = useState(0);
    const [interimText, setInterimText] = useState('');
    const [mode, setMode] = useState('detecting');

    const recognitionRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const chunksRef = useRef([]);
    const sendIntervalRef = useRef(null);

    // ─── Get system audio stream in Electron ───
    const getSystemAudioStream = async () => {
        if (!isElectron()) return null;

        try {
            // Use Electron's desktopCapturer to get screen sources
            const { ipcRenderer } = window.require('electron');
            const sources = await ipcRenderer.invoke('get-desktop-sources');

            if (!sources || sources.length === 0) {
                console.error('No desktop sources found');
                return null;
            }

            // Get the first screen source
            const screenSource = sources.find(s => s.id.startsWith('screen:')) || sources[0];
            console.log('🖥️ Using source:', screenSource.name);

            // Request system audio via desktop capture
            // We must request video too (Chromium requirement), but we'll discard it
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: screenSource.id
                    }
                },
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: screenSource.id,
                        minWidth: 1,
                        maxWidth: 1,
                        minHeight: 1,
                        maxHeight: 1
                    }
                }
            });

            // Remove video tracks - we only need audio
            stream.getVideoTracks().forEach(track => {
                track.stop();
                stream.removeTrack(track);
            });

            console.log('🔊 System audio stream obtained!');
            console.log('   Audio tracks:', stream.getAudioTracks().length);

            return stream;

        } catch (error) {
            console.error('❌ Error getting system audio:', error);
            return null;
        }
    };

    // ─── Setup audio visualization ───
    const setupVisualization = (stream) => {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const visualize = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setAudioLevel(Math.min(100, (average / 255) * 100 * 2.5));
            animFrameRef.current = requestAnimationFrame(visualize);
        };
        visualize();
    };

    // ─── START RECORDING ───
    const startRecording = useCallback(async () => {
        try {
            let stream;

            if (isElectron()) {
                // Electron: capture SYSTEM audio
                stream = await getSystemAudioStream();
                if (stream && stream.getAudioTracks().length > 0) {
                    setMode('system');
                    setupVisualization(stream);
                    startMediaRecorder(stream);
                } else {
                    // Fallback to microphone in Electron
                    console.warn('⚠️ System audio not available, using microphone');
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: { echoCancellation: true, noiseSuppression: true }
                    });
                    setMode('mic-server');
                    setupVisualization(stream);
                    startMediaRecorder(stream);
                }
            } else {
                // Browser: use Web Speech API with microphone
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                });
                setMode('speech-api');
                setupVisualization(stream);
                startSpeechRecognition();
            }

            streamRef.current = stream;

        } catch (error) {
            console.error('Error starting recording:', error);
            setIsRecording(false);
        }
    }, [onTranscription, onAudioCapture, setIsRecording]);

    // ─── WEB SPEECH API (Browser mode) ───
    const startSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Web Speech API not supported');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (interimTranscript) setInterimText(interimTranscript);
            if (finalTranscript.trim()) {
                setInterimText('');
                onTranscription(finalTranscript.trim());
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech') return;
            console.warn('Speech API error:', event.error);
        };

        recognition.onend = () => {
            if (recognitionRef.current) {
                try { recognition.start(); } catch (e) { }
            }
        };

        recognition.start();
        recognitionRef.current = recognition;
    };

    // ─── MEDIA RECORDER (System audio / Electron mode) ───
    const startMediaRecorder = (stream) => {
        // Check supported MIME types
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose
        }

        const options = mimeType ? { mimeType } : {};
        const mediaRecorder = new MediaRecorder(stream, options);
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunksRef.current.push(event.data);
            }
        };

        // When recorder stops (pause or end), flush accumulated audio immediately
        mediaRecorder.onstop = () => {
            flushAudio(mimeType);
        };

        // Record continuously, fire ondataavailable every 15 seconds
        mediaRecorder.start(15000);
        mediaRecorderRef.current = mediaRecorder;

        // Also auto-send every 16s for long uninterrupted recordings
        sendIntervalRef.current = setInterval(() => {
            if (chunksRef.current.length > 0 && onAudioCapture && mediaRecorderRef.current) {
                // Request data from recorder (triggers ondataavailable), then flush
                try {
                    mediaRecorderRef.current.requestData();
                } catch (e) { }
                // Small delay to let ondataavailable fire first
                setTimeout(() => flushAudio(mimeType), 200);
            }
        }, 16000);
    };

    // ─── FLUSH AUDIO TO BACKEND ───
    const flushAudio = (mimeType) => {
        if (chunksRef.current.length === 0 || !onAudioCapture) return;

        const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = []; // Clear immediately

        // Only send substantial audio (>5KB)
        if (audioBlob.size > 5000) {
            console.log(`🔊 Sending ${(audioBlob.size / 1024).toFixed(1)}KB audio`);
            onAudioCapture(audioBlob);
        } else {
            console.log(`⏸️ Chunk too small (${audioBlob.size}B), skipping`);
        }
    };

    // ─── STOP RECORDING ───
    const stopRecording = useCallback(() => {
        // Stop Web Speech API
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        // Stop interval timer first
        if (sendIntervalRef.current) {
            clearInterval(sendIntervalRef.current);
            sendIntervalRef.current = null;
        }

        // Stop MediaRecorder — this triggers onstop which flushes remaining audio
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop(); // → onstop → flushAudio()
            mediaRecorderRef.current = null;
        }

        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        chunksRef.current = [];
        setAudioLevel(0);
        setInterimText('');
        setMode('detecting');
    }, [onAudioCapture]);

    useEffect(() => {
        if (isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
        return () => stopRecording();
    }, [isRecording]);

    // Mode labels
    const getModeLabel = () => {
        switch (mode) {
            case 'system': return '🔊 SYSTEM AUDIO';
            case 'mic-server': return '🎤 RECORDING';
            case 'speech-api': return '🎤 LISTENING';
            default: return '...';
        }
    };

    return (
        <div className="flex items-center gap-3">
            {/* Recording Button */}
            <button
                onClick={() => setIsRecording(!isRecording)}
                className={`
                    relative w-12 h-12 rounded-full transition-all duration-300 flex-shrink-0
                    ${isRecording
                        ? 'bg-gradient-to-br from-cyber-magenta to-cyber-purple shadow-neon-magenta'
                        : 'bg-gradient-to-br from-cyber-cyan to-cyber-blue shadow-neon-cyan hover:scale-110'
                    }
                `}
            >
                {isRecording ? (
                    <div className="w-4 h-4 bg-white rounded-sm mx-auto" />
                ) : (
                    <div className="w-6 h-6 bg-white rounded-full mx-auto" />
                )}
                {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-cyber-magenta animate-ping opacity-75" />
                )}
            </button>

            {/* Audio Level */}
            {isRecording && (
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="h-4 glass rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-cyber-cyan via-cyber-blue to-cyber-purple transition-all duration-100"
                            style={{ width: `${audioLevel}%` }}
                        />
                    </div>
                    {interimText && (
                        <p className="text-xs text-cyber-cyan/60 font-mono truncate italic">
                            🎙️ {interimText}
                        </p>
                    )}
                </div>
            )}

            {/* Status */}
            <span className="text-xs neon-text font-mono whitespace-nowrap flex-shrink-0">
                {isRecording ? (
                    <span className="text-cyber-magenta">{getModeLabel()}</span>
                ) : (
                    <span className="text-cyber-cyan">⬤ READY</span>
                )}
            </span>
        </div>
    );
}
