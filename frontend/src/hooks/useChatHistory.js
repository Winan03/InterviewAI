import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'vozinterview_chats';

/**
 * Custom hook for managing chat history with localStorage persistence.
 * 
 * Each chat has:
 * - id: unique identifier
 * - name: display name
 * - createdAt: timestamp
 * - messages: array of { type, content, timestamp }
 */
export function useChatHistory() {
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);

    // Load chats from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setChats(parsed);
                // Set active to the most recent chat
                if (parsed.length > 0) {
                    setActiveChatId(parsed[parsed.length - 1].id);
                }
            }
        } catch (e) {
            console.error('Error loading chats:', e);
        }
    }, []);

    // Save to localStorage whenever chats change
    useEffect(() => {
        if (chats.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
            } catch (e) {
                console.error('Error saving chats:', e);
            }
        }
    }, [chats]);

    // Get the active chat
    const activeChat = chats.find(c => c.id === activeChatId) || null;

    // Create a new chat
    const createChat = useCallback((name = null) => {
        const id = `chat_${Date.now()}`;
        const newChat = {
            id,
            name: name || `Entrevista ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`,
            createdAt: new Date().toISOString(),
            messages: []
        };
        setChats(prev => [...prev, newChat]);
        setActiveChatId(id);
        return id;
    }, []);

    // Ensure there's always an active chat
    const ensureActiveChat = useCallback(() => {
        if (!activeChatId || !chats.find(c => c.id === activeChatId)) {
            return createChat();
        }
        return activeChatId;
    }, [activeChatId, chats, createChat]);

    // Add a message to the active chat
    const addMessage = useCallback((type, content) => {
        const chatId = activeChatId || createChat();

        setChats(prev => prev.map(chat => {
            if (chat.id === chatId) {
                const newMessages = [...chat.messages, {
                    type, // 'transcription', 'ai_response', 'status'
                    content,
                    timestamp: new Date().toISOString()
                }];

                // Auto-name from first transcription if still default name
                let name = chat.name;
                if (type === 'transcription' && chat.messages.filter(m => m.type === 'transcription').length === 0) {
                    // First transcription - auto-generate name
                    const words = content.split(' ').slice(0, 5).join(' ');
                    name = words.length > 30 ? words.substring(0, 30) + '...' : words;
                }

                return { ...chat, messages: newMessages, name };
            }
            return chat;
        }));
    }, [activeChatId, createChat]);

    // Delete a chat
    const deleteChat = useCallback((chatId) => {
        setChats(prev => {
            const filtered = prev.filter(c => c.id !== chatId);
            if (chatId === activeChatId && filtered.length > 0) {
                setActiveChatId(filtered[filtered.length - 1].id);
            } else if (filtered.length === 0) {
                setActiveChatId(null);
            }
            if (filtered.length === 0) {
                localStorage.removeItem(STORAGE_KEY);
            }
            return filtered;
        });
    }, [activeChatId]);

    // Switch active chat
    const switchChat = useCallback((chatId) => {
        setActiveChatId(chatId);
    }, []);

    // Rename a chat
    const renameChat = useCallback((chatId, newName) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, name: newName } : chat
        ));
    }, []);

    return {
        chats,
        activeChat,
        activeChatId,
        createChat,
        ensureActiveChat,
        addMessage,
        deleteChat,
        switchChat,
        renameChat
    };
}
