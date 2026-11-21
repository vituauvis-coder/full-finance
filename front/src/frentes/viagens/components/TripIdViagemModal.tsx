import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseFinancePreferencesRaw } from '@motor/dinheiro/ui-chip-preferences.js';
import { canonicalCountryLabel, resolveTripCountries } from '@motor/viagens/trip-countries.js';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { getFinancePreferences } from '../../../lib/financePreferences';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { patchProfile } from '../../perfil/api/profileApi';
import { buildTravelRoster, travelerFromRosterPerson } from '../domain/tripTravelRoster';
import { useTaxFxQuotes } from '../hooks/useTaxFxQuotes';
import type { Trip, TripIdentityData, TripCountryTravelNote, TripTravelerIdentity } from '../types';
import type { TripDraft } from './ViagemFicha';
import { tripTicketRef, tripTicketStatusLabel, tripTicketStatus } from './tripTicketModel';
import { CountryFlag } from './CountryFlag';
import { TripIdCountryStrip } from './TripIdCountryStrip';
import { TripIdTravelerCard } from './TripIdTravelerCard';
import { toApiDayKey } from '@motor/viagens/calendar-format.js';
import '../styles/viagens-trip-id-modal.css';

type Props = {
    open: boolean;
    trip: Trip;
    draft: TripDraft;
    onClose: () => void;
    onPatch: (fn: (d: TripDraft) => TripDraft) => void;
};

function readIdentity(payload: Trip['payload']): TripIdentityData {
    return (payload.tripIdentity ?? payload.trip_identity ?? {}) as TripIdentityData;
}

function readCountryNotes(payload: Trip['payload']): Record<string, TripCountryTravelNote> {
    return (payload.countryTravelNotes ?? payload.country_travel_notes ?? {}) as Record<
        string,
        TripCountryTravelNote
    >;
}

function ensureTraveler(list: TripTravelerIdentity[] | undefined): TripTravelerIdentity[] {
    if (list?.length) return list;
    return [{ id: crypto.randomUUID(), fullName: '', passportNumber: '' }];
}

function travelDocPatchFromTraveler(t: TripTravelerIdentity) {
    return { passportNumber: t.passportNumber };
}

export function TripIdViagemModal({ open, trip, draft, onClose, onPatch }: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const profileSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fxSession, setFxSession] = useState(0);
    const { quotes, loading: quotesLoading } = useTaxFxQuotes({ enabled: open, refreshKey: fxSession });
    const { data: financeData, refresh: refreshFinance } = useFinanceData();

    const roster = useMemo(
        () => buildTravelRoster(financeData?.userProfile, financeData?.householdMembers),
        [financeData?.userProfile, financeData?.householdMembers]
    );
    const selfUserId = financeData?.userProfile?.id ?? null;

    const destinations = draft.payload.destinations ?? [];
    const countries = useMemo(
        () => resolveTripCountries(draft.payload, destinations),
        [draft.payload, destinations]
    );

    const identity = readIdentity(draft.payload);
    const travelers = ensureTraveler(identity.travelers);
    const countryNotes = readCountryNotes(draft.payload);
    const checks = draft.payload.checks ?? [];

    useEffect(() => {
        if (!open) return;
        void refreshFinance();
    }, [open, refreshFinance]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (open) setFxSession((k) => k + 1);
    }, [open]);

    function patchIdentity(next: TripIdentityData) {
        onPatch((d) => ({
            ...d,
            payload: { ...d.payload, tripIdentity: next, trip_identity: next }
        }));
    }

    useEffect(() => {
        if (!open || (identity.travelers?.length ?? 0) > 0) return;
        const self = roster.find((p) => p.isSelf);
        if (!self) return;
        patchIdentity({
            ...identity,
            travelers: [travelerFromRosterPerson(self, crypto.randomUUID()) as TripTravelerIdentity]
        });
    }, [open, roster, identity, onPatch]);

    const syncSelfTravelDocument = useCallback(
        (t: TripTravelerIdentity) => {
            if (!selfUserId || t.linkedUserId !== selfUserId) return;
            if (profileSyncTimer.current) clearTimeout(profileSyncTimer.current);
            profileSyncTimer.current = setTimeout(() => {
                void (async () => {
                    try {
                        const profile = financeData?.userProfile;
                        if (!profile) return;
                        const raw = parseFinancePreferencesRaw(profile) as Record<string, unknown>;
                        const manual = getFinancePreferences(profile).manualCashOut;
                        await patchProfile({
                            financePreferences: {
                                ...raw,
                                manualCashOut: manual,
                                travelDocument: travelDocPatchFromTraveler(t)
                            } as never
                        });
                        void refreshFinance();
                    } catch {
                        /* ignore */
                    }
                })();
            }, 900);
        },
        [financeData?.userProfile, refreshFinance, selfUserId]
    );

    function updateTraveler(id: string, partial: Partial<TripTravelerIdentity>) {
        const nextList = travelers.map((t) => (t.id === id ? { ...t, ...partial } : t));
        patchIdentity({ ...identity, travelers: nextList });
        const updated = nextList.find((t) => t.id === id);
        if (updated) syncSelfTravelDocument(updated);
    }

    function linkTraveler(travelerId: string, userId: string) {
        if (!userId) {
            updateTraveler(travelerId, { linkedUserId: null });
            return;
        }
        const person = roster.find((p) => p.id === userId);
        if (!person) return;
        updateTraveler(travelerId, travelerFromRosterPerson(person, travelerId));
    }

    function linkOptionsFor(travelerId: string) {
        const used = new Set(
            travelers.filter((t) => t.id !== travelerId && t.linkedUserId).map((t) => t.linkedUserId as string)
        );
        return roster.filter((p) => !used.has(p.id));
    }

    function addTraveler() {
        patchIdentity({
            ...identity,
            travelers: [...travelers, { id: crypto.randomUUID(), fullName: '', passportNumber: '' }]
        });
    }

    function removeTraveler(id: string) {
        if (travelers.length <= 1) return;
        patchIdentity({ ...identity, travelers: travelers.filter((t) => t.id !== id) });
    }

    if (!open) return null;

    const status = tripTicketStatus(trip);
    const refCode = tripTicketRef(trip);
    const title = draft.title.trim() || trip.title;

    return (
        <div
            className="trip-id-overlay"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                className="trip-id-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="trip-id-title"
            >
                <header className="trip-id-modal__head">
                    <div className="trip-id-modal__brand">
                        <span className="trip-id-modal__icon" aria-hidden>
                            <MaterialIcon name="badge" variant="app" opticalSize={24} filled />
                        </span>
                        <div className="trip-id-modal__titles">
                            <h2 id="trip-id-title">{title}</h2>
                            <div className="trip-id-modal__chips">
                                <span className="trip-id-chip">{refCode}</span>
                                <span className="trip-id-chip">{tripTicketStatusLabel(status)}</span>
                                {(draft.startsOn || draft.endsOn) && (
                                    <span className="trip-id-chip">
                                        {toApiDayKey(draft.startsOn) ?? '—'} → {toApiDayKey(draft.endsOn) ?? '—'}
                                    </span>
                                )}
                                {countries.map((c) => (
                                    <CountryFlag key={c} label={c} size="chip" className="trip-id-chip-flag" />
                                ))}
                            </div>
                        </div>
                    </div>
                    <button type="button" className="trip-id-modal__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={22} />
                    </button>
                </header>

                <div className="trip-id-modal__body">
                    <section className="trip-id-section trip-id-section--ident">
                        <header className="trip-id-section__head">
                            <MaterialIcon name="fingerprint" variant="app" opticalSize={18} />
                            <span>Identificação</span>
                            <button type="button" className="trip-id-section__add" onClick={addTraveler} aria-label="Adicionar">
                                <MaterialIcon name="person_add" variant="app" opticalSize={17} />
                                Pessoa
                            </button>
                        </header>
                        <ul className="trip-id-travelers">
                            {travelers.map((t, i) => (
                                <li key={t.id}>
                                    <TripIdTravelerCard
                                        traveler={t}
                                        index={i}
                                        roster={roster}
                                        linkOptions={linkOptionsFor(t.id)}
                                        photoUrl={
                                            t.linkedUserId === selfUserId
                                                ? financeData?.userProfile?.profilePhotoURL
                                                : null
                                        }
                                        canRemove={travelers.length > 1}
                                        onCommit={(partial) => updateTraveler(t.id, partial)}
                                        onLink={(userId) => linkTraveler(t.id, userId)}
                                        onRemove={() => removeTraveler(t.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    </section>

                    {countries.length > 0 ? (
                        <section className="trip-id-section trip-id-section--paises">
                            <header className="trip-id-section__head">
                                <MaterialIcon name="public" variant="app" opticalSize={18} />
                                <span>Países da viagem</span>
                            </header>
                            <TripIdCountryStrip
                                countries={countries}
                                quotes={quotes}
                                quotesLoading={quotesLoading}
                                checks={checks}
                                notes={countryNotes}
                                onPatch={onPatch}
                            />
                        </section>
                    ) : null}
                </div>
            </div>
        </div>
    );
}