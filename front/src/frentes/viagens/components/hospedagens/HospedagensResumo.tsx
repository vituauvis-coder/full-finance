import { staysSummary } from '@motor/viagens/trip-stays-stats.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import type { TripDestination, TripPayload } from '../../types';
import { HospedagensStayTrail } from './HospedagensStayTrail';

type Props = {
    payload: TripPayload;
    destinations: TripDestination[];
    focusStayId?: string | null;
    onFocusStay?: (id: string | null) => void;
};

export function HospedagensResumo({ payload, destinations, focusStayId, onFocusStay }: Props) {
    const stays = payload.stays ?? [];
    const summary = staysSummary(stays);

    return (
        <section className="hosp-resumo" aria-label="Panorama de hospedagens">
            <article className="hosp-resumo__custo" aria-label="Custo">
                <header className="hosp-resumo__block-head">
                    <h2>Custo</h2>
                    <MaterialIcon name="payments" variant="app" opticalSize={18} />
                </header>
                <div className="orc-kpis hosp-resumo__kpis">
                    <Kpi
                        label="Total"
                        value={formatBRL(summary.total)}
                        tone="turquesa"
                        icon="account_balance_wallet"
                    />
                    <Kpi label="Pago" value={formatBRL(summary.paid)} tone="ouro" icon="check_circle" />
                    <Kpi
                        label="A pagar"
                        value={formatBRL(summary.unpaid)}
                        tone={summary.unpaid > 0 ? 'coral' : undefined}
                        icon="schedule"
                    />
                    <Kpi label="Diárias" value={summary.nights ? String(summary.nights) : '—'} icon="nights_stay" />
                </div>
                <p className="hosp-resumo__hint">
                    {summary.unpaid > 0
                        ? `${formatBRL(summary.unpaid)} ainda a pagar nos registros.`
                        : summary.count
                          ? 'Valores sincronizam com o orçamento da viagem.'
                          : 'Adicione valores ao criar cada hospedagem.'}
                </p>
            </article>

            <article className="hosp-resumo__trilha" aria-label="Resumo de hospedagens">
                <header className="hosp-resumo__block-head">
                    <h2>Resumo de hospedagens</h2>
                    <span className="hosp-resumo__count">
                        {summary.count} {summary.count === 1 ? 'registro' : 'registros'}
                    </span>
                </header>
                <HospedagensStayTrail
                    stays={stays}
                    destinations={destinations}
                    focusStayId={focusStayId}
                    onFocusStay={onFocusStay}
                />
            </article>
        </section>
    );
}

function Kpi({
    label,
    value,
    tone,
    icon
}: {
    label: string;
    value: string;
    tone?: 'turquesa' | 'ouro' | 'coral';
    icon: string;
}) {
    return (
        <div className={`orc-kpi${tone ? ` orc-kpi--${tone}` : ''}`}>
            <span className="orc-kpi__row">
                <span className="orc-kpi__label">{label}</span>
                <span className="hosp-kpi__icon" aria-hidden>
                    <MaterialIcon name={icon} variant="app" opticalSize={14} />
                </span>
            </span>
            <strong className="orc-kpi__value">{value}</strong>
        </div>
    );
}