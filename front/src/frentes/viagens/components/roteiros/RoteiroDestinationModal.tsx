import { useEffect, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripDestination, TripPlaceKind } from '../../types';
import { PLACE_KIND_LABELS } from './roteiros-display';

const KIND_OPTIONS: TripPlaceKind[] = ['city', 'neighborhood', 'country', 'region', 'poi', 'airport', 'other'];

type Props = {
    open: boolean;
    dest: TripDestination | null;
    onClose: () => void;
    onSave: (patch: Partial<TripDestination>) => void;
};

export function RoteiroDestinationModal({ open, dest, onClose, onSave }: Props) {
    const [name, setName] = useState('');
    const [country, setCountry] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [kind, setKind] = useState<string>('city');
    const [arrivedOn, setArrivedOn] = useState('');
    const [departedOn, setDepartedOn] = useState('');
    const [summary, setSummary] = useState('');
    const [highlightsText, setHighlightsText] = useState('');
    const [alertsText, setAlertsText] = useState('');

    useEffect(() => {
        if (!dest) return;
        setName(dest.name);
        setCountry(dest.country ?? '');
        setNeighborhood(dest.neighborhood ?? '');
        setKind((dest.kind as string) || 'city');
        setArrivedOn(dest.arrivedOn ?? '');
        setDepartedOn(dest.departedOn ?? '');
        setSummary(dest.guideSummary ?? '');
        setHighlightsText((dest.guideHighlights ?? []).join('\n'));
        setAlertsText((dest.guideAlerts ?? []).join('\n'));
    }, [dest]);

    if (!open || !dest) return null;

    function splitLines(text: string): string[] {
        return text
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
    }

    function handleSave() {
        onSave({
            name: name.trim() || dest!.name,
            country: country.trim() || null,
            neighborhood: neighborhood.trim() || null,
            kind: kind as TripPlaceKind,
            arrivedOn: arrivedOn || null,
            departedOn: departedOn || null,
            guideSummary: summary.trim() || null,
            guideHighlights: splitLines(highlightsText),
            guideAlerts: splitLines(alertsText)
        });
        onClose();
    }

    return (
        <div className="rote-modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="rote-modal"
                role="dialog"
                aria-labelledby="rote-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="rote-modal__head">
                    <h2 id="rote-modal-title">Guia do destino</h2>
                    <button type="button" className="rote-modal__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={20} />
                    </button>
                </header>
                <div className="rote-modal__body">
                    <div className="rote-modal__grid">
                        <label className="rote-field">
                            <span>Nome</span>
                            <input className="viagens-field" value={name} onChange={(e) => setName(e.target.value)} />
                        </label>
                        <label className="rote-field">
                            <span>País</span>
                            <input
                                className="viagens-field"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                            />
                        </label>
                        <label className="rote-field">
                            <span>Tipo</span>
                            <select className="viagens-field" value={kind} onChange={(e) => setKind(e.target.value)}>
                                {KIND_OPTIONS.map((k) => (
                                    <option key={k} value={k}>
                                        {PLACE_KIND_LABELS[k]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="rote-field">
                            <span>Bairro / subárea</span>
                            <input
                                className="viagens-field"
                                value={neighborhood}
                                onChange={(e) => setNeighborhood(e.target.value)}
                                placeholder="Opcional"
                            />
                        </label>
                        <label className="rote-field">
                            <span>Chegada</span>
                            <input
                                type="date"
                                className="viagens-field"
                                value={arrivedOn}
                                onChange={(e) => setArrivedOn(e.target.value)}
                            />
                        </label>
                        <label className="rote-field">
                            <span>Saída</span>
                            <input
                                type="date"
                                className="viagens-field"
                                value={departedOn}
                                onChange={(e) => setDepartedOn(e.target.value)}
                            />
                        </label>
                    </div>
                    <label className="rote-field rote-field--wide">
                        <span>Resumo do lugar</span>
                        <textarea
                            className="viagens-field rote-textarea"
                            rows={3}
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="Por que ir, clima, melhor época…"
                        />
                    </label>
                    <label className="rote-field rote-field--wide">
                        <span>Destaques (um por linha)</span>
                        <textarea
                            className="viagens-field rote-textarea"
                            rows={3}
                            value={highlightsText}
                            onChange={(e) => setHighlightsText(e.target.value)}
                            placeholder="Prado, tapas, mirante…"
                        />
                    </label>
                    <label className="rote-field rote-field--wide">
                        <span>Importante / alertas</span>
                        <textarea
                            className="viagens-field rote-textarea rote-textarea--alert"
                            rows={2}
                            value={alertsText}
                            onChange={(e) => setAlertsText(e.target.value)}
                            placeholder="Horários, reservas, visto…"
                        />
                    </label>
                </div>
                <footer className="rote-modal__foot">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="button" className="viagens-btn viagens-btn--primary" onClick={handleSave}>
                        Salvar destino
                    </button>
                </footer>
            </div>
        </div>
    );
}