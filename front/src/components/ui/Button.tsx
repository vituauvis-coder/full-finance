import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost';
};

export function Button({ variant = 'ghost', className = '', ...props }: Props) {
    const cls = ['ui-btn', variant === 'primary' ? 'ui-btn--primary' : 'ui-btn--ghost', className].filter(Boolean).join(' ');
    return <button type="button" className={cls} {...props} />;
}