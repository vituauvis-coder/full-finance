import { BusyButton } from '../../../components/ui/BusyButton';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { formatBRL } from '../../../lib/format';

type Props = {
    requesterName: string;
    description: string;
    amount: number;
    currency: string;
    busy: boolean;
    onAccept: () => void;
    onReject: () => void;
};

export function ExpenseSplitIncomingItem({
    requesterName,
    description,
    amount,
    currency,
    busy,
    onAccept,
    onReject
}: Props) {
    return (
        <li className="expense-splits-incoming__item">
            <div className="expense-splits-incoming__main">
                <span className="expense-splits-incoming__who">{requesterName}</span>
                <span className="expense-splits-incoming__sep" aria-hidden="true">
                    ·
                </span>
                <span className="expense-splits-incoming__desc">{description}</span>
            </div>
            <div className="expense-splits-incoming__actions">
                <span className="expense-splits-incoming__amount" aria-label="Valor da divisão">
                    {formatBRL(amount, currency)}
                </span>
                <BusyButton
                    type="button"
                    className="expense-splits-incoming__btn expense-splits-incoming__btn--accept"
                    busy={busy}
                    busyLabel="…"
                    aria-label={`Aceitar rateio de ${requesterName}`}
                    onClick={onAccept}
                >
                    <MaterialIcon name="check_circle" variant="app" />
                    Aceitar
                </BusyButton>
                <BusyButton
                    type="button"
                    className="expense-splits-incoming__btn expense-splits-incoming__btn--reject"
                    busy={busy}
                    busyLabel="…"
                    aria-label={`Recusar rateio de ${requesterName}`}
                    onClick={onReject}
                >
                    <MaterialIcon name="cancel" variant="app" />
                    Recusar
                </BusyButton>
            </div>
        </li>
    );
}
