import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { RoteirosRouteMode } from './roteiros-map-routes';
import { ROTEIROS_ROUTE_ICONS } from './roteiros-map-routes';

const ITEMS: Array<{ mode: RoteirosRouteMode; label: string }> = [
    { mode: 'flight_out', label: 'Ida' },
    { mode: 'flight_back', label: 'Volta' },
    { mode: 'ground', label: 'Terrestre' },
    { mode: 'walk', label: 'A pé' }
];

export function RoteirosMapLegend() {
    return (
        <div className="rote-map-legend" aria-label="Legenda do mapa">
            {ITEMS.map((item) => (
                <span key={item.mode} className={`rote-map-legend__item rote-map-legend__item--${item.mode}`}>
                    <span className={`rote-map-legend__line rote-map-legend__line--${item.mode}`} aria-hidden />
                    <MaterialIcon name={ROTEIROS_ROUTE_ICONS[item.mode]} variant="app" opticalSize={16} />
                    {item.label}
                </span>
            ))}
        </div>
    );
}
