import { useState, useEffect, useRef } from 'react';

const WS_BASE = 'ws://localhost:8000/ws/audio';

export function useWebSocket(token) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const [error, setError] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const tokenRef = useRef(token);

    // Keep token ref updated
    tokenRef.current = token;

    const connect = () => {
        try {
            // Append JWT token as query param if available
            const wsUrl = tokenRef.current
                ? `${WS_BASE}?token=${tokenRef.current}`
                : WS_BASE;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('Connection error');
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);

                // Auto-reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    connect();
                }, 3000);
            };

            wsRef.current = ws;
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            setError('Failed to connect');
        }
    };

    const disconnect = () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    };

    const sendMessage = (message) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not connected');
            setError('Not connected');
        }
    };

    const sendAudio = (audioBlob, format = 'webm') => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64Audio = reader.result.split(',')[1];
            sendMessage({
                type: 'audio',
                data: base64Audio,
                format: format
            });
        };
        reader.readAsDataURL(audioBlob);
    };

    const sendText = (text) => {
        sendMessage({
            type: 'text',
            data: text
        });
    };

    useEffect(() => {
        connect();
        return () => disconnect();
    }, []);

    // Heartbeat to keep connection alive
    useEffect(() => {
        if (!isConnected) return;

        const interval = setInterval(() => {
            sendMessage({ type: 'ping' });
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [isConnected]);

    return {
        isConnected,
        lastMessage,
        error,
        sendMessage,
        sendAudio,
        sendText,
        reconnect: connect
    };
}
