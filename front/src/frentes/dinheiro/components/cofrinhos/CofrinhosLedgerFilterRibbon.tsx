import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { Account } from '../../../../lib/types/finance';
import { MONTH_NAMES } from '../../../../lib/period';
import type { CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import {
    type CofrinhosLedgerFilters,
    ledgerFiltersActive,
    type CofrinhosLedgerPeriodKind
} from '../../domain/cofrinhoLedgerFilters';
import { buildMovementListAccountFilterOptions } from '../../../../lib/movementListAccountFilter';
import { dedupeCofrinhoBucketsByDisplayName } from '../../domain/cofrinhoBucketGroups';

type Props = {
    filters: CofrinhosLedgerFilters;
    onChange: (next: CofrinhosLedgerFilters) => void;
    buckets: CofrinhoBucket[];
    accounts: Account[];
};

const PERIOD_OPTIONS: { value: CofrinhosLedgerPeriodKind; label: string }[] = [
    { value: 'all-years', label: 'Todos os anos' },
    { value: 'civil-year', label: 'Ano inteiro' },
    { value: 'month', label: 'Mês' }
];

const YEAR_OPTIONS = (() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
})();

export function CofrinhosLedgerFilterRibbon({ filters, onChange, buckets, accounts }: Props) {
    const accountOptions = buildMovementListAccountFilterOptions(accounts);
    const bucketOptions = dedupeCofrinhoBucketsByDisplayName(buckets);
    const active = ledgerFiltersActive(filters);

    function patch(partial: Partial<CofrinhosLedgerFilters>) {
        onChange({ ...filters, ...partial });
    }

    function clear() {
        onChange({
            periodKind: 'all-years',
            year: new Date().getFullYear(),
            monthIndex: new Date().getMonth(),
            accountId: '',
            bucketId: ''
        });
    }

    return (
        <section
            className="movement-filter-ribbon cofrinhos-ledger-filter"
            data-filter-tone="cofrinhos"
            aria-label="Filtros do extrato de cofrinhos"
        >
            <div className="movement-filter-ribbon__track">
                <div className="movement-filter-ribbon__group">
                    <MaterialIcon name="date_range" variant="app" className="movement-filter-ribbon__glyph" />
                    <select
                        className="movement-filter-ribbon__control movement-filter-ribbon__control--select"
                        aria-label="Período"
                        value={filters.periodKind}
                        onChange={(e) =>
                            patch({ periodKind: e.target.value as CofrinhosLedgerPeriodKind })
                        }
                    >
                        {PERIOD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="movement-filter-ribbon__group">
                    <MaterialIcon name="calendar_today" variant="app" className="movement-filter-ribbon__glyph" />
                    <select
                        className="movement-filter-ribbon__control movement-filter-ribbon__control--select"
                        aria-label="Ano"
                        value={filters.year}
                        onChange={(e) => patch({ year: Number(e.target.value) })}
                    >
                        {YEAR_OPTIONS.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>

                {filters.periodKind === 'month' ? (
                    <div className="movement-filter-ribbon__group">
                        <MaterialIcon name="event" variant="app" className="movement-filter-ribbon__glyph" />
                        <select
                            className="movement-filter-ribbon__control movement-filter-ribbon__control--select"
                            aria-label="Mês"
                            value={filters.monthIndex}
                            onChange={(e) => patch({ monthIndex: Number(e.target.value) })}
                        >
                            {MONTH_NAMES.map((name, i) => (
                                <option key={name} value={i}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}

                <span className="movement-filter-ribbon__sep" aria-hidden="true" />

                <div className="movement-filter-ribbon__group">
                    <MaterialIcon name="account_balance" variant="app" className="movement-filter-ribbon__glyph" />
                    <select
                        className="movement-filter-ribbon__control movement-filter-ribbon__control--select"
                        aria-label="Conta"
                        value={filters.accountId}
                        onChange={(e) => patch({ accountId: e.target.value })}
                    >
                        <option value="">Todas as contas</option>
                        {accountOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="movement-filter-ribbon__group">
                    <MaterialIcon name="savings" variant="app" className="movement-filter-ribbon__glyph" />
                    <select
                        className="movement-filter-ribbon__control movement-filter-ribbon__control--select"
                        aria-label="Caixinha"
                        value={filters.bucketId}
                        onChange={(e) => patch({ bucketId: e.target.value })}
                    >
                        <option value="">Todas as caixinhas</option>
                        {bucketOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>

                {active ? (
                    <button
                        type="button"
                        className="movement-filter-ribbon__clear"
                        onClick={clear}
                    >
                        Limpar
                    </button>
                ) : null}
            </div>
        </section>
    );
}