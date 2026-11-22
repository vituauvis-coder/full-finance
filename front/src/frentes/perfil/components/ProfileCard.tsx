import type { ReactNode } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

export type ProfileBentoSlot = 'half' | 'full';

type Props = {
    slot: ProfileBentoSlot | false;
    variant?: 'default' | 'identity' | 'danger';
    title?: string;
    subtitle?: string;
    icon?: string;
    iconAccent?: boolean;
    ariaLabel?: string;
    children: ReactNode;
};

export function ProfileCard({
    slot,
    variant = 'default',
    title,
    subtitle,
    icon,
    iconAccent,
    ariaLabel,
    children
}: Props) {
    const cardClass = [
        'profile-modern__card',
        variant === 'identity' ? 'profile-modern__card--identity' : '',
        variant === 'danger' ? 'profile-modern__card--danger' : ''
    ]
        .filter(Boolean)
        .join(' ');

    const bentoClass =
        slot === false
            ? ''
            : `profile-modern__bento-cell profile-modern__bento-cell--${slot}`;

    return (
        <article className={`${cardClass} ${bentoClass}`.trim()} aria-label={ariaLabel}>
            {title ? (
                <header className="profile-modern__card-head">
                    {icon ? (
                        <span
                            className={`profile-modern__card-icon${iconAccent ? ' profile-modern__card-icon--accent' : ''}`}
                            aria-hidden="true"
                        >
                            <MaterialIcon name={icon} variant="app" />
                        </span>
                    ) : null}
                    <div>
                        <h3 className="profile-modern__card-title">{title}</h3>
                        {subtitle ? <p className="profile-modern__card-sub">{subtitle}</p> : null}
                    </div>
                </header>
            ) : null}
            <div className="profile-modern__card-body">{children}</div>
        </article>
    );
}