import type { ViagensMapView } from '../domain/viagensMapView';

type Props = {
    value: ViagensMapView;
    onChange: (view: ViagensMapView) => void;
};

export function ViagensMapViewToggle({ value, onChange }: Props) {
    return (
        <div className="viagens-map-view-toggle" role="group" aria-label="Tipo de visualização do mapa">
            <button
                type="button"
                className={`viagens-map-view-toggle__btn${value === 'flat' ? ' viagens-map-view-toggle__btn--active' : ''}`}
                aria-pressed={value === 'flat'}
                onClick={() => onChange('flat')}
            >
                Mapa
            </button>
            <button
                type="button"
                className={`viagens-map-view-toggle__btn${value === 'globe' ? ' viagens-map-view-toggle__btn--active' : ''}`}
                aria-pressed={value === 'globe'}
                onClick={() => onChange('globe')}
            >
                Globo
            </button>
        </div>
    );
}