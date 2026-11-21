import { type FormEvent, useEffect, useState } from 'react';
import { DialogForm, DialogFrame } from '../../../../components/ui/dialog';
import { FormActions, FormAlert, FormCheckbox, FormField, FormInput, FormTextarea } from '../../../../components/ui/form';
import type { DebtColorKey } from '../../domain/debtColors';
import { createDebtUpdate, updateDebt } from '../../api/debts';
import { updatesForDebt } from '../../domain/debtAggregations';
import {
    DEBT_QUITACAO_LABEL,
    isQuitacaoUpdate,
    monthKeyToReferenceDate,
    plannedQuitacaoMonthKey
} from '../../domain/debtQuitation';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import { DebtFormColorField } from './DebtFormColorField';
import { DebtUpdateFormModal } from './DebtUpdateFormModal';

type Props = {
    debts: Debt[];
    updates: DebtUpdate[];
    createOpen: boolean;
    registerDebtId: string | null;
    settingsDebtId: string | null;
    onCloseCreate: () => void;
    onCloseRegister: () => void;
    onCloseSettings: () => void;
    onSaved: () => Promise<void>;
};

export function DebtsPageModals({
    debts,
    updates,
    createOpen,
    registerDebtId,
    settingsDebtId,
    onCloseCreate,
    onCloseRegister,
    onCloseSettings,
    onSaved
}: Props) {
    const registerDebt = registerDebtId ? debts.find((d) => d.id === registerDebtId) : null;
    const settingsDebt = settingsDebtId ? debts.find((d) => d.id === settingsDebtId) : null;
    const updateFormOpen = createOpen || Boolean(registerDebtId);

    const closeUpdateForm = () => {
        onCloseCreate();
        onCloseRegister();
    };

    return (
        <>
            <DebtUpdateFormModal
                open={updateFormOpen}
                debt={registerDebt ?? null}
                companyLocked={Boolean(registerDebtId)}
                debts={debts}
                updates={updates}
                onClose={closeUpdateForm}
                onSaved={onSaved}
            />
            <DebtSettingsModal
                debt={settingsDebt}
                updates={updates}
                onClose={onCloseSettings}
                onSaved={onSaved}
            />
        </>
    );
}

function DebtSettingsModal({
    debt,
    updates,
    onClose,
    onSaved
}: {
    debt: Debt | null | undefined;
    updates: DebtUpdate[];
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const open = Boolean(debt);
    const [company, setCompany] = useState('');
    const [initialAmount, setInitialAmount] = useState('');
    const [colorKey, setColorKey] = useState<DebtColorKey>('wine');
    const [notes, setNotes] = useState('');
    const [quitada, setQuitada] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!debt) return;
        setCompany(debt.company ?? '');
        setInitialAmount(debt.initialAmount != null ? String(debt.initialAmount) : '');
        setColorKey((debt.colorKey as DebtColorKey) || 'wine');
        setNotes(debt.notes ?? '');
        setQuitada(debt.isClosed === true);
        setError(null);
    }, [debt]);

    if (!debt) return null;

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const name = company.trim();
        if (!name) {
            setError('Informe o credor.');
            return;
        }
        const initialRaw = initialAmount.trim();
        const initial = initialRaw === '' ? null : parseFloat(initialRaw.replace(',', '.'));
        if (initial != null && (!Number.isFinite(initial) || initial < 0)) {
            setError('Valor inicial inválido.');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            const wasClosed = debt!.isClosed === true;
            await updateDebt(debt!.id, {
                company: name,
                initialAmount: initial,
                colorKey,
                notes: notes.trim() || null,
                isClosed: quitada
            });
            if (quitada && !wasClosed) {
                const list = updatesForDebt(updates, debt!.id);
                const hasQuitacao = list.some(isQuitacaoUpdate);
                if (!hasQuitacao) {
                    const quitMk = plannedQuitacaoMonthKey(list, debt!.id);
                    await createDebtUpdate({
                        debtId: debt!.id,
                        amount: 0,
                        date: monthKeyToReferenceDate(quitMk).toISOString(),
                        description: DEBT_QUITACAO_LABEL
                    });
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

    return (
        <DialogFrame
            id="debt-settings-modal"
            open={open}
            title="Definições"
            onClose={onClose}
            size="md"
        >
            <DialogForm onSubmit={(e) => void onSubmit(e)} id="debt-settings-form">
                <FormAlert message={error} />
                <p className="debt-settings-modal__subtitle" title={company.trim() || debt.company || ''}>
                    {company.trim() || debt.company || 'Dívida'}
                </p>
                <FormField id="debt-settings-company" label="Credor">
                    <FormInput
                        id="debt-settings-company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        maxLength={200}
                        required
                    />
                </FormField>
                <FormField
                    id="debt-settings-initial"
                    label="Valor inicial de referência"
                    hint="Para desconto ou elevação no card."
                >
                    <FormInput
                        id="debt-settings-initial"
                        type="text"
                        inputMode="decimal"
                        value={initialAmount}
                        onChange={(e) => setInitialAmount(e.target.value)}
                        placeholder="Ex.: 5000"
                    />
                </FormField>
                <DebtFormColorField
                    debtName={company.trim() || debt.company || 'Dívida'}
                    selectedKey={colorKey}
                    onSelect={setColorKey}
                    disabled={busy}
                />
                <FormField
                    id="debt-settings-quitada-wrap"
                    label="Situação"
                    hint="Registra quitação no mês seguinte ao último saldo; no gráfico a linha permanece no último valor e cai a zero no mês da quitação."
                >
                    <FormCheckbox
                        id="debt-settings-quitada"
                        label="Dívida quitada"
                        checked={quitada}
                        onChange={setQuitada}
                        disabled={busy}
                    />
                </FormField>
                <FormField id="debt-settings-notes" label="Notas (opcional)">
                    <FormTextarea
                        id="debt-settings-notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </FormField>
                <FormActions onCancel={onClose} busy={busy} submitLabel="Salvar" />
            </DialogForm>
        </DialogFrame>
    );
}