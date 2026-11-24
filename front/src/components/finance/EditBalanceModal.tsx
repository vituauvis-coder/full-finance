import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
    formatBalanceInputValue,
    parseBalanceSubmit,
    profileCurrencySymbol
} from '@motor/conta/profile-rules.js';
import { DialogForm, DialogFrame } from '../ui/dialog/Dialog';
import { MaterialIcon } from '../icons/MaterialIcon';
import { formatBRL } from '../../lib/format';
import { postProfileBalance } from '../../frentes/perfil/api/profileApi';
import { fetchProfilePeriodBalance } from '../../frentes/perfil/domain/profileBalance';
import { notifyProfileUpdated } from '../../lib/profileEvents';
import { playPingSound } from '../../app/uiSounds';
import './edit-balance-modal.css';

type Props = {
    open: boolean;
    currency: string;
    accountLabel?: string | null;
    accountHolder?: string | null;
    displayBalance?: string;
    onClose: () => void;
    onSaved?: () => Promise<void> | void;
};

export function EditBalanceModal({
    open,
    currency,
    accountLabel,
    accountHolder,
    displayBalance,
    onClose,
    onSaved
}: Props) {
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);
    const [input, setInput] = useState('');
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const currencySymbol = profileCurrencySymbol(currency);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setError(null);
        setLoadingInitial(true);

        void fetchProfilePeriodBalance()
            .then((bal) => {
                if (cancelled) return;
                setCurrentBalance(bal);
                if (bal != null) {
                    setInput(formatBalanceInputValue(bal).replace('.', ','));
                } else {
                    setInput('');
                }
            })
            .catch(() => {
                if (!cancelled) setCurrentBalance(null);
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingInitial(false);
                    requestAnimationFrame(() => {
                        inputRef.current?.focus();
                        inputRef.current?.select();
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    const parsed = useMemo(() => parseBalanceSubmit(input), [input]);
    const diff = useMemo(() => {
        if (currentBalance == null || !parsed.ok) return null;
        const delta = Math.round((parsed.balance - currentBalance) * 100) / 100;
        return delta;
    }, [currentBalance, parsed]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!parsed.ok) {
            setError('Informe um valor numérico válido.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await postProfileBalance(parsed.balance);
            playPingSound();
            notifyProfileUpdated();
            await onSaved?.();
            onClose();
        } catch {
            setError('Não foi possível atualizar o saldo. Tente novamente.');
        } finally {
            setSaving(false);
        }
    }

    const scopeLabel = accountLabel
        ? `${accountLabel}${accountHolder ? ` · ${accountHolder}` : ''}`
        : 'Contas de caixa';

    const currentFormatted =
        currentBalance != null ? formatBRL(currentBalance, currency) : displayBalance ?? '—';

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            title="Editar saldo"
            size="sm"
            id="edit-balance-modal"
            panelClassName="edit-balance-modal"
            footer={
                <>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="edit-balance-form"
                        className="btn-primary"
                        disabled={saving || loadingInitial || !parsed.ok}
                    >
                        <MaterialIcon name="check" variant="app" opticalSize={16} aria-hidden />
                        {saving ? 'Salvando…' : 'Salvar saldo'}
                    </button>
                </>
            }
        >
            <DialogForm id="edit-balance-form" onSubmit={(e) => void handleSubmit(e)} className="edit-balance-modal__form">
                <div className="edit-balance-modal__summary">
                    <div className="edit-balance-modal__summary-meta">
                        <span className="edit-balance-modal__summary-label">Saldo atual</span>
                        <span className="edit-balance-modal__account-pill">{scopeLabel}</span>
                    </div>
                    <strong className="edit-balance-modal__summary-value">{currentFormatted}</strong>
                </div>

                <label className="edit-balance-modal__field" htmlFor="edit-balance-input">
                    <span className="edit-balance-modal__field-label">Novo saldo real</span>
                    <div className="edit-balance-modal__input-wrap">
                        <span className="edit-balance-modal__prefix" aria-hidden>
                            {currencySymbol}
                        </span>
                        <input
                            ref={inputRef}
                            id="edit-balance-input"
                            type="text"
                            inputMode="decimal"
                            className="edit-balance-modal__input"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder={loadingInitial ? 'Carregando…' : '0,00'}
                            disabled={loadingInitial || saving}
                            autoComplete="off"
                            required
                        />
                    </div>
                </label>

                {diff != null && Math.abs(diff) >= 0.005 ? (
                    <div
                        className={`edit-balance-modal__delta ${
                            diff > 0 ? 'edit-balance-modal__delta--pos' : 'edit-balance-modal__delta--neg'
                        }`}
                    >
                        <MaterialIcon
                            name={diff > 0 ? 'trending_up' : 'trending_down'}
                            variant="app"
                            opticalSize={16}
                            aria-hidden
                        />
                        <span>
                            Ajuste de{' '}
                            <strong>
                                {diff > 0 ? '+' : '−'}
                                {formatBRL(Math.abs(diff), currency)}
                            </strong>
                        </span>
                    </div>
                ) : null}

                <p className="edit-balance-modal__hint">
                    {accountLabel
                        ? 'Iguala o saldo exibido no dashboard ao valor real da conta principal.'
                        : 'Com conta principal definida na Carteira, o ajuste vale só para ela; caso contrário, corrige o total de caixa.'}
                </p>

                {error ? (
                    <p className="edit-balance-modal__error" role="alert">
                        {error}
                    </p>
                ) : null}
            </DialogForm>
        </DialogFrame>
    );
}
