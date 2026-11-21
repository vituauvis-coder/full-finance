import { useEffect, useRef } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { GROUND_TRANSPORT_KINDS } from '../../domain/ground-transport';
import type { TripGroundTransport, TripGroundTransportKind } from '../../types';
import { formatBRL } from '../../utils/map-utils';

type DestOpt = { id: string; label: string };

type Props = {
    open: boolean;
    item: TripGroundTransport | null;
    destOptions: DestOpt[];
    onClose: () => void;
    onChange: (next: TripGroundTransport) => void;
    onDelete: () => void;
};

export function TransporteTerrestreEditorModal({ open, item, destOptions, onClose, onChange, onDelete }: Props) {
    const firstField = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const t = window.setTimeout(() => firstField.current?.focus(), 80);
        return () => window.clearTimeout(t);
    }, [open, item?.id]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open || !item) return null;

    const destId = item.tripDestinationId ?? item.trip_destination_id ?? '';
    const amount = Math.max(0, Number(item.amount ?? 0) || 0);
    const current = item;

    function patch(partial: Partial<TripGroundTransport>) {
        onChange({ ...current, ...partial });
    }

    return (
        <div
            className="voos-overlay terrestre-modal-overlay"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="voos-editor voos-editor--voo terrestre-modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="terrestre-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="voos-editor__head">
                    <div className="voos-editor__identity">
                        <p className="pontos-kicker">Transporte terrestre</p>
                        <h2 id="terrestre-modal-title">{item.title?.trim() || 'Novo registro'}</h2>
                    </div>
                    <div className="voos-editor__head-actions">
                        <button type="button" className="voos-icon-btn voos-icon-btn--coral" onClick={onDelete} title="Apagar">
                            <MaterialIcon name="delete" variant="app" opticalSize={20} />
                        </button>
                        <button type="button" className="voos-icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
                            <MaterialIcon name="close" variant="app" opticalSize={20} />
                        </button>
                    </div>
                </header>

                <div className="voos-editor__body terrestre-modal-panel__body">
                    <section className="terrestre-modal__section">
                        <p className="terrestre-modal__section-label">Tipo</p>
                        <div className="terrestre-modal__kinds" role="radiogroup" aria-label="Tipo de transporte">
                            {GROUND_TRANSPORT_KINDS.map((k) => {
                                const on = (item.kind ?? 'other') === k.id;
                                return (
                                    <button
                                        key={k.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        className={`terrestre-modal__kind${on ? ' is-on' : ''}`}
                                        onClick={() => patch({ kind: k.id as TripGroundTransportKind })}
                                    >
                                        <MaterialIcon name={k.icon} variant="app" filled={on} opticalSize={22} />
                                        <span>{k.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <div className="terrestre-modal__fields-row">
                        <label className="voos-field voos-field--grow">
                            <span>Nome / referência</span>
                            <input
                                ref={firstField}
                                className="viagens-field"
                                value={item.title ?? ''}
                                placeholder="Ex.: JR Pass · Aluguel Hertz"
                                onChange={(e) => patch({ title: e.target.value })}
                            />
                        </label>
                        <label className="voos-field">
                            <span>Cidade</span>
                            <select
                                className="viagens-field"
                                value={destId}
                                onChange={(e) => patch({ tripDestinationId: e.target.value || null })}
                            >
                                <option value="">Selecionar…</option>
                                {destOptions.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="terrestre-modal__route-row">
                        <label className="voos-field">
                            <span>Origem</span>
                            <input
                                className="viagens-field"
                                value={item.fromName ?? item.from_name ?? ''}
                                placeholder="Cidade, estação…"
                                onChange={(e) => patch({ fromName: e.target.value })}
                            />
                        </label>
                        <span className="terrestre-modal__route-arrow" aria-hidden>
                            <MaterialIcon name="arrow_forward" variant="app" opticalSize={20} />
                        </span>
                        <label className="voos-field">
                            <span>Destino</span>
                            <input
                                className="viagens-field"
                                value={item.toName ?? item.to_name ?? ''}
                                placeholder="Cidade, estação…"
                                onChange={(e) => patch({ toName: e.target.value })}
                            />
                        </label>
                    </div>

                    <div className="terrestre-modal__fields-row terrestre-modal__fields-row--2">
                        <label className="voos-field">
                            <span>Data</span>
                            <input
                                type="date"
                                className="viagens-field"
                                value={item.departedOn ?? item.departed_on ?? ''}
                                onChange={(e) => patch({ departedOn: e.target.value })}
                            />
                        </label>
                        <label className="voos-field">
                            <span>Valor (R$)</span>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="viagens-field terrestre-modal__money"
                                value={item.amount ?? 0}
                                onChange={(e) => patch({ amount: Number(e.target.value) || 0 })}
                            />
                        </label>
                        <p className="terrestre-modal__cost-badge" aria-live="polite">
                            {formatBRL(amount)}
                        </p>
                    </div>

                    <label className="voos-field voos-field--grow">
                        <span>Observações</span>
                        <textarea
                            className="viagens-field terrestre-modal__notes"
                            rows={2}
                            value={item.notes ?? ''}
                            placeholder="Assento, empresa, voucher…"
                            onChange={(e) => patch({ notes: e.target.value })}
                        />
                    </label>
                </div>

                <footer className="voos-editor__foot">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Fechar
                    </button>
                    <button type="button" className="viagens-btn viagens-btn--primary" onClick={onClose}>
                        Concluir
                    </button>
                </footer>
            </div>
        </div>
    );
}