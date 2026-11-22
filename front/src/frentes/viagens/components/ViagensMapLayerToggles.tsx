import type { ViagensMapLayerKey, ViagensMapLayersState } from '../domain/viagensMapLayers';

type Props = {
    value: ViagensMapLayersState;
    onChange: (next: ViagensMapLayersState) => void;
    hasRoteiro: boolean;
};

const LABELS: Record<ViagensMapLayerKey, string> = {
    flights: 'Voos',
    roteiro: 'Roteiro',
    countries: 'Países'
};

export function ViagensMapLayerToggles({ value, onChange, hasRoteiro }: Props) {
    const toggle = (key: ViagensMapLayerKey) => {
        onChange({ ...value, [key]: !value[key] });
    };

    const keys: ViagensMapLayerKey[] = hasRoteiro
        ? ['flights', 'roteiro', 'countries']
        : ['flights', 'countries'];

    return (
        <div className="viagens-map-layer-toggles" role="group" aria-label="Camadas do mapa">
            {keys.map((key) => (
                <button
                    key={key}
                    type="button"
                    className={`viagens-map-layer-toggles__btn${value[key] ? ' viagens-map-layer-toggles__btn--on' : ''}`}
                    aria-pressed={value[key]}
                    onClick={() => toggle(key)}
                >
                    {LABELS[key]}
                </button>
            ))}
        </div>
    );
}