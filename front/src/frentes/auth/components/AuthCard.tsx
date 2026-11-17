import type { ReactNode } from 'react';

type Props = {
    title: string;
    titleId?: string;
    subtitle: string;
    children: ReactNode;
};

export function AuthCard({ title, titleId, subtitle, children }: Props) {
    return (
        <div className="auth-box auth-box--hero" data-auth-card>
            <header className="auth-form-header">
                <h2 id={titleId} className="auth-title">
                    {title}
                </h2>
                <p className="auth-subtitle">{subtitle}</p>
            </header>
            {children}
        </div>
    );
}