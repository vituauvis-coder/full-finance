import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripStay } from '../../types';
import { pickPlaceDisplayName } from '../../utils/place-display';
import { TripSimDayPicker } from '../simulador/TripSimDayPicker';

type DestOpt = { id: string; label: string };

type Props = {
    open: boolean;
    stay: TripStay | null;
    destOptions: DestOpt[];
    onClose: () => void;
    onChange: (next: TripStay) => void;
    onDelete: () => void;
};

function isoDate(stay: TripStay, key: 'in' | 'out'): string {
    return (key === 'in' ? stay.checkInOn ?? stay.check_in_on : stay.checkOutOn ?? stay.check_out_on) ?? '';
}

export function HospedagemEditorModal({
    open,
    stay,
    destOptions,
    onClose,
    onChange,
    onDelete
}: Props) {
    if (!open || !stay) return null;

    const paid = Boolean(stay.paid);
    const title =
        pickPlaceDisplayName({ name: stay.name, countryName: stay.country ?? stay.city }) || 'Nova hospedagem';
    const checkIn = isoDate(stay, 'in');
    const checkOut = isoDate(stay, 'out');

    function patch(partial: Partial<TripStay>) {
        onChange({ ...stay, ...partial });
    }

    return (
        <div
            className="voos-overlay"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="voos-editor voos-editor--voo hosp-editor-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hosp-editor-title"
            >
                <header className="voos-editor__head">
                    <div className="voos-editor__identity">
                        <p className="pontos-kicker">Hospedagem</p>
                        <h2 id="hosp-editor-title">{title}</h2>
                    </div>
                    <div className="voos-editor__head-actions">
                        <button
                            type="button"
                            className={`voos-choose${paid ? ' is-on' : ''}`}
                            aria-pressed={paid}
                            onClick={() => patch({ paid: !paid })}
                        >
                            {paid ? 'Pago' : 'A pagar'}
                        </button>
                        <button type="button" className="voos-icon-btn voos-icon-btn--coral" onClick={onDelete} title="Apagar">
                            <MaterialIcon name="delete" variant="app" opticalSize={20} />
                        </button>
                        <button type="button" className="voos-icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
                            <MaterialIcon name="close" variant="app" opticalSize={20} />
                        </button>
                    </div>
                </header>

                <div className="voos-editor__body hosp-editor-modal__body">
                    <div className="hosp-editor-modal__row hosp-editor-modal__row--3">
                        <label className="voos-field voos-field--grow">
                            <span>Nome</span>
                            <input
                                className="viagens-field"
                                value={stay.name ?? ''}
                                placeholder="Hotel, Airbnb…"
                                onChange={(e) => patch({ name: e.target.value })}
                            />
                        </label>
                        <label className="voos-field">
                            <span>Destino</span>
                            <select
                                className="viagens-field"
                                value={stay.destinationId ?? ''}
                                onChange={(e) => patch({ destinationId: e.target.value || null })}
                            >
                                <option value="">Selecione</option>
                                {destOptions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="hosp-editor-modal__dates">
                            <label className="voos-field">
                                <span>Check-in / out</span>
                                <div className="hosp-editor-modal__date-pair">
                                    <TripSimDayPicker
                                        value={checkIn}
                                        placeholder="In"
                                        onChange={(iso) => patch({ checkInOn: iso, check_in_on: iso })}
                                    />
                                    <TripSimDayPicker
                                        value={checkOut}
                                        placeholder="Out"
                                        onChange={(iso) => patch({ checkOutOn: iso, check_out_on: iso })}
                                    />
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="hosp-editor-modal__row hosp-editor-modal__row--2">
                        <label className="voos-field">
                            <span>Valor (R$)</span>
                            <input
                                className="viagens-field"
                                type="number"
                                min={0}
                                step={1}
                                value={stay.amount ?? ''}
                                placeholder="0"
                                onChange={(e) => patch({ amount: Number(e.target.value) || 0 })}
                            />
                        </label>
                        <label className="voos-field voos-field--grow">
                            <span>Endereço</span>
                            <input
                                className="viagens-field"
                                value={stay.address ?? ''}
                                placeholder="Rua, número, bairro"
                                onChange={(e) => patch({ address: e.target.value })}
                            />
                        </label>
                    </div>
                </div>

                <footer className="voos-editor__foot">
                    <button type="button" className="viagens-btn viagens-btn--coral" onClick={onClose}>
                        Concluir
                    </button>
                </footer>
            </div>
        </div>
    );
}
