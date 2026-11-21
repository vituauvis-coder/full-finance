import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripStay } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import { pickPlaceDisplayName } from '../../utils/place-display';

type Props = {
    stay: TripStay;
    selected: boolean;
    destLabel: string;
    onSelect: () => void;
};

export function HospedagensStayRow({ stay, selected, destLabel, onSelect }: Props) {
    const paid = Boolean(stay.paid);
    const hasPin = stay.latitude != null && stay.longitude != null;
    const name =
        pickPlaceDisplayName({ name: stay.name, countryName: stay.country ?? stay.city }) || 'Sem nome';
    const range = [stay.checkInOn ?? stay.check_in_on, stay.checkOutOn ?? stay.check_out_on]
        .filter(Boolean)
        .join(' → ');
    const meta = [destLabel, range].filter(Boolean).join(' · ') || 'Datas e destino em aberto';

    return (
        <button
            type="button"
            className={`hosp-row${selected ? ' is-selected' : ''}`}
            onClick={onSelect}
            aria-current={selected ? 'true' : undefined}
        >
            <span className="hosp-row__rail" aria-hidden="true" />
            <span className="hosp-row__icon" aria-hidden="true">
                <MaterialIcon name="apartment" variant="app" opticalSize={20} />
            </span>
            <span className="hosp-row__main">
                <strong>{name}</strong>
                <span className="hosp-row__meta">{meta}</span>
            </span>
            <span className="hosp-row__side">
                <span className="hosp-row__amount">{formatBRL(stay.amount ?? 0)}</span>
                <span className="hosp-row__badges" aria-hidden="true">
                    {paid ? (
                        <span className="hosp-row__badge hosp-row__badge--paid" title="Pago">
                            <MaterialIcon name="check" variant="app" opticalSize={14} />
                        </span>
                    ) : null}
                    {hasPin ? (
                        <span className="hosp-row__badge" title="No mapa">
                            <MaterialIcon name="location_on" variant="app" opticalSize={14} />
                        </span>
                    ) : null}
                </span>
            </span>
        </button>
    );
}