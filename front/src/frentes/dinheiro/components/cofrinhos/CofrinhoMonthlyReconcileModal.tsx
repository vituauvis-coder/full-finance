import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogFooter,
    DialogForm,
    DialogHeader,
    DialogPanel,
    DialogTitle
} from '../../../../components/ui/dialog/Dialog';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../../../lib/format';
import { MONTH_NAMES, defaultCivilYear, defaultPeriod } from '../../../../lib/period';
import { buildCofrinhoMonthlyYieldEvents } from '@motor/dinheiro/cofrinho-monthly-yield.js';
import { saveCofrinhoMonthlyBalanceBatch } from '../../api/cofrinhos';
import type { CofrinhoApplication, CofrinhoBucket } from '../../domain/cofrinhoAggregations';
import { bucketColorHex } from '../../domain/cofrinhoConstants';
import { cofrinhoKindMeta } from '../../domain/cofrinhoBucketTypes';
import type { CofrinhoMonthlyBalance } from '../../domain/cofrinhoMonthlyBalances';
import {
    findMonthlyBalanceForBucketMonth,
    monthlyBalanceAccountId,
    monthlyBalanceBucketId,
    monthlyBalanceYearMonth
} from '../../domain/cofrinhoMonthlyBalances';
import {
    cofrinhoLedgerMonthTotals,
    computeCofrinhoPrincipalBeforeOutflowsInMonth,
    computeCofrinhoPrincipalThroughMonth
} from '../../domain/cofrinhoNetPrincipal';
import { accountIdsForBucketReconcile, accountLabel } from '../../domain/cofrinhoReconcileAccounts';
import { yearMonthFromCivilPeriod, yearMonthToReferenceMonth } from '../../domain/cofrinhoPeriod';
import type { Account, Movement } from '../../../../lib/types/finance';
import { formatMoneyDraft, parseMoneyInput } from '../../domain/parseMoneyInput';
import { cofrinhoLedgerAccountAccent } from '../../domain/cofrinhoLedgerAccountAccent';
import type { CofrinhoTripPayloadOutflow } from '../../domain/cofrinhoLedgerRows';

type Props = {
    open: boolean;
    onClose: () => void;
    bucket: CofrinhoBucket | null;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    monthlyBalances: CofrinhoMonthlyBalance[];
    accounts: Account[];
    tripPayloadOutflows?: CofrinhoTripPayloadOutflow[];
    currency: string;
    onSaved: () => Promise<void>;
};

type LineDraft = {
    accountId: string;
    principal: string;
    balance: string;
};

function monthOptions(year: number): { value: string; label: string }[] {
    const nowYm = yearMonthFromCivilPeriod(defaultPeriod(), year);
    const items: { value: string; label: string }[] = [];
    for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2, '0')}`;
        const mi = m - 1;
        const name = MONTH_NAMES[mi] ?? ym.slice(5, 7);
        items.push({ value: ym, label: `${name} ${year}` });
    }
    return items.sort((a, b) => {
        if (a.value === nowYm) return -1;
        if (b.value === nowYm) return 1;
        return b.value.localeCompare(a.value);
    });
}

function buildLineDrafts(
    bucket: CofrinhoBucket,
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    monthlyBalances: CofrinhoMonthlyBalance[],
    yearMonth: string,
    accounts: Account[],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[]
): LineDraft[] {
    const accountIds = accountIdsForBucketReconcile(
        bucket.id,
        buckets,
        applications,
        expenses,
        monthlyBalances,
        yearMonth,
        accounts,
        tripPayloadOutflows
    ).sort((a, b) => accountLabel(accounts, a).localeCompare(accountLabel(accounts, b), 'pt-BR'));

    if (accountIds.length === 0) {
        return [];
    }

    return accountIds.map((accountId) => {
        const existing = accountId
            ? findMonthlyBalanceForBucketMonth(monthlyBalances, bucket.id, yearMonth, accountId)
            : monthlyBalancesForLegacy(bucket.id, monthlyBalances, yearMonth);
        const suggested = accountId
            ? computeCofrinhoPrincipalThroughMonth(
                  bucket,
                  buckets,
                  applications,
                  expenses,
                  yearMonth,
                  accountId,
                  accounts,
                  tripPayloadOutflows
              )
            : computeCofrinhoPrincipalThroughMonth(
                  bucket,
                  buckets,
                  applications,
                  expenses,
                  yearMonth,
                  undefined,
                  accounts,
                  tripPayloadOutflows
              );

        if (existing) {
            return {
                accountId: monthlyBalanceAccountId(existing) || accountId,
                principal: String(existing.principalAmount ?? ''),
                balance: String(existing.balanceWithYield ?? '')
            };
        }
        return {
            accountId,
            principal: suggested > 0 ? formatMoneyDraft(suggested) : '',
            balance: ''
        };
    });
}

function monthlyBalancesForLegacy(
    bucketId: string,
    balances: CofrinhoMonthlyBalance[],
    yearMonth: string
): CofrinhoMonthlyBalance | undefined {
    return balances.find(
        (b) =>
            monthlyBalanceBucketId(b) === bucketId &&
            monthlyBalanceYearMonth(b) === yearMonth &&
            !monthlyBalanceAccountId(b)
    );
}

export function CofrinhoMonthlyReconcileModal({
    open,
    onClose,
    bucket,
    buckets,
    applications,
    expenses,
    monthlyBalances,
    accounts,
    tripPayloadOutflows = [],
    currency,
    onSaved
}: Props) {
    const year = defaultCivilYear();
    const defaultYm = yearMonthFromCivilPeriod(defaultPeriod(), year);
    const [yearMonth, setYearMonth] = useState(defaultYm);
    const [lines, setLines] = useState<LineDraft[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dirtyLineIds, setDirtyLineIds] = useState<Set<string>>(() => new Set());

    useEffect(() => {
        if (!open || !bucket) return;
        setError(null);
        setYearMonth(defaultYm);
        setDirtyLineIds(new Set());
    }, [bucket, defaultYm, open]);

    useEffect(() => {
        if (!open || !bucket) return;
        const built = buildLineDrafts(
            bucket,
            buckets,
            applications,
            expenses,
            monthlyBalances,
            yearMonth,
            accounts,
            tripPayloadOutflows
        );
        setLines((prev) =>
            built.map((line) => {
                if (!dirtyLineIds.has(line.accountId)) return line;
                const old = prev.find((l) => l.accountId === line.accountId);
                if (!old) return line;
                return { ...line, principal: old.principal, balance: old.balance };
            })
        );
        // dirtyLineIds lido no merge; não deve re-disparar este efeito
        // eslint-disable-next-line react-hooks/exhaustive-deps -- preserve edição manual ao atualizar dados
    }, [accounts, applications, bucket, buckets, expenses, monthlyBalances, open, tripPayloadOutflows, yearMonth]);

    useEffect(() => {
        setDirtyLineIds(new Set());
    }, [yearMonth, bucket?.id]);

    const totals = useMemo(() => {
        let principal = 0;
        let balance = 0;
        for (const line of lines) {
            const p = parseMoneyInput(line.principal);
            const b = parseMoneyInput(line.balance);
            if (p != null) principal += p;
            if (b != null) balance += b;
        }
        return {
            principal: Math.round(principal * 100) / 100,
            balance: Math.round(balance * 100) / 100
        };
    }, [lines]);

    const monthYieldPreview = useMemo(() => {
        if (!bucket) return null;
        const ref = yearMonthToReferenceMonth(yearMonth);
        if (!ref) return null;
        const draftRows = lines
            .map((line) => {
                const p = parseMoneyInput(line.principal);
                const b = parseMoneyInput(line.balance);
                if (p == null || b == null || !line.accountId) return null;
                return {
                    id: `draft-${line.accountId}`,
                    bucketId: bucket.id,
                    referenceMonth: ref,
                    principalAmount: p,
                    balanceWithYield: b,
                    accountId: line.accountId
                };
            })
            .filter(Boolean) as CofrinhoMonthlyBalance[];

        const rest = (monthlyBalances ?? []).filter(
            (row) =>
                monthlyBalanceBucketId(row) === bucket.id &&
                monthlyBalanceYearMonth(row) !== yearMonth
        );
        const events = buildCofrinhoMonthlyYieldEvents([...rest, ...draftRows]);
        return events.find((e) => e.bucketId === bucket.id && e.yearMonth === yearMonth)?.amount ?? null;
    }, [bucket, lines, monthlyBalances, yearMonth]);

    function markLineDirty(accountId: string) {
        setDirtyLineIds((prev) => {
            if (prev.has(accountId)) return prev;
            const next = new Set(prev);
            next.add(accountId);
            return next;
        });
    }

    function updateLine(accountId: string, patch: Partial<LineDraft>) {
        markLineDirty(accountId);
        setLines((prev) => prev.map((l) => (l.accountId === accountId ? { ...l, ...patch } : l)));
    }

    function applyPrincipalSuggestion(accountId: string, mode: 'net' | 'before-outflows') {
        if (!bucket) return;
        const suggested =
            mode === 'before-outflows'
                ? computeCofrinhoPrincipalBeforeOutflowsInMonth(
                      bucket,
                      buckets,
                      applications,
                      expenses,
                      yearMonth,
                      accountId,
                      accounts,
                      tripPayloadOutflows
                  )
                : computeCofrinhoPrincipalThroughMonth(
                      bucket,
                      buckets,
                      applications,
                      expenses,
                      yearMonth,
                      accountId,
                      accounts,
                      tripPayloadOutflows
                  );
        if (suggested > 0) {
            updateLine(accountId, { principal: formatMoneyDraft(suggested) });
        }
    }

    const monthHasOutflows = useMemo(() => {
        if (!bucket) return false;
        for (const line of lines) {
            if (!line.accountId) continue;
            const t = cofrinhoLedgerMonthTotals(
                bucket,
                buckets,
                applications,
                expenses,
                yearMonth,
                line.accountId,
                accounts,
                tripPayloadOutflows
            );
            if (t.outflows > 0.001) return true;
        }
        return false;
    }, [accounts, applications, bucket, buckets, expenses, lines, tripPayloadOutflows, yearMonth]);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!bucket) return;

        const payload: { accountId: string; principalAmount: number; balanceWithYield: number }[] = [];
        for (const line of lines) {
            if (!line.accountId) continue;
            const p = parseMoneyInput(line.principal);
            const b = parseMoneyInput(line.balance);
            if (p == null || b == null) {
                setError('Preencha aportes e saldo em cada conta');
                return;
            }
            if (b + 0.001 < p) {
                setError(`Saldo menor que aportes em ${accountLabel(accounts, line.accountId)}`);
                return;
            }
            if (p <= 0 && b <= 0) continue;
            payload.push({ accountId: line.accountId, principalAmount: p, balanceWithYield: b });
        }

        if (payload.length === 0) {
            setError('Informe ao menos uma conta com valores');
            return;
        }

        const ref = yearMonthToReferenceMonth(yearMonth);
        if (!ref) {
            setError('Mês inválido');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await saveCofrinhoMonthlyBalanceBatch({
                bucketId: bucket.id,
                referenceMonth: ref,
                lines: payload
            });
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível guardar');
        } finally {
            setSaving(false);
        }
    }

    if (!bucket) return null;

    const name = bucket.name ?? 'Caixinha';
    const kind = cofrinhoKindMeta(bucket);
    const accent = bucketColorHex(bucket.colorKey);
    const hasYieldPreview = monthYieldPreview != null && monthYieldPreview > 0.001;
    const accumulated = Math.round((totals.balance - totals.principal) * 100) / 100;

    return (
        <Dialog open={open} onClose={onClose} id="cofrinho-monthly-reconcile-modal">
            <DialogPanel
                size="md"
                className="cofrinho-reconcile-dialog"
                style={{ ['--cofrinho-accent' as string]: accent }}
            >
                <DialogHeader>
                    <DialogTitle>Saldo mensal</DialogTitle>
                    <DialogCloseButton />
                </DialogHeader>
                <DialogForm className="cofrinho-reconcile-dialog__form" onSubmit={(e) => void onSubmit(e)}>
                    <DialogBody className="cofrinho-reconcile-dialog__body">
                        {error ? (
                            <p className="cofrinho-reconcile-dialog__alert" role="alert">
                                {error}
                            </p>
                        ) : null}

                        <div className="cofrinho-reconcile-dialog__meta">
                            <div className="cofrinho-reconcile-dialog__bucket">
                                <span className="cofrinho-reconcile-dialog__kind" title={kind.shortLabel}>
                                    <MaterialIcon name={kind.icon} variant="app" opticalSize={15} />
                                </span>
                                <span className="cofrinho-reconcile-dialog__name">{name}</span>
                            </div>
                            <div className="cofrinho-reconcile-dialog__period">
                                <label className="cofrinho-reconcile-dialog__period-label" htmlFor="cofrinho-reconcile-month">
                                    Mês
                                </label>
                                <select
                                    id="cofrinho-reconcile-month"
                                    className="cofrinho-reconcile-dialog__month"
                                    value={yearMonth}
                                    onChange={(e) => setYearMonth(e.target.value)}
                                >
                                    {monthOptions(year).map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {monthHasOutflows ? (
                            <p className="cofrinho-reconcile-dialog__outflow-hint">
                                Houve <strong>saída</strong> neste mês no extrato. O valor líquido já vem descontado.
                                Para registrar <strong>rendimento antes do gasto</strong>, use «antes da saída» no
                                aporte e o saldo do banco na mesma data. Após o gasto, use líquido nos dois campos.
                            </p>
                        ) : null}

                        {lines.length === 0 ? (
                            <p className="cofrinho-reconcile-dialog__empty">
                                Nenhuma conta com aporte nesta caixinha. Registre um aporte e ela aparece aqui para
                                informar o saldo no banco.
                            </p>
                        ) : (
                            <div className="cofrinho-reconcile-dialog__grid">
                                <div className="cofrinho-reconcile-dialog__cols-hint" aria-hidden>
                                    <span>Conta</span>
                                    <span>Aportes líqu.</span>
                                    <span>Saldo</span>
                                </div>
                                <ul className="cofrinho-reconcile-dialog__lines">
                            {lines.map((line) => {
                                const account = accounts.find((a) => a.id === line.accountId);
                                const accentAccount = cofrinhoLedgerAccountAccent(account);
                                const monthTotals =
                                    bucket && line.accountId
                                        ? cofrinhoLedgerMonthTotals(
                                              bucket,
                                              buckets,
                                              applications,
                                              expenses,
                                              yearMonth,
                                              line.accountId,
                                              accounts,
                                              tripPayloadOutflows
                                          )
                                        : null;
                                const netSuggested = monthTotals?.netEnd ?? 0;
                                const beforeOutflows = monthTotals?.principalBeforeOutflows ?? 0;
                                const p = parseMoneyInput(line.principal);
                                const b = parseMoneyInput(line.balance);
                                const rowYield =
                                    p != null && b != null ? Math.round((b - p) * 100) / 100 : null;
                                const showNetChip =
                                    netSuggested > 0.001 &&
                                    p != null &&
                                    Math.abs(p - netSuggested) > 0.02;
                                const showBeforeChip =
                                    (monthTotals?.outflows ?? 0) > 0.001 &&
                                    beforeOutflows > 0.001 &&
                                    p != null &&
                                    Math.abs(p - beforeOutflows) > 0.02;
                                return (
                                    <li key={line.accountId || 'legacy'} className="cofrinho-reconcile-dialog__line">
                                        <div className="cofrinho-reconcile-dialog__account">
                                            <span
                                                className="cofrinho-reconcile-dialog__account-dot"
                                                style={{
                                                    ['--ledger-account-accent' as string]: accentAccount
                                                }}
                                            />
                                            <div className="cofrinho-reconcile-dialog__account-text">
                                                <span className="cofrinho-reconcile-dialog__account-name">
                                                    {accountLabel(accounts, line.accountId)}
                                                </span>
                                                <div className="cofrinho-reconcile-dialog__suggest-row">
                                                    {showNetChip ? (
                                                        <button
                                                            type="button"
                                                            className="cofrinho-reconcile-dialog__suggest"
                                                            onClick={() =>
                                                                applyPrincipalSuggestion(line.accountId, 'net')
                                                            }
                                                        >
                                                            líquido {formatMoneyDraft(netSuggested)}
                                                        </button>
                                                    ) : null}
                                                    {showBeforeChip ? (
                                                        <button
                                                            type="button"
                                                            className="cofrinho-reconcile-dialog__suggest is-before-outflow"
                                                            onClick={() =>
                                                                applyPrincipalSuggestion(line.accountId, 'before-outflows')
                                                            }
                                                        >
                                                            antes saída {formatMoneyDraft(beforeOutflows)}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                        <input
                                            className="cofrinho-reconcile-dialog__input"
                                            type="text"
                                            inputMode="decimal"
                                            value={line.principal}
                                            onChange={(e) =>
                                                updateLine(line.accountId, { principal: e.target.value })
                                            }
                                            placeholder="0,00"
                                            aria-label={`Aportes — ${accountLabel(accounts, line.accountId)}`}
                                        />
                                        <div className="cofrinho-reconcile-dialog__balance-wrap">
                                            <input
                                                className="cofrinho-reconcile-dialog__input is-balance"
                                                type="text"
                                                inputMode="decimal"
                                                value={line.balance}
                                                onChange={(e) =>
                                                    updateLine(line.accountId, { balance: e.target.value })
                                                }
                                                placeholder="0,00"
                                                aria-label={`Saldo — ${accountLabel(accounts, line.accountId)}`}
                                            />
                                            {rowYield != null && rowYield > 0.001 ? (
                                                <span className="cofrinho-reconcile-dialog__row-yield">
                                                    +{formatBRL(rowYield, currency)}
                                                </span>
                                            ) : null}
                                        </div>
                                    </li>
                                );
                            })}
                                </ul>
                            </div>
                        )}

                        <div
                            className={`cofrinho-reconcile-dialog__yield${hasYieldPreview ? ' has-value' : ''}`}
                            aria-live="polite"
                        >
                            <span className="cofrinho-reconcile-dialog__yield-label">Rendimento no mês</span>
                            <strong className="cofrinho-reconcile-dialog__yield-value">
                                {hasYieldPreview
                                    ? formatBRL(monthYieldPreview!, currency)
                                    : accumulated > 0
                                      ? formatBRL(accumulated, currency)
                                      : '—'}
                            </strong>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={saving || lines.length === 0}>
                            {saving ? 'A guardar…' : 'Confirmar'}
                        </button>
                    </DialogFooter>
                </DialogForm>
            </DialogPanel>
        </Dialog>
    );
}