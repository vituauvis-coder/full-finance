import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DialogForm, DialogFrame } from '../../../../components/ui/dialog';
import { FormActions, FormAlert, FormField, FormInput, FormSelect } from '../../../../components/ui/form';
import { monthKey } from '../../domain/debtAggregations';
import {
    buildMonthsForDebtForm,
    DEBT_START_MONTH_OPTIONS,
    debtStartYearRange,
    indexUpdatesByMonthKey,
    monthKeyToReferenceDate,
    parseStartDateValue
} from '../../domain/debtFormMonths';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import { createDebt, createDebtUpdate, deleteDebtUpdate, updateDebt, updateDebtUpdate } from '../../api/debts';
import { DebtMonthlyBalancesSection } from './DebtMonthlyBalancesSection';

type Props = {
    open: boolean;
    debt: Debt | null;
    companyLocked: boolean;
    debts: Debt[];
    updates: DebtUpdate[];
    onClose: () => void;
    onSaved: () => Promise<void>;
};

function seedFromDebt(debt: Debt, updates: DebtUpdate[]) {
    const byMonth = indexUpdatesByMonthKey(updates, debt.id);
    const values: Record<string, string> = {};
    const updateByMonth: Record<string, string> = {};
    const keys: string[] = [];
    byMonth.forEach((u, mk) => {
        if (!u.id) return;
        updateByMonth[mk] = u.id;
        values[mk] = String(Number(u.amount) || 0);
        keys.push(mk);
    });
    keys.sort();
    let startMonth = '';
    let startYear = '';
    if (keys.length) {
        const [y, m] = keys[0].split('-');
        startYear = y;
        startMonth = m;
    }
    return { values, updateByMonth, startMonth, startYear, company: debt.company ?? '' };
}

export function DebtUpdateFormModal({ open, debt, companyLocked, debts, updates, onClose, onSaved }: Props) {
    const [company, setCompany] = useState('');
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');
    const [monthValues, setMonthValues] = useState<Record<string, string>>({});
    const [updateByMonth, setUpdateByMonth] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [focusMonthKey, setFocusMonthKey] = useState<string | null>(null);

    const startDate = parseStartDateValue(startMonth, startYear);
    const yearRange = useMemo(() => debtStartYearRange(), []);
    const yearOptions = useMemo(() => {
        const opts: number[] = [];
        for (let y = yearRange.max; y >= yearRange.min; y--) opts.push(y);
        return opts;
    }, [yearRange.max, yearRange.min]);

    const reset = useCallback(() => {
        setCompany('');
        setStartMonth('');
        setStartYear('');
        setMonthValues({});
        setUpdateByMonth({});
        setError(null);
        setFocusMonthKey(null);
    }, []);

    useEffect(() => {
        if (!open) return;
        if (debt) {
            const seeded = seedFromDebt(debt, updates);
            setCompany(seeded.company);
            setStartMonth(seeded.startMonth);
            setStartYear(seeded.startYear);
            setMonthValues(seeded.values);
            setUpdateByMonth(seeded.updateByMonth);
        } else {
            reset();
        }
        setError(null);
        const mk = monthKey(new Date());
        requestAnimationFrame(() => setFocusMonthKey(mk));
    }, [open, debt?.id, updates, reset]);

    const syncExistingDebtByCompany = useCallback(
        (name: string) => {
            if (companyLocked || !name.trim()) return;
            const found = debts.find(
                (d) => String(d.company || '').trim().toLowerCase() === name.trim().toLowerCase()
            );
            if (!found) return;
            const seeded = seedFromDebt(found, updates);
            setMonthValues(seeded.values);
            setUpdateByMonth(seeded.updateByMonth);
            if (seeded.startMonth && seeded.startYear) {
                setStartMonth(seeded.startMonth);
                setStartYear(seeded.startYear);
            }
        },
        [companyLocked, debts, updates]
    );

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const name = company.trim();
        if (!name) {
            setError('Informe o nome ou empresa.');
            return;
        }
        if (!startDate) {
            setError('Selecione o mês e o ano de início.');
            return;
        }

        const { months } = buildMonthsForDebtForm(startDate);
        const order = months.map((d) => monthKey(d));
        const entries: { monthKey: string; amount: number; date: Date }[] = [];
        order.forEach((key) => {
            const raw = String(monthValues[key] ?? '').trim();
            if (raw === '') return;
            const n = Number(raw.replace(',', '.'));
            if (!Number.isFinite(n)) return;
            entries.push({ monthKey: key, amount: n, date: monthKeyToReferenceDate(key) });
        });

        let debtIdForValidate = debt?.id ?? null;
        if (!debtIdForValidate) {
            const found = debts.find(
                (d) => String(d.company || '').trim().toLowerCase() === name.toLowerCase()
            );
            if (found) debtIdForValidate = found.id;
        }
        const indexedForValidate = debtIdForValidate
            ? indexUpdatesByMonthKey(updates, debtIdForValidate)
            : new Map<string, { id?: string }>();
        const willDeleteStoredMonth = order.some((mk) => {
            if (String(monthValues[mk] ?? '').trim() !== '') return false;
            const existingId = updateByMonth[mk] ?? indexedForValidate.get(mk)?.id;
            return Boolean(existingId);
        });

        if (entries.length === 0 && !willDeleteStoredMonth) {
            setError('Preencha ao menos um mês ou limpe meses que já tinham valor para removê-los.');
            return;
        }

        setError(null);
        setBusy(true);
        try {
            let debtId = debt?.id ?? null;
            const sorted = entries.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
            const firstAmount = sorted[0]?.amount;

            if (!debtId) {
                const found = debts.find(
                    (d) => String(d.company || '').trim().toLowerCase() === name.toLowerCase()
                );
                if (found) debtId = found.id;
            }

            if (!debtId) {
                const created = await createDebt({
                    company: name,
                    initialAmount: firstAmount ?? null,
                    colorKey: 'wine'
                });
                debtId = created.id;
            } else {
                const existing = debts.find((d) => d.id === debtId);
                if (existing && existing.initialAmount == null && firstAmount != null) {
                    await updateDebt(debtId, { initialAmount: firstAmount });
                }
            }

            const indexed = indexUpdatesByMonthKey(updates, debtId);
            const idByMonth = { ...updateByMonth };
            indexed.forEach((u, mk) => {
                if (u.id && !idByMonth[mk]) idByMonth[mk] = u.id;
            });

            for (const mk of order) {
                const raw = String(monthValues[mk] ?? '').trim();
                if (raw !== '') continue;
                const existingId = idByMonth[mk];
                if (!existingId) continue;
                await deleteDebtUpdate(existingId);
                delete idByMonth[mk];
            }

            for (const { date, amount, monthKey: mk } of sorted) {
                const existingId = idByMonth[mk];
                const payload = {
                    debtId: debtId!,
                    date: date.toISOString(),
                    amount,
                    description: null as string | null
                };
                if (existingId) {
                    await updateDebtUpdate(existingId, payload);
                } else {
                    const created = await createDebtUpdate(payload);
                    if (created.id) idByMonth[mk] = created.id;
                }
            }

            onClose();
            await onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setBusy(false);
        }
    }

    const showMonthly = Boolean(startDate && buildMonthsForDebtForm(startDate).months.length > 0);

    return (
        <DialogFrame
            id="debt-update-modal"
            open={open}
            title="Nova dívida"
            onClose={onClose}
            size="lg"
            panelClassName="ui-dialog__panel--debt-form"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)} id="debt-update-form">
                <FormAlert message={error} />
                <FormField
                    id="debt-company"
                    label="Nome / empresa"
                    hint="O mesmo nome agrupa o histórico no gráfico."
                >
                    <FormInput
                        id="debt-company"
                        name="debt-company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        onBlur={() => syncExistingDebtByCompany(company)}
                        readOnly={companyLocked}
                        aria-readonly={companyLocked || undefined}
                        autoComplete="organization"
                        maxLength={200}
                        required
                        placeholder="Ex.: Banco X, loja Y…"
                    />
                </FormField>
                <FormField
                    id="debt-start-date-label"
                    label="Mês de início da dívida"
                    hint="Selecione mês e ano; abaixo aparecem os meses até o atual para informar o saldo."
                >
                    <div className="debt-start-month-row" role="group" aria-labelledby="debt-start-date-label">
                        <FormSelect
                            id="debt-start-month"
                            className="debt-start-month-select"
                            aria-label="Mês de início"
                            value={startMonth}
                            required
                            onChange={(e) => setStartMonth(e.target.value)}
                        >
                            <option value="">Mês</option>
                            {DEBT_START_MONTH_OPTIONS.map(([v, l]) => (
                                <option key={v} value={v}>
                                    {l}
                                </option>
                            ))}
                        </FormSelect>
                        <FormSelect
                            id="debt-start-year"
                            className="debt-start-year-select"
                            aria-label="Ano de início"
                            value={startYear}
                            required
                            onChange={(e) => setStartYear(e.target.value)}
                        >
                            <option value="">Ano</option>
                            {yearOptions.map((y) => (
                                <option key={y} value={String(y)}>
                                    {y}
                                </option>
                            ))}
                        </FormSelect>
                    </div>
                    <input type="hidden" id="debt-start-date" name="debt-start-date" value={startDate} readOnly />
                </FormField>
                {showMonthly ? (
                    <DebtMonthlyBalancesSection
                        startDate={startDate}
                        values={monthValues}
                        onValuesChange={setMonthValues}
                        focusMonthKey={focusMonthKey}
                    />
                ) : null}
                <FormActions onCancel={onClose} busy={busy} submitLabel="Salvar" cancelLabel="Cancelar" />
            </DialogForm>
        </DialogFrame>
    );
}