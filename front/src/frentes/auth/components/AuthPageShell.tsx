import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '../hooks/useAuthGate';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';
import { AuthLandingLayout } from './AuthLandingLayout';

type Props = {
    ariaLabel: string;
    children: ReactNode;
};

/** Redireciona se já autenticado; exibe loading mínimo enquanto valida sessão. */
export function AuthPageShell({ ariaLabel, children }: Props) {
    const { user, loading, isAuthenticated } = useAuthGate();

    if (loading) {
        return (
            <div className="auth-container auth-container--loading">
                <ScreenLoader variant="fullscreen" label="Verificando sessão" />
            </div>
        );
    }

    if (isAuthenticated && user) {
        return <Navigate to="/dashboard" replace />;
    }

    return <AuthLandingLayout ariaLabel={ariaLabel}>{children}</AuthLandingLayout>;
}