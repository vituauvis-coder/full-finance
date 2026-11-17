import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/http';

type AuthUser = { uid: string; email: string; role: string; isAdmin?: boolean };

type AuthCtx = {
    loading: boolean;
    user: AuthUser | null;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<AuthUser | null>(null);

    const refresh = useCallback(async () => {
        const data = await apiFetch('/api/auth/me');
        setUser(data.user);
    }, []);

    const logout = useCallback(async () => {
        await apiFetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
    }, []);

    useEffect(() => {
        void (async () => {
            try {
                await refresh();
            } catch {
                setUser(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [refresh]);

    const value = useMemo(() => ({ loading, user, refresh, logout }), [loading, user, refresh, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth outside AuthProvider');
    return ctx;
}