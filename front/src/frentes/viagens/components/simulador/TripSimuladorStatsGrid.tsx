import { formatDuration } from '@motor/viagens/trip-scenario-engine.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { ScenarioSnapshot } from '../../domain/tripScenarioCriteria';

const STATS = [
    {
        key: 'calendar',
        label: 'Dias',
        icon: 'calendar_month',
        tint: 'oceano',
        format: (s: ScenarioSnapshot) => `${s.calendarDays ?? 0}`,
        unit: ''
    },
    {
        key: 'duration',
        label: 'Duração',
        icon: 'schedule',
        tint: 'turquesa',
        format: (s: ScenarioSnapshot) => formatDuration(s.durationHours ?? 0),
        unit: ''
    },
    {
        key: 'tourism',
        label: 'Turismo',
        icon: 'wb_sunny',
        tint: 'turquesa',
        format: (s: ScenarioSnapshot) => `${s.tourism?.fullDays ?? 0}`,
        unit: 'd'
    },
    {
        key: 'vacation',
        label: 'Férias',
        icon: 'eco',
        tint: 'coral',
        format: (s: ScenarioSnapshot) => `${s.vacation?.consumedDays ?? 0}`,
        unit: 'd'
    },
    {
        key: 'remote',
        label: 'Remotos',
        icon: 'laptop',
        tint: 'ouro',
        format: (s: ScenarioSnapshot) => `${s.remote?.possibleWeekdays ?? 0}`,
        unit: ''
    },
    {
        key: 'layover',
        label: 'Escalas',
        icon: 'flight',
        tint: 'turquesa',
        format: (s: ScenarioSnapshot) => `${(s.layovers ?? []).filter((l) => l.worthVisiting).length}`,
        unit: ''
    }
];

type Props = { snapshot: ScenarioSnapshot };

export function TripSimuladorStatsGrid({ snapshot }: Props) {
    return (
        <div className="viagens-resumo__stats viagens-sim-resumo__stats" role="list">
            {STATS.map((s) => (
                <div key={s.key} className={`viagens-resumo-stat viagens-resumo-stat--${s.tint}`} role="listitem">
                    <span className="viagens-resumo-stat__icon" aria-hidden>
                        <MaterialIcon name={s.icon} variant="app" opticalSize={14} />
                    </span>
                    <span className="viagens-resumo-stat__copy">
                        <span className="viagens-resumo-stat__value">
                            {s.format(snapshot)}
                            {s.unit ? <span className="viagens-resumo-stat__unit"> {s.unit}</span> : null}
                        </span>
                        <span className="viagens-resumo-stat__label">{s.label}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}