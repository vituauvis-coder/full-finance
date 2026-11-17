import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
    children: ReactNode;
};

export function AuthFormToggle({ children }: Props) {
    return <p className="auth-toggle">{children}</p>;
}

export function AuthFormLink({ to, children }: { to: string; children: ReactNode }) {
    return <Link to={to}>{children}</Link>;
}