import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { CountryRow } from '../../domain/tripScenarioDisplay';

type Props = {
    rows: CountryRow[];
    focusedCountry: string | null;
    onFocus: (country: string | null) => void;
};

export function TripSimuladorCountryTrail({ rows, focusedCountry, onFocus }: Props) {
    const visit = rows.filter((r) => !r.isLayoverOnly);
    if (!visit.length) return null;

    return (
        <div className="viagens-sim-trail" role="list" aria-label="Países na rota">
            {visit.map((row, index) => {
                const selected = focusedCountry === row.country;
                return (
                    <div key={row.id} className="viagens-sim-trail__item" role="listitem">
                        {index > 0 ? (
                            <span className="viagens-sim-trail__link" aria-hidden>
                                <MaterialIcon name="more_horiz" variant="app" opticalSize={16} />
                            </span>
                        ) : null}
                        <button
                            type="button"
                            className={`viagens-sim-trail__chip${selected ? ' viagens-sim-trail__chip--on' : ''}`}
                            onClick={() => onFocus(selected ? null : row.country)}
                        >
                            <MaterialIcon name="location_on" variant="app" opticalSize={14} />
                            <span className="viagens-sim-trail__name">{row.country}</span>
                            {row.days > 0 ? (
                                <span className="viagens-sim-trail__days">{row.days} d</span>
                            ) : null}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}