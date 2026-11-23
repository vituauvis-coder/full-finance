import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../../components/icons/DeleteIcon';
import { formatBRL } from '../../utils/map-utils';
import type { PiggyDeposit } from './orcamento-model';
import { personInitials } from './personInitials';

type Props = {
    deposits: PiggyDeposit[];
    onClose: () => void;
    onDelete: (id: string) => void;
};

function formatDepositDate(key?: string) {
    if (!key?.trim()) return '—';
    const d = new Date(`${key.trim().slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return key;
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    }).formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    if (!day || !month || !year) return '—';
    return `${day}/${month}/${year}`;
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
                                <span className="orc-pop__when">
                                    {d.authorName ? (
                                        <span
                                            className="orc-pop__author"
                                            title={`Aporte por ${d.authorName}`}
                                            aria-hidden
                                        >
                                            {personInitials(d.authorName)}
                                        </span>
                                    ) : null}
                                    <time
                                        className="orc-pop__date"
                                        dateTime={d.recordedOn?.slice(0, 10)}
                                        title={d.authorName ? `Aporte por ${d.authorName}` : undefined}
                                    >
                                        {formatDepositDate(d.recordedOn)}
                                    </time>
                                </span>
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