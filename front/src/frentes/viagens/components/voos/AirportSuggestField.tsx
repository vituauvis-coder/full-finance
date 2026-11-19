import { useEffect, useId, useState } from 'react';
import { searchAirportsCatalog, airportLabel } from '@motor/viagens/airports-catalog.js';
import { searchAirports, type AirportHit } from '../../api/trips';

type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

function rowCopy(h: AirportHit) {
    const city = h.city?.trim() || '';
    const name = h.name?.trim() || '';
    const title = city && city.length < 32 ? city : name || city;
    const sub = [name && name !== title ? name : null, h.country].filter(Boolean).join(' · ');
    return { title, sub };
}

export function AirportSuggestField({ label, value, onChange, className }: Props) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [hits, setHits] = useState<AirportHit[]>([]);

    useEffect(() => {
        const q = value.trim();
        if (q.length < 1) {
            setHits([]);
            return;
        }
        const local = searchAirportsCatalog(q, 6).map((a) => ({
            iata: a.iata,
            name: a.name,
            city: a.city,
            country: a.country,
            label: airportLabel(a),
            kind: 'airport'
        }));
        setHits(local);
        if (local.length >= 4 || q.length < 2) return;
        const t = setTimeout(() => {
            void searchAirports(q)
                .then((res) => {
                    const extra = res.hits ?? [];
                    const seen = new Set(local.map((h) => h.label.toLowerCase()));
                    const merged = [...local];
                    for (const hit of extra) {
                        if (seen.has(hit.label.toLowerCase())) continue;
                        seen.add(hit.label.toLowerCase());
                        merged.push(hit);
                    }
                    setHits(merged.slice(0, 8));
                })
                .catch(() => undefined);
        }, 280);
        return () => clearTimeout(t);
    }, [value]);

    return (
        <label className={['voos-field', className].filter(Boolean).join(' ')}>
            <span>{label}</span>
            <input
                id={id}
                className="viagens-field"
                value={value}
                autoComplete="off"
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 180)}
            />
            {open && hits.length > 0 ? (
                <ul className="voos-suggest" role="listbox">
                    {hits.map((h) => {
                        const { title, sub } = rowCopy(h);
                        return (
                            <li key={`${h.iata ?? ''}-${h.label}`}>
                                <button
                                    type="button"
                                    className={h.iata ? undefined : 'is-plain'}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onChange(h.label);
                                        setOpen(false);
                                    }}
                                >
                                    {h.iata ? <b>{h.iata}</b> : null}
                                    <span>
                                        <strong>{title}</strong>
                                        {sub ? <small>{sub}</small> : null}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </label>
    );
}
