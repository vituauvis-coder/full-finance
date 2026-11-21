import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripDestination, TripItineraryDay } from '../../types';
import { roteiroStats } from './roteiros-display';

type Props = {
    destinations: TripDestination[];
    itinerary: TripItineraryDay[];
    startsOn: string;
    endsOn: string;
    focusDestId?: string | null;
    onFocusDest?: (id: string | null) => void;
};

export function RoteirosResumo({
    destinations,
    itinerary,
    startsOn,
    endsOn,
}: Props) {
    const stats = roteiroStats(destinations, itinerary, startsOn, endsOn);

    return (
        <section className="rote-resumo" aria-label="Panorama do roteiro">
            <div className="rote-resumo__kpis orc-kpis">
                <Kpi label="Paradas" value={String(stats.stops)} tone="turquesa" icon="pin_drop" />
                <Kpi label="Países" value={String(stats.countries)} tone="coral" icon="public" />
                <Kpi label="Dias" value={String(stats.tripDays)} tone="ouro" icon="calendar_month" />
                <Kpi
                    label="Destaques"
                    value={String(stats.highlightCount)}
                    tone="oceano"
                    icon="star"
                    hint={`${stats.activityCount} atividades no guia`}
                />
            </div>
        </section>
    );
}

function Kpi({
    label,
    value,
    tone,
    icon,
    hint
}: {
    label: string;
    value: string;
    tone: 'turquesa' | 'coral' | 'ouro' | 'oceano';
    icon: string;
    hint?: string;
}) {
    return (
        <article className={`orc-kpi orc-kpi--${tone} rote-kpi`}>
            <span className="orc-kpi__row">
                <span className="orc-kpi__label">
                    <MaterialIcon name={icon} variant="app" opticalSize={14} />
                    {label}
                </span>
            </span>
            <strong className="orc-kpi__value">{value}</strong>
            {hint ? <span className="rote-kpi__hint">{hint}</span> : null}
        </article>
    );
}