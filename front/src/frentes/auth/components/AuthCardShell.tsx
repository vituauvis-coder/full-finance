import type { ReactNode } from 'react';

type Props = {
    children: ReactNode;
};

/** Borda em gradiente + glow ao redor do cartão de login/cadastro. */
export function AuthCardShell({ children }: Props) {
    return <div className="auth-card-shell">{children}</div>;
}