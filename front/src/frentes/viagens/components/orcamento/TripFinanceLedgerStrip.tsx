import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import type { TripFinanceMovementLine } from '../../types';

type Props = {
    lines: TripFinanceMovementLine[];
};

function labelFor(line: TripFinanceMovementLine): string {
    if (line.ledgerKind === 'aporte') return 'Aporte';
    if (line.ledgerKind === 'gasto_cofrinho') return 'Gasto do cofrinho';
    return 'Dinheiro';
}

function fmtDate(raw?: string | null): string {
    if (!raw?.trim()) return '—';
    const d = new Date(`${raw.trim().slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' });
}

export function TripFinanceLedgerStrip({ lines }: Props) {
    const rows = (lines ?? [])
        .filter((l) => l.ledgerKind === 'aporte' || l.ledgerKind === 'gasto_cofrinho')
        .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

    if (!rows.length) return null;

    return (
        <aside className="orc-finance-ledger" aria-label="Movimentos do cofrinho no Dinheiro">
            <header className="orc-finance-ledger__head">
                <MaterialIcon name="account_balance" variant="app" opticalSize={16} />
                <span>Extrato Dinheiro (viagem)</span>
            </header>
            <ul className="orc-finance-ledger__list">
                {rows.map((line) => (
                    <li key={line.id} className={`orc-finance-ledger__row orc-finance-ledger__row--${line.ledgerKind}`}>
                        <span className="orc-finance-ledger__kind">{labelFor(line)}</span>
                        <span className="orc-finance-ledger__desc">{line.description || '—'}</span>
                        <time dateTime={line.date ?? undefined}>{fmtDate(line.date)}</time>
                        <strong className="orc-finance-ledger__amt">
                            {line.ledgerKind === 'gasto_cofrinho' ? '−' : '+'}
                            {formatBRL(line.amount)}
                        </strong>
                        {line.author ? (
                            <span className="orc-finance-ledger__author" title={`Por ${line.author.name}`}>
                                {line.author.name}
                            </span>
                        ) : null}
                    </li>
                ))}
            </ul>
        </aside>
    );
}