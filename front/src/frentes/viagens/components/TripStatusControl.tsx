import { effectiveStatus as computeStatus } from '@motor/viagens/trips-engine.js';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { Trip, TripStatus } from '../types';
import { tripTicketStatusLabel } from './tripTicketModel';

const OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'Automático' },
    { value: 'planejada', label: 'Planejada' },
    { value: 'em_curso', label: 'Em curso' },
    { value: 'realizada', label: 'Realizada' }
];

const STATUS_ICON: Record<TripStatus, string> = {
    planejada: 'event',
    em_curso: 'flight_takeoff',
    realizada: 'check_circle'
};

type Props = {
    trip: Trip;
    statusOverride: string;
    /** Toolbar da ficha: menos altura, sem quebra de linha. */
    compact?: boolean;
    onChange: (statusOverride: string) => void;
};

export function TripStatusControl({ trip, statusOverride, compact = false, onChange }: Props) {
    const raw = computeStatus({
        startsOn: trip.startsOn,
        endsOn: trip.endsOn,
        statusOverride: statusOverride || null
    });
    const effective: TripStatus =
        raw === 'em_curso' || raw === 'realizada' || raw === 'planejada' ? raw : 'planejada';
    const auto = !statusOverride;
    const label = tripTicketStatusLabel(effective);

    return (
        <div
            className={`viagens-trip-status viagens-trip-status--${effective}${compact ? ' viagens-trip-status--compact' : ''}`}
        >
            <span className="viagens-trip-status__icon" aria-hidden="true">
                <MaterialIcon name={STATUS_ICON[effective]} variant="app" filled opticalSize={compact ? 16 : 18} />
            </span>
            <span className="viagens-trip-status__copy">
                {compact ? null : (
                    <span className="viagens-trip-status__kicker">{auto ? 'Status automático' : 'Status'}</span>
                )}
                <span className="viagens-trip-status__name">{compact && auto ? `Auto · ${label}` : label}</span>
            </span>
            <span className="viagens-trip-status__chev" aria-hidden="true">
                <MaterialIcon name="expand_more" variant="app" opticalSize={18} />
            </span>
            <select
                id="viagem-status-select"
                className="viagens-trip-status__select"
                value={statusOverride}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Status da viagem"
            >
                {OPTIONS.map((o) => (
                    <option key={o.value || 'auto'} value={o.value}>
                        {o.value === ''
                            ? `Automático (${OPTIONS.find((x) => x.value === effective)?.label ?? effective})`
                            : o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
