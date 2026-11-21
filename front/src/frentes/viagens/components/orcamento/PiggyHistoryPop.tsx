import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../../components/icons/DeleteIcon';
import { formatBRL } from '../../utils/map-utils';
import type { PiggyDeposit } from './orcamento-model';

type Props = {
    deposits: PiggyDeposit[];
    onClose: () => void;
    onDelete: (id: string) => void;
};

function formatDepositDate(key?: string) {
    if (!key?.trim()) return '—';
    const d = new Date(`${key.trim().slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return key;
    return d
        .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })
        .replace(/\./g, '');
}

export function PiggyHistoryPop({ deposits, onClose, onDelete }: Props) {
    const sorted = [...deposits].sort((a, b) =>
        String(b.recordedOn ?? '').localeCompare(String(a.recordedOn ?? ''))
    );

    return (
        <div className="orc-pop-overlay" role="presentation" onClick={onClose}>
            <div className="orc-pop orc-pop--history" role="dialog" aria-labelledby="orc-hist-title" onClick={(e) => e.stopPropagation()}>
                <header className="orc-pop__head">
                    <h2 id="orc-hist-title">Aportes no cofrinho</h2>
                    <button type="button" className="orc-pop__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={18} />
                    </button>
                </header>
                {sorted.length === 0 ? (
                    <p className="orc-pop__empty">Nenhum aporte registrado ainda.</p>
                ) : (
                    <ul className="orc-pop__list">
                        {sorted.map((d) => (
                            <li key={d.id} className="orc-pop__row">
                                <span>{formatDepositDate(d.recordedOn)}</span>
                                <strong>{formatBRL(d.amount)}</strong>
                                <button
                                    type="button"
                                    className="orc-pop__del"
                                    aria-label="Excluir aporte"
                                    onClick={() => onDelete(d.id)}
                                >
                                    <DeleteIcon size="sm" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}