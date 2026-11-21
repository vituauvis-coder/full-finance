import { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { monthKey } from '../../domain/debtAggregations';
import {
    buildMonthsForDebtForm,
    countFilledMonths,
    formatDebtMonthShortLabel,
    groupMonthsByYear,
    previousFilledAmount
} from '../../domain/debtFormMonths';

type Props = {
    startDate: string;
    values: Record<string, string>;
    onValuesChange: (next: Record<string, string>) => void;
    focusMonthKey?: string | null;
};

export function DebtMonthlyBalancesSection({ startDate, values, onValuesChange, focusMonthKey }: Props) {
    const { months, note } = useMemo(() => buildMonthsForDebtForm(startDate), [startDate]);
    const monthKeys = useMemo(() => months.map((d) => monthKey(d)), [months]);
    const groups = useMemo(() => groupMonthsByYear(months), [months]);
    const currentYear = new Date().getFullYear();
    const [expandedYears, setExpandedYears] = useState<Set<number>>(() => new Set([currentYear]));

    const filledCount = countFilledMonths(values);
    const focusHandled = useRef(false);

    useEffect(() => {
        focusHandled.current = false;
    }, [focusMonthKey, startDate]);

    useEffect(() => {
        if (!focusMonthKey || focusHandled.current) return;
        const el = document.querySelector<HTMLInputElement>(
            `#debt-update-modal .debt-month-input[data-month-key="${focusMonthKey}"]`
        );
        if (el) {
            el.focus();
            focusHandled.current = true;
        }
    }, [focusMonthKey, months.length]);

    if (months.length === 0) return null;

    function setMonthValue(key: string, raw: string) {
        onValuesChange({ ...values, [key]: raw });
    }

    function toggleYear(year: number) {
        setExpandedYears((prev) => {
            const next = new Set(prev);
            if (next.has(year)) next.delete(year);
            else next.add(year);
            return next;
        });
    }

    function copyPrevious(key: string) {
        const prev = previousFilledAmount(monthKeys, values, key);
        if (prev == null) return;
        setMonthValue(key, String(prev));
    }

    function clearMonth(key: string) {
        const next = { ...values };
        delete next[key];
        onValuesChange(next);
    }

    return (
        <div id="debt-monthly-section" className="debt-monthly-section" aria-live="polite">
            <div className="debt-monthly-section__head">
                <span className="debt-monthly-section__title">Saldos por mês</span>
                <span id="debt-month-filled-count" className="debt-month-filled-count">
                    {filledCount > 0 ? `${filledCount} ${filledCount === 1 ? 'mês' : 'meses'}` : ''}
                </span>
            </div>
            {note ? (
                <p id="debt-monthly-note" className="debt-monthly-note" role="status">
                    {note}
                </p>
            ) : null}
            <p className="debt-monthly-hint">
                <MaterialIcon name="info" variant="app" className="debt-monthly-hint__icon" aria-hidden />
                Meses em branco não são salvos.{' '}
                <MaterialIcon name="arrow_downward" variant="app" className="debt-monthly-hint__icon" aria-hidden />{' '}
                copia o valor anterior;{' '}
                <MaterialIcon name="ink_eraser" variant="app" className="debt-monthly-hint__icon" aria-hidden /> limpa o
                mês.
            </p>
            <div id="debt-monthly-years" className="debt-monthly-years" role="region" aria-label="Valores por mês">
                {groups.map(({ year, months: yearMonths }) => {
                    const expanded = expandedYears.has(year);
                    const filledInYear = yearMonths.filter((d) => {
                        const v = values[monthKey(d)];
                        return v != null && String(v).trim() !== '';
                    }).length;
                    return (
                        <section key={year} className="debt-year-block" data-year={year}>
                            <button
                                type="button"
                                className="debt-year-block__toggle"
                                aria-expanded={expanded}
                                onClick={() => toggleYear(year)}
                            >
                                <span className="debt-year-block__year">{year}</span>
                                <span className="debt-year-block__meta">
                                    {filledInYear} de {yearMonths.length} preenchido{filledInYear === 1 ? '' : 's'}
                                </span>
                            </button>
                            {expanded ? (
                                <div className="debt-year-block__panel" data-year-panel={year}>
                                    <div className="debt-month-grid" role="list">
                                        {yearMonths.map((d) => {
                                            const key = monthKey(d);
                                            const val = values[key] ?? '';
                                            const label = formatDebtMonthShortLabel(d);
                                            const filled = val.trim() !== '';
                                            return (
                                                <div
                                                    key={key}
                                                    className={`debt-month-cell${filled ? ' debt-month-cell--filled' : ''}`}
                                                    data-month-key={key}
                                                >
                                                    <div className="debt-month-cell__head">
                                                        <span className="debt-month-cell__label">{label}</span>
                                                        <div className="debt-month-cell__tools">
                                                            <button
                                                                type="button"
                                                                className="debt-month-cell__tool debt-month-copy-prev"
                                                                title="Igual ao mês anterior"
                                                                aria-label={`Igual ao mês anterior ${label}`}
                                                                onClick={() => copyPrevious(key)}
                                                            >
                                                                <MaterialIcon
                                                                    name="arrow_downward"
                                                                    variant="app"
                                                                    weight={500}
                                                                    opticalSize={20}
                                                                />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="debt-month-cell__tool debt-month-clear"
                                                                title="Limpar"
                                                                aria-label={`Limpar ${label}`}
                                                                onClick={() => clearMonth(key)}
                                                            >
                                                                <MaterialIcon
                                                                    name="ink_eraser"
                                                                    variant="app"
                                                                    weight={500}
                                                                    opticalSize={20}
                                                                />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        className="debt-month-input ui-control"
                                                        data-month-key={key}
                                                        value={val}
                                                        placeholder="0,00"
                                                        autoComplete="off"
                                                        aria-label={`Valor em ${label}`}
                                                        onChange={(e) => setMonthValue(key, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key !== 'Enter') return;
                                                            e.preventDefault();
                                                            const idx = monthKeys.indexOf(key);
                                                            if (idx < 0 || idx >= monthKeys.length - 1) return;
                                                            const nextKey = monthKeys[idx + 1];
                                                            document
                                                                .querySelector<HTMLInputElement>(
                                                                    `#debt-update-modal .debt-month-input[data-month-key="${nextKey}"]`
                                                                )
                                                                ?.focus();
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}