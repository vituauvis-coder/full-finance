import { DialogFrame } from '../../../components/ui/dialog';
import type { ExpenseSplitRequest } from '../../../lib/types/finance';
import { ExpenseSplitsOutgoingList } from './ExpenseSplitsOutgoingList';

type Props = {
    open: boolean;
    outgoing: ExpenseSplitRequest[];
    currency: string;
    onClose: () => void;
    onChanged: () => void | Promise<void>;
};

export function ExpenseSplitsOutgoingModal({ open, outgoing, currency, onClose, onChanged }: Props) {
    const pending = (outgoing || []).filter((s) => s && String(s.status).toUpperCase() === 'PENDING');
    const n = pending.length;

    return (
        <DialogFrame
            id="expense-splits-outgoing-modal"
            open={open}
            title={n === 1 ? 'Pedido de estorno pendente' : 'Pedidos de estorno pendentes'}
            onClose={onClose}
            size="md"
            panelClassName="modal-content--expense-splits-outgoing"
        >
            <p className="expense-splits-outgoing-modal__hint">
                Aguardando aceite ou recusa no app. Você pode cancelar antes da resposta.
            </p>
            <ExpenseSplitsOutgoingList pending={pending} currency={currency} onChanged={onChanged} />
        </DialogFrame>
    );
}