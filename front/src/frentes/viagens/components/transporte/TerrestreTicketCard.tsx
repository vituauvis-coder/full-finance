import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    GROUND_TRANSPORT_KINDS,
    groundTransportKindIcon,
    groundTransportLabel
} from '../../domain/ground-transport';
import type { TripGroundTransport } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import '../TripTicketCard.css';

type Props = {
    row: TripGroundTransport;
    destName: string | null;
    when: string | null;
    roteiroUses?: number;
    roteiroTotal?: number;
    onOpen: () => void;
};

function kindIcon(kind: string | undefined): string {
    return groundTransportKindIcon(kind);
}

function kindLabel(kind: string | undefined): string {
    return GROUND_TRANSPORT_KINDS.find((k) => k.id === kind)?.label ?? 'Transporte';
}

export function TerrestreTicketCard({ row, destName, when, roteiroUses = 0, roteiroTotal = 0, onOpen }: Props) {
    const from = (row.fromName ?? row.from_name ?? '').trim();
    const to = (row.toName ?? row.to_name ?? '').trim();
    const amount = Math.max(0, Number(row.amount ?? 0) || 0);
    const code = row.id.slice(0, 6).toUpperCase();

    return (
        <button
            type="button"
            className="trip-ticket terrestre-ticket"
            data-kind={row.kind ?? 'other'}
            onClick={onOpen}
            aria-label={`${kindLabel(row.kind)}: ${groundTransportLabel(row)}`}
        >
            <span className="trip-ticket__perforation" aria-hidden />
            <div className="trip-ticket__main">
                <header className="trip-ticket__header">
                    <span className="terrestre-ticket__type" aria-hidden>
                        <MaterialIcon name={kindIcon(row.kind)} variant="app" opticalSize={22} filled />
                    </span>
                    <span className="trip-ticket__label">{kindLabel(row.kind)}</span>
                </header>
                <h3 className="trip-ticket__destination terrestre-ticket__title">{groundTransportLabel(row)}</h3>
                {from || to ? (
                    <p className="terrestre-ticket__route">
                        <span>
                            {from || '…'} → {to || '…'}
                        </span>
                    </p>
                ) : null}
                <div className="terrestre-ticket__meta">
                    {when ? <span className="terrestre-ticket__when">{when}</span> : null}
                    {destName ? (
                        <span className="terrestre-ticket__dest">{destName}</span>
                    ) : (
                        <span className="terrestre-ticket__warn">Sem cidade</span>
                    )}
                </div>
                {roteiroUses > 0 ? (
                    <p className="terrestre-ticket__roteiro-stat" aria-live="polite">
                        {roteiroUses} {roteiroUses === 1 ? 'uso no roteiro' : 'usos no roteiro'}
                        {roteiroTotal > 0 ? ` · ${formatBRL(roteiroTotal)}` : null}
                    </p>
                ) : null}
            </div>
            <aside className="trip-ticket__stub">
                <span className="terrestre-ticket__stub-icon" aria-hidden>
                    <MaterialIcon name={kindIcon(row.kind)} variant="app" opticalSize={28} filled />
                </span>
                <span className="trip-ticket__stub-label">Valor</span>
                <span className="terrestre-ticket__stub-amount">{formatBRL(amount)}</span>
                <span className="terrestre-ticket__stub-unit">por uso</span>
                <span className="trip-ticket__stub-code">{code}</span>
            </aside>
        </button>
    );
}