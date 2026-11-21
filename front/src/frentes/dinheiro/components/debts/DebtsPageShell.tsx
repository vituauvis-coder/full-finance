import type { ReactNode } from 'react';

type Props = {
    children: ReactNode;
};

export function DebtsPageShell({ children }: Props) {
    return (
        <section id="debts-page" className="page active debts-page debts-page--modern" aria-label="Dívidas">
            {children}
        </section>
    );
}