import { countryFlagEmoji, countryIso2ForLabel } from '@motor/viagens/trip-countries.js';

type Props = {
    label: string;
  /** Exibir nome ao lado da bandeira. */
    showLabel?: boolean;
    /** Bilhete usa bandeiras maiores. */
    size?: 'chip' | 'ticket';
    className?: string;
};

function flagImageUrl(iso2: string, density: 1 | 2) {
    const iso = iso2.toLowerCase();
    const path = density === 2 ? `48x36` : `24x18`;
    return `https://flagcdn.com/${path}/${iso}.png`;
}

export function CountryFlag({ label, showLabel = false, size = 'chip', className }: Props) {
    const iso = countryIso2ForLabel(label);
    const emoji = iso ? countryFlagEmoji(iso) : '';
    const ticket = size === 'ticket';

    return (
        <span
            className={[className ?? 'country-flag', ticket ? 'country-flag--ticket-size' : ''].filter(Boolean).join(' ')}
            title={label}
        >
            {iso ? (
                <img
                    className="country-flag__img"
                    src={flagImageUrl(iso, 1)}
                    srcSet={`${flagImageUrl(iso, 2)} 2x`}
                    width={ticket ? 28 : 22}
                    height={ticket ? 21 : 16}
                    alt=""
                    loading="lazy"
                    decoding="async"
                />
            ) : emoji ? (
                <span className="country-flag__emoji" aria-hidden>
                    {emoji}
                </span>
            ) : (
                <span className="country-flag__fallback" aria-hidden>
                    {label.slice(0, 3).toUpperCase()}
                </span>
            )}
            {showLabel ? <span className="country-flag__name">{label}</span> : null}
        </span>
    );
}