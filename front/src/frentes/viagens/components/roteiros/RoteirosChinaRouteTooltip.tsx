import type { ChinaRouteLegDraw } from '../../domain/chinaCityRoute';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    leg: ChinaRouteLegDraw;
    onClose: () => void;
};

export function RoteirosChinaRouteTooltip({ leg, onClose }: Props) {
    const c = leg.compare;
    return (
        <div className="rote-china-tip" role="dialog" aria-label={`Trecho ${leg.fromLabel} para ${leg.toLabel}`}>
            <header className="rote-china-tip__head">
                <strong>
                    {leg.fromLabel} → {leg.toLabel}
                </strong>
                <button type="button" className="rote-china-tip__close" aria-label="Fechar" onClick={onClose}>
                    <MaterialIcon name="close" variant="app" opticalSize={16} />
                </button>
            </header>
            <p className="rote-china-tip__km">{c.km} km · estimativa para decidir base</p>
            <RouteCompareRow
                icon="train"
                title="Trem / bala"
                time={c.train.durationLabel}
                price={c.train.priceLabel}
            />
            <RouteCompareRow
                icon="flight"
                title="Voo doméstico"
                time={c.flight.durationLabel}
                price={c.flight.priceLabel}
                flightBack
            />
        </div>
    );
}

function RouteCompareRow({
    icon,
    title,
    time,
    price,
    flightBack = false
}: {
    icon: string;
    title: string;
    time: string;
    price: string;
    flightBack?: boolean;
}) {
    return (
        <div className="rote-china-tip__row">
            <span className={['rote-china-tip__icon', flightBack ? 'rote-china-tip__icon--flip' : ''].join(' ')}>
                <MaterialIcon name={icon} variant="app" opticalSize={18} filled />
            </span>
            <div>
                <div className="rote-china-tip__row-title">{title}</div>
                <div className="rote-china-tip__row-meta">
                    {time} · {price}
                </div>
            </div>
        </div>
    );
}