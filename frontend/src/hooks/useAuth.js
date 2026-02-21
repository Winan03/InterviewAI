import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8000';
const TOKEN_KEY = 'voz_token';
const USER_KEY = 'voz_user';

/**
 * Auth hook — manages JWT authentication state.
 * Persists token + user in localStorage.
 * Validates existing token on mount via /api/auth/me.
 */
export function useAuth() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const isAuthenticated = !!token && !!user;

    // Save auth state to localStorage
    const persistAuth = (accessToken, userData) => {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setToken(accessToken);
        setUser(userData);
        setError(null);
    };

    // Clear auth state
    const clearAuth = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    };

    // Validate existing token on mount
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);

        if (!savedToken || !savedUser) {
            setIsLoading(false);
            return;
        }

        // Verify token is still valid
        fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${savedToken}` },
        })
            .then(res => {
                if (!res.ok) throw new Error('Token expired');
                return res.json();
            })
            .then(userData => {
                setToken(savedToken);
                setUser(userData);
            })
            .catch(() => {
                clearAuth();
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    // Register
    const register = useCallback(async (email, password, name) => {
        setError(null);
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });

        const data = await res.json();

        if (!res.ok) {
            const msg = data.detail || 'Error al registrar';
            setError(msg);
            throw new Error(msg);
        }

        persistAuth(data.access_token, data.user);
        return data.user;
    }, []);

    // Login
    const login = useCallback(async (email, password) => {
        setError(null);
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            const msg = data.detail || 'Credenciales incorrectas';
            setError(msg);
            throw new Error(msg);
        }

        persistAuth(data.access_token, data.user);
        return data.user;
    }, []);

    // Logout
    const logout = useCallback(() => {
        clearAuth();
    }, []);

    return {
        user,
        token,
        isAuthenticated,
        isLoading,
        error,
        register,
        login,
        logout,
    };
}
