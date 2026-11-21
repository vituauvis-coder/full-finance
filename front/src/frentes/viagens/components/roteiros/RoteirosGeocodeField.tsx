import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { geocodeSearch } from '../../api/trips';
import type { GeocodeHit } from '../../types';
import type { GeocodeSearchBias } from '../../utils/geocode-bias';
import {
    curateGeocodeHits,
    formatGeocodeHitOption,
    hasCjkScript,
    isLatinUiText
} from '../../utils/place-display';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    className?: string;
    inputClassName?: string;
    hitsClassName?: string;
    placeholder?: string;
    compact?: boolean;
    hideGoButton?: boolean;
    autoFocus?: boolean;
    /** Menos filtro na lista — melhor para picker de atividade */
    relaxedHits?: boolean;
    searchBias?: GeocodeSearchBias;
    onPick: (hit: GeocodeHit, searchQuery: string) => void;
};

export function RoteirosGeocodeField({
    className = 'rote-geocode',
    inputClassName,
    hitsClassName = 'rote-board__search-hits',
    placeholder = 'Cidade, bairro, loja, restaurante, shopping…',
    compact,
    hideGoButton,
    autoFocus,
    relaxedHits,
    searchBias,
    onPick
}: Props) {
    const [geoQ, setGeoQ] = useState('');
    const [geoHits, setGeoHits] = useState<GeocodeHit[]>([]);
    const [searching, setSearching] = useState(false);
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    const fetchGeocode = useCallback(async (q: string) => {
        if (q.length < 2) {
            setGeoHits([]);
            return;
        }
        setSearching(true);
        try {
            let { hits } = await geocodeSearch(q, searchBias);
            let usable = curateGeocodeHits(q, hits, {
                limit: 5,
                countryCodes: searchBias?.countryCodes
            }) as GeocodeHit[];
            if (!usable.length && searchBias?.countryCodes) {
                const retry = await geocodeSearch(q, { ...searchBias, countryCodes: undefined });
                usable = curateGeocodeHits(q, retry.hits, { limit: 5 }) as GeocodeHit[];
            }
            if (!relaxedHits) {
                usable = usable.filter((h) => {
                    const opt = formatGeocodeHitOption(h, q);
                    return isLatinUiText(opt.title) && !hasCjkScript(opt.title);
                });
            }
            setGeoHits(usable);
        } finally {
            setSearching(false);
        }
    }, [relaxedHits, searchBias]);

    useEffect(() => {
        const q = geoQ.trim();
        if (q.length < 2) {
            setGeoHits([]);
            return;
        }
        const timer = window.setTimeout(() => void fetchGeocode(q), 280);
        return () => window.clearTimeout(timer);
    }, [geoQ, fetchGeocode]);

    useEffect(() => {
        if (!autoFocus) return;
        const t = window.setTimeout(() => inputRef.current?.focus(), 50);
        return () => window.clearTimeout(t);
    }, [autoFocus]);

    function pick(hit: GeocodeHit) {
        if ((hit.kind ?? '').trim() === 'country') return;
        if (!Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return;
        onPick(hit, geoQ.trim());
        setGeoQ('');
        setGeoHits([]);
    }

    const qLen = geoQ.trim().length;
    const showHits = qLen >= 2;

    const listClassName = ['rote-board__search-hits', hitsClassName].filter(Boolean).join(' ');

    return (
        <div
            className={[
                className,
                compact ? 'rote-geocode--compact' : '',
                showHits ? 'rote-geocode--open' : ''
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="rote-board__search-wrap">
                <MaterialIcon name="search" variant="app" opticalSize={compact ? 18 : 20} />
                <input
                    ref={inputRef}
                    type="search"
                    className={['viagens-field rote-board__search-input', inputClassName ?? ''].join(' ')}
                    value={geoQ}
                    onChange={(e) => setGeoQ(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (geoHits[0]) pick(geoHits[0]);
                            else void fetchGeocode(geoQ.trim());
                        }
                    }}
                    placeholder={placeholder}
                    aria-label="Buscar lugar"
                    aria-expanded={showHits}
                    aria-controls={listId}
                    autoComplete="off"
                />
                {hideGoButton ? null : (
                    <button
                        type="button"
                        className="rote-board__search-go viagens-btn viagens-btn--ghost"
                        disabled={searching || geoQ.trim().length < 2}
                        onClick={() => void fetchGeocode(geoQ.trim())}
                    >
                        {searching ? '…' : compact ? 'OK' : 'Buscar'}
                    </button>
                )}
            </div>
            {showHits ? (
                <ul id={listId} className={listClassName} role="listbox">
                    {searching && geoHits.length === 0 ? (
                        <li className="rote-board__search-hits-empty" role="presentation">
                            Buscando…
                        </li>
                    ) : null}
                    {!searching && geoHits.length === 0 ? (
                        <li className="rote-board__search-hits-empty" role="presentation">
                            Nenhum lugar. Tente cidade, bairro ou POI.
                        </li>
                    ) : null}
                    {geoHits.map((h, i) => {
                        const opt = formatGeocodeHitOption(h, geoQ.trim());
                        return (
                            <li key={`${h.latitude}-${h.longitude}-${h.kind}-${i}`} role="option">
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        pick(h);
                                    }}
                                >
                                    <MaterialIcon name={opt.icon} variant="app" opticalSize={16} />
                                    <span className="rote-geocode-hit__text">
                                        <span className="rote-geocode-hit__title">
                                            {opt.title}
                                            <span
                                                className={`rote-geocode-hit__badge rote-geocode-hit__badge--${opt.badgeTone}`}
                                            >
                                                {opt.badge}
                                            </span>
                                        </span>
                                        {opt.subtitle ? (
                                            <span className="rote-geocode-hit__subtitle">{opt.subtitle}</span>
                                        ) : null}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}