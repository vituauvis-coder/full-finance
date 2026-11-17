import { useAuth } from '../../../app/AuthProvider';

/** Estado de sessão na rota pública (login/register). */
export function useAuthGate() {
    const { user, loading } = useAuth();
    return { user, loading, isAuthenticated: Boolean(user) };
}