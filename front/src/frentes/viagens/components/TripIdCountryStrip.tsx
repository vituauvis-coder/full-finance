import { useEffect, useMemo, useState } from 'react';
import { canonicalCountryLabel } from '@motor/viagens/trip-countries.js';
import {
    convertLocalAmountToBrl,
    countryTravelBrief,
    formatFxUnitRate,
    parseTripMoneyAmount
} from '@motor/viagens/trip-country-travel.js';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { TaxFxQuotes } from '../api/trips';
import type { TripCheckItem, TripCountryTravelNote } from '../types';
import type { TripDraft } from './ViagemFicha';
import {
    appendCountryCheckItems,
    checksForCountryField,
    type CountryCheckField,
    markCountryChecksSeeded,
    seedTextForField,
    splitCountryNoteItems
} from '../domain/tripCountryChecks';
import {
    patchCheckInList,
    removeCheckFromList,
    toggleCheckPatch
} from '../domain/tripChecklistUtils';
import { formatBRL } from '../utils/map-utils';
import { CountryFlag } from './CountryFlag';
import { TripIdCountryChecklist } from './TripIdCountryChecklist';

type Props = {
    countries: string[];
    quotes: TaxFxQuotes | null;
    quotesLoading?: boolean;
    checks: TripCheckItem[];
    notes: Record<string, TripCountryTravelNote>;
    onPatch: (fn: (d: TripDraft) => TripDraft) => void;
};

const TEXT_FIELDS: { key: CountryCheckField; label: string; icon: string }[] = [
    { key: 'requiredDocs', label: 'Documentos exigidos', icon: 'badge' },
    { key: 'paymentMethods', label: 'Forma de pagamento', icon: 'credit_card' },
    { key: 'internetChip', label: 'Internet / chip', icon: 'sim_card' }
];

type CountryCardModel = {
    country: string;
    currencyCode: string;
    currencyName: string;
    merged: TripCountryTravelNote;
    briefDefaults: Record<CountryCheckField, string>;
};

function mergeDefaults(
    brief: ReturnType<typeof countryTravelBrief>,
    saved: TripCountryTravelNote | undefined
): TripCountryTravelNote {
    return {
        localAmount: saved?.localAmount ?? '1',
        checksSeeded: saved?.checksSeeded,
        requiredDocs: saved?.requiredDocs ?? saved?.obligations ?? brief.requiredDocs,
        paymentMethods: saved?.paymentMethods ?? brief.paymentMethods,
        internetChip: saved?.internetChip ?? brief.internetChip
    };
}

function formatLocalAmountDisplay(raw: string | undefined, currencyCode: string) {
    const n = parseTripMoneyAmount(raw ?? '');
    if (n == null) return raw?.trim() ? raw.trim() : '—';
    const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(n);
    return `${formatted} ${currencyCode}`;
}

function brlFromNote(
    localAmount: string | undefined,
    currencyCode: string,
    quotes: TaxFxQuotes | null,
    loading: boolean
): string {
    if (loading && currencyCode !== 'BRL') return 'Buscando cotação…';
    const value = convertLocalAmountToBrl(localAmount, currencyCode, quotes?.rates ?? null);
    if (value == null) {
        const n = parseTripMoneyAmount(localAmount ?? '');
        if (n != null && currencyCode === 'BRL') return formatBRL(n);
        return 'Cotação indisponível';
    }
    return formatBRL(value);
}

function liveUnitRate(
    currencyCode: string,
    quotes: TaxFxQuotes | null,
    saved?: TripCountryTravelNote
): string | null {
    const live = formatFxUnitRate(currencyCode, quotes?.rates ?? null, formatBRL);
    if (live) return live;
    return saved?.fxQuoteText?.trim() || null;
}

function TripIdCountryCard({
    model,
    quotes,
    quotesLoading,
    checks,
    onPatch
}: {
    model: CountryCardModel;
    quotes: TaxFxQuotes | null;
    quotesLoading: boolean;
    checks: TripCheckItem[];
    onPatch: (fn: (d: TripDraft) => TripDraft) => void;
}) {
    const { country, currencyCode, currencyName, merged, briefDefaults } = model;
    const [editing, setEditing] = useState(false);
    const brlDisplay = brlFromNote(merged.localAmount, currencyCode, quotes, quotesLoading);
    const unitRate = liveUnitRate(currencyCode, quotes, merged);

    function fieldItems(field: CountryCheckField) {
        return checksForCountryField(checks, country, field);
    }

    function patchCheck(id: string, patch: Partial<TripCheckItem>) {
        onPatch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                checks: patchCheckInList(d.payload.checks ?? [], id, patch)
            }
        }));
    }

    function removeCheck(id: string) {
        onPatch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                checks: removeCheckFromList(d.payload.checks ?? [], id)
            }
        }));
    }

    function addCheck(field: CountryCheckField) {
        const countryKey = canonicalCountryLabel(country);
        onPatch((d) => {
            const list = d.payload.checks ?? [];
            return {
                ...d,
                payload: {
                    ...d.payload,
                    checks: [
                        ...list,
                        {
                            id: crypto.randomUUID(),
                            title: '',
                            done: false,
                            countryCheck: { country: countryKey, field }
                        }
                    ]
                }
            };
        });
    }

    return (
        <article className={`trip-id-destino${editing ? ' trip-id-destino--edit' : ''}`}>
            <header className="trip-id-destino__head">
                <CountryFlag label={country} size="ticket" />
                <h4>{country}</h4>
                <span className="trip-id-destino__currency">{currencyName}</span>
                {editing ? (
                    <button type="button" className="trip-id-destino__action trip-id-destino__action--done" onClick={() => setEditing(false)}>
                        <MaterialIcon name="check" variant="app" opticalSize={17} />
                        Pronto
                    </button>
                ) : (
                    <button type="button" className="trip-id-destino__action" onClick={() => setEditing(true)}>
                        <MaterialIcon name="edit" variant="app" opticalSize={17} />
                        Editar
                    </button>
                )}
            </header>

            {editing ? (
                <div className="trip-id-destino__tiles trip-id-destino__tiles--edit">
                    <div className="trip-id-fx">
                        <label className="trip-id-fx__cell">
                            <span className="trip-id-tile__label">
                                <MaterialIcon name="payments" variant="app" opticalSize={16} />
                                Moeda local
                            </span>
                            <div className="trip-id-fx__amount-wrap">
                                <input
                                    className="viagens-field trip-id-input trip-id-fx__input"
                                    inputMode="decimal"
                                    value={merged.localAmount ?? ''}
                                    onChange={(e) =>
                                        onPatch((d) => {
                                            const prev = d.payload.countryTravelNotes ?? d.payload.country_travel_notes ?? {};
                                            return {
                                                ...d,
                                                payload: {
                                                    ...d.payload,
                                                    countryTravelNotes: {
                                                        ...prev,
                                                        [country]: { ...prev[country], localAmount: e.target.value }
                                                    },
                                                    country_travel_notes: {
                                                        ...prev,
                                                        [country]: { ...prev[country], localAmount: e.target.value }
                                                    }
                                                }
                                            };
                                        })
                                    }
                                    placeholder="Ex.: 100"
                                    aria-label={`Valor na moeda local (${currencyCode})`}
                                />
                                <span className="trip-id-fx__code">{currencyCode}</span>
                            </div>
                        </label>
                        <div className="trip-id-fx__cell trip-id-fx__cell--brl">
                            <span className="trip-id-tile__label">
                                <MaterialIcon name="currency_exchange" variant="app" opticalSize={16} />
                                Valor em real
                            </span>
                            <output className="trip-id-fx__brl" aria-live="polite">
                                {brlDisplay}
                            </output>
                            {unitRate ? <span className="trip-id-fx__hint">{unitRate}</span> : null}
                        </div>
                    </div>
                    {TEXT_FIELDS.map((f) => (
                        <div key={f.key} className="trip-id-tile trip-id-tile--line">
                            <span className="trip-id-tile__label">
                                <MaterialIcon name={f.icon} variant="app" opticalSize={16} />
                                {f.label}
                            </span>
                            <TripIdCountryChecklist
                                items={fieldItems(f.key)}
                                editing={editing}
                                onToggle={(id, done) => patchCheck(id, toggleCheckPatch(done))}
                                onTitle={(id, title) => patchCheck(id, { title })}
                                onRemove={removeCheck}
                                onAdd={() => addCheck(f.key)}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <ul className="trip-id-destino__rows">
                    <li className="trip-id-row trip-id-row--fx">
                        <span className="trip-id-row__icon" aria-hidden>
                            <MaterialIcon name="currency_exchange" variant="app" opticalSize={18} />
                        </span>
                        <div className="trip-id-row__fx-pair">
                            <div className="trip-id-row__fx-col">
                                <span className="trip-id-row__label">Moeda local</span>
                                <p className="trip-id-row__value">{formatLocalAmountDisplay(merged.localAmount, currencyCode)}</p>
                            </div>
                            <div className="trip-id-row__fx-col">
                                <span className="trip-id-row__label">Valor em real</span>
                                <p className="trip-id-row__value trip-id-row__value--brl">{brlDisplay}</p>
                                {unitRate ? <p className="trip-id-row__rate">{unitRate}</p> : null}
                            </div>
                        </div>
                    </li>
                    {TEXT_FIELDS.map((f) => (
                        <li key={f.key} className="trip-id-row trip-id-row--checks">
                            <span className="trip-id-row__icon" aria-hidden>
                                <MaterialIcon name={f.icon} variant="app" opticalSize={18} />
                            </span>
                            <div className="trip-id-row__body">
                                <span className="trip-id-row__label">{f.label}</span>
                                <TripIdCountryChecklist
                                    items={fieldItems(f.key)}
                                    editing={false}
                                    onToggle={(id, done) => patchCheck(id, toggleCheckPatch(done))}
                                    onTitle={(id, title) => patchCheck(id, { title })}
                                    onRemove={removeCheck}
                                    onAdd={() => addCheck(f.key)}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
}

export function TripIdCountryStrip({
    countries,
    quotes,
    quotesLoading = false,
    checks,
    notes,
    onPatch
}: Props) {
    const cards = useMemo(
        () =>
            countries.map((c) => {
                const brief = countryTravelBrief(c);
                const merged = mergeDefaults(brief, notes[brief.country]);
                return {
                    country: brief.country,
                    currencyCode: brief.currency.code || 'BRL',
                    currencyName: brief.currencyLabel,
                    merged,
                    briefDefaults: {
                        requiredDocs: brief.requiredDocs,
                        paymentMethods: brief.paymentMethods,
                        internetChip: brief.internetChip
                    }
                } satisfies CountryCardModel;
            }),
        [countries, notes]
    );

    useEffect(() => {
        if (!quotes?.rates || quotesLoading) return;
        for (const { country, currencyCode } of cards) {
            const saved = notes[country];
            if (saved?.fxQuoteAsOf === quotes.asOf && saved?.fxQuoteText?.trim()) continue;
            const line = formatFxUnitRate(currencyCode, quotes.rates, formatBRL);
            if (!line) continue;
            onPatch((d) => {
                const prev = d.payload.countryTravelNotes ?? d.payload.country_travel_notes ?? {};
                return {
                    ...d,
                    payload: {
                        ...d.payload,
                        countryTravelNotes: { ...prev, [country]: { ...prev[country], fxQuoteText: line, fxQuoteAsOf: quotes.asOf } },
                        country_travel_notes: { ...prev, [country]: { ...prev[country], fxQuoteText: line, fxQuoteAsOf: quotes.asOf } }
                    }
                };
            });
        }
    }, [quotes, quotesLoading, cards, notes, onPatch]);

    useEffect(() => {
        for (const card of cards) {
            for (const f of TEXT_FIELDS) {
                const existing = checksForCountryField(checks, card.country, f.key);
                if (existing.length > 0) continue;
                if (card.merged.checksSeeded?.[f.key]) continue;
                const seed = seedTextForField(card.merged, f.key, card.briefDefaults[f.key]);
                const titles = splitCountryNoteItems(seed);
                if (!titles.length) {
                    onPatch((d) => {
                        const prevNotes = d.payload.countryTravelNotes ?? d.payload.country_travel_notes ?? {};
                        const nextNotes = markCountryChecksSeeded(prevNotes, card.country, f.key);
                        return {
                            ...d,
                            payload: { ...d.payload, countryTravelNotes: nextNotes, country_travel_notes: nextNotes }
                        };
                    });
                    continue;
                }
                onPatch((d) => {
                    const prevNotes = d.payload.countryTravelNotes ?? d.payload.country_travel_notes ?? {};
                    const nextNotes = markCountryChecksSeeded(prevNotes, card.country, f.key);
                    const nextChecks = appendCountryCheckItems(d.payload.checks ?? [], card.country, f.key, titles);
                    return {
                        ...d,
                        payload: {
                            ...d.payload,
                            checks: nextChecks,
                            countryTravelNotes: nextNotes,
                            country_travel_notes: nextNotes
                        }
                    };
                });
            }
        }
    }, [cards, checks, onPatch]);

    if (!cards.length) return null;

    return (
        <div className="trip-id-destinos__stack">
            {cards.map((model) => (
                <TripIdCountryCard
                    key={model.country}
                    model={model}
                    quotes={quotes}
                    quotesLoading={quotesLoading}
                    checks={checks}
                    onPatch={onPatch}
                />
            ))}
        </div>
    );
}