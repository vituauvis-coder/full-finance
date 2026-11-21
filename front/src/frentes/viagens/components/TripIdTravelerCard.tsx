import { useEffect, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { TripTravelerIdentity } from '../types';
import type { TravelRosterPerson } from '../domain/tripTravelRoster';

type Props = {
    traveler: TripTravelerIdentity;
    index: number;
    roster: TravelRosterPerson[];
    linkOptions: TravelRosterPerson[];
    photoUrl?: string | null;
    canRemove: boolean;
    onCommit: (partial: Partial<TripTravelerIdentity>) => void;
    onLink: (userId: string) => void;
    onRemove: () => void;
};

function displayInitial(name: string, index: number) {
    const ch = name.trim().charAt(0);
    return ch ? ch.toUpperCase() : String(index + 1);
}

function displayName(name: string) {
    const t = name.trim();
    return t || 'Sem nome';
}

function displayPassport(passport: string) {
    const t = passport.trim();
    return t || '—';
}

export function TripIdTravelerCard({
    traveler: t,
    index,
    roster,
    linkOptions,
    photoUrl,
    canRemove,
    onCommit,
    onLink,
    onRemove
}: Props) {
    const [editing, setEditing] = useState(false);
    const [linkOpen, setLinkOpen] = useState(false);
    const [draftName, setDraftName] = useState(t.fullName ?? '');
    const [draftPassport, setDraftPassport] = useState(t.passportNumber ?? '');

    const linked = t.linkedUserId ? roster.find((p) => p.id === t.linkedUserId) : null;

    useEffect(() => {
        if (editing) return;
        setDraftName(t.fullName ?? '');
        setDraftPassport(t.passportNumber ?? '');
        setLinkOpen(false);
    }, [t.fullName, t.passportNumber, t.linkedUserId, editing]);

    useEffect(() => {
        if (!editing) return;
        setDraftName(t.fullName ?? '');
        setDraftPassport(t.passportNumber ?? '');
    }, [t.linkedUserId, editing]);

    function startEdit() {
        setDraftName(t.fullName ?? '');
        setDraftPassport(t.passportNumber ?? '');
        setLinkOpen(false);
        setEditing(true);
    }

    function finishEdit() {
        onCommit({
            fullName: draftName.trim(),
            passportNumber: draftPassport.trim()
        });
        setEditing(false);
        setLinkOpen(false);
    }

    return (
        <article className={`trip-id-pass${editing ? ' trip-id-pass--edit' : ''}`}>
            <div className="trip-id-pass__grid">
                <div className="trip-id-pass__thumb">
                    {photoUrl ? (
                        <img className="trip-id-pass__photo" src={photoUrl} alt="" />
                    ) : (
                        <span className="trip-id-pass__avatar">{displayInitial(t.fullName ?? '', index)}</span>
                    )}
                </div>

                <div className="trip-id-pass__main">
                    {editing ? (
                        <div className="trip-id-pass__name-row">
                            <input
                                className="viagens-field trip-id-input"
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                placeholder="Nome"
                                aria-label="Nome"
                            />
                            <input
                                className="viagens-field trip-id-input trip-id-input--pass"
                                value={draftPassport}
                                onChange={(e) => setDraftPassport(e.target.value)}
                                placeholder="Passaporte"
                                aria-label="Passaporte"
                            />
                        </div>
                    ) : (
                        <div className="trip-id-pass__identity" title="Nome e passaporte">
                            <span
                                className={`trip-id-pass__name${!(t.fullName ?? '').trim() ? ' trip-id-pass__name--muted' : ''}`}
                            >
                                {displayName(t.fullName ?? '')}
                            </span>
                            <span className="trip-id-pass__dot" aria-hidden>
                                ·
                            </span>
                            <span className="trip-id-pass__pass">{displayPassport(t.passportNumber ?? '')}</span>
                        </div>
                    )}

                    <div className="trip-id-pass__sub">
                        {linked ? (
                            <span className="trip-id-pass__link-pill">
                                <MaterialIcon name="link" variant="app" opticalSize={12} />
                                {linked.isSelf ? 'Você' : linked.name.split(' ')[0]}
                                {editing ? (
                                    <button type="button" className="trip-id-pass__link-swap" onClick={() => setLinkOpen((v) => !v)}>
                                        ⇄
                                    </button>
                                ) : null}
                            </span>
                        ) : editing ? (
                            <button type="button" className="trip-id-pass__link-cta" onClick={() => setLinkOpen(true)}>
                                Vincular
                            </button>
                        ) : (
                            <span className="trip-id-pass__sub-hint">Sem vínculo</span>
                        )}
                    </div>

                    {editing && linkOpen ? (
                        <select
                            className="viagens-field trip-id-input trip-id-pass__link-select"
                            value={t.linkedUserId ?? ''}
                            onChange={(e) => {
                                onLink(e.target.value);
                                setLinkOpen(false);
                            }}
                            aria-label="Conta Meu Mundo"
                        >
                            <option value="">Manual</option>
                            {linkOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.isSelf ? `${p.name} (você)` : p.name}
                                </option>
                            ))}
                        </select>
                    ) : null}
                </div>

                <div className="trip-id-pass__tools">
                    {editing ? (
                        <>
                            <button type="button" className="trip-id-pass__action trip-id-pass__action--done" onClick={finishEdit}>
                                <MaterialIcon name="check" variant="app" opticalSize={15} />
                                Pronto
                            </button>
                            {canRemove ? (
                                <button type="button" className="trip-id-pass__tool-icon" onClick={onRemove} aria-label="Remover">
                                    <MaterialIcon name="delete" variant="app" opticalSize={17} />
                                </button>
                            ) : null}
                        </>
                    ) : (
                        <button type="button" className="trip-id-pass__tool-icon" onClick={startEdit} aria-label="Editar">
                            <MaterialIcon name="edit" variant="app" opticalSize={17} />
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}