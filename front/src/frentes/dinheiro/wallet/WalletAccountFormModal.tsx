import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DialogForm, DialogFrame } from '../../../components/ui/dialog';
import {
    FormAlert,
    FormCheckbox,
    FormField,
    FormGrid,
    FormInput,
    FormSelect
} from '../../../components/ui/form';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { accountIdTitle, accountShortId } from '../../../lib/accountIdentity';
import { sortedBankAccounts } from '../../../lib/accounts';
import type { Account } from '../../../lib/types/finance';
import { createAccount, updateAccount, type AccountFormPayload } from '../api/wallet';
import {
    PLASTIC_SWATCHES,
    GENERIC_PLASTIC_DEFAULTS,
    canonicalPlasticPair,
    isCustomPlasticAppearance,
    parseWalletPlasticColor,
    serializeWalletPlasticColor,
    buildWalletCardShellGradient
} from '@legacy/js/features/finance/account-plastic-appearance.js';
import {
    WALLET_ACCOUNT_KIND_GROUPS,
    WALLET_CASH_PRIMARY_KINDS,
    WALLET_KIND_OPTION_BY_VALUE,
    kindsNeedCardLink,
    kindsNeedCreditFields,
    kindsShowBalanceField,
    resolveTypeFromKinds,
    walletKindsFromAccount,
    type WalletAccountKind
} from './walletAccountKind';

const FORM_ID = 'wallet-account-form';

type Props = {
    open: boolean;
    accounts: Account[];
    editing: Account | null;
    defaultLinkedBankId?: string;
    defaultKind?: WalletAccountKind;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
};

function kindSummaryLabel(kinds: WalletAccountKind[]): string {
    if (kinds.length === 0) return 'Escolha os tipos abaixo';
    return kinds
        .filter((k) => k !== 'benefit_institution')
        .map((k) => WALLET_KIND_OPTION_BY_VALUE[k].shortLabel ?? WALLET_KIND_OPTION_BY_VALUE[k].label)
        .join(' · ');
}

export function WalletAccountFormModal({
    open,
    accounts,
    editing,
    defaultLinkedBankId,
    defaultKind = 'bank',
    onClose,
    onSaved
}: Props) {
    const [kinds, setKinds] = useState<WalletAccountKind[]>(['bank']);
    const [isPrimaryCash, setIsPrimaryCash] = useState(false);
    const [name, setName] = useState('');
    const [balance, setBalance] = useState('');
    const [limit, setLimit] = useState('');
    const [dueDay, setDueDay] = useState('');
    const [closeDay, setCloseDay] = useState('');
    const [linkedAccountId, setLinkedAccountId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [plasticUseCustom, setPlasticUseCustom] = useState(false);
    const [plasticHex, setPlasticHex] = useState(GENERIC_PLASTIC_DEFAULTS.color);

    const showCreditFields = kindsNeedCreditFields(kinds);
    const showBalanceField = kindsShowBalanceField(kinds);
    const showLinkField = kindsNeedCardLink(kinds);
    const canBePrimary = kinds.some((k) => WALLET_CASH_PRIMARY_KINDS.has(k));

    const linkableAccounts = useMemo(() => sortedBankAccounts(accounts), [accounts]);

    const needsStrictLink = kinds.includes('debit') || kinds.includes('food') || kinds.includes('meal');

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (editing) {
            setName(editing.name);
            setBalance(String(editing.balance ?? editing.initialBalance ?? ''));
            setLimit(String(editing.limit ?? ''));
            setDueDay(String(editing.dueDay ?? ''));
            setCloseDay(String(editing.closeDay ?? editing.closingDay ?? ''));
            setLinkedAccountId(String(editing.linkedAccountId ?? ''));
            setKinds(walletKindsFromAccount(editing));
            setIsPrimaryCash(Boolean(editing.isPrimaryCash));
            const custom = isCustomPlasticAppearance(editing);
            const parsed = parseWalletPlasticColor(editing.plasticColor);
            const pair = canonicalPlasticPair(parsed);
            setPlasticUseCustom(custom);
            setPlasticHex(pair.credit || GENERIC_PLASTIC_DEFAULTS.color);
        } else {
            setName('');
            setBalance('');
            setLimit('');
            setDueDay('10');
            setCloseDay('1');
            setKinds(defaultKind ? [defaultKind] : ['bank']);
            setLinkedAccountId(defaultLinkedBankId ?? '');
            setIsPrimaryCash(false);
            setPlasticUseCustom(false);
            setPlasticHex(GENERIC_PLASTIC_DEFAULTS.color);
        }
    }, [open, editing, defaultKind, defaultLinkedBankId]);

    const plasticPreviewStyle = useMemo(
        () => ({ background: buildWalletCardShellGradient(plasticHex) }),
        [plasticHex]
    );

    useEffect(() => {
        if (!canBePrimary && isPrimaryCash) setIsPrimaryCash(false);
    }, [canBePrimary, isPrimaryCash]);

    function toggleKind(kind: WalletAccountKind) {
        setKinds((prev) => {
            if (prev.includes(kind)) {
                if (prev.length === 1) return prev;
                return prev.filter((k) => k !== kind);
            }
            return [...prev, kind];
        });
    }

    function namePlaceholder() {
        if (kinds.includes('bank')) return 'Ex.: Itaú conta corrente';
        if (kinds.includes('food') || kinds.includes('meal')) return 'Ex.: Caju, Alelo, Swile…';
        if (showLinkField) return 'Ex.: Nubank Ultravioleta, Riachuelo…';
        return 'Nome da conta';
    }

    function linkedFieldLabel() {
        if (kinds.includes('food') || kinds.includes('meal')) return 'Instituição vinculada';
        if (kinds.includes('debit')) return 'Conta para débito';
        return 'Conta vinculada';
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const payload: AccountFormPayload = {
            name: name.trim(),
            type: resolveTypeFromKinds(kinds),
            walletFunctions: kinds.filter((k) => k !== 'benefit_institution'),
            initialBalance: balance ? parseFloat(balance) : 0,
            linkedAccountId: linkedAccountId || null,
            limit: limit ? parseFloat(limit) : null,
            dueDay: dueDay ? parseInt(dueDay, 10) : null,
            closeDay: closeDay ? parseInt(closeDay, 10) : null,
            plasticTone: plasticUseCustom ? 'custom' : null,
            plasticColor: plasticUseCustom
                ? serializeWalletPlasticColor({ color: plasticHex })
                : null
        };
        if (canBePrimary) {
            payload.isPrimaryCash = isPrimaryCash;
        }
        if (!payload.name) {
            setError('Informe o nome.');
            return;
        }
        if (kinds.length === 0) {
            setError('Selecione ao menos uma função.');
            return;
        }
        if (showLinkField && !payload.linkedAccountId && !kinds.includes('store') && !kinds.includes('credit')) {
            setError('Vincule a uma conta ou instituição.');
            return;
        }
        if (isPrimaryCash && !canBePrimary) {
            setError('Conta principal só se aplica a conta corrente ou poupança.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            if (editing) await updateAccount(editing.id, payload);
            else await createAccount(payload);
            window.dispatchEvent(new Event('finance:data-changed'));
            await onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar conta.');
        } finally {
            setBusy(false);
        }
    }

    const submitLabel = editing ? 'Salvar' : 'Adicionar';

    return (
        <DialogFrame
            id="wallet-account-modal"
            open={open}
            title={editing ? 'Editar conta' : 'Nova conta'}
            onClose={onClose}
            size="lg"
            panelClassName="wallet-account-dialog"
            footer={
                <div className="wallet-account-dialog__footer">
                    <button
                        type="button"
                        className="ui-form-btn ui-form-btn--text"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form={FORM_ID}
                        className="ui-form-btn ui-form-btn--contained"
                        disabled={busy}
                    >
                        {busy ? 'Salvando…' : submitLabel}
                    </button>
                </div>
            }
        >
            <DialogForm id={FORM_ID} onSubmit={(e) => void onSubmit(e)} className="wallet-account-form ui-form">
                <p className="wallet-account-form__subtitle">{kindSummaryLabel(kinds)}</p>
                {editing ? (
                    <p className="wallet-account-form__identity">
                        <span
                            className="wallet-catalog-unified__id-tag wallet-catalog-unified__id-tag--form"
                            title={accountIdTitle(editing.id)}
                        >
                            ID {accountShortId(editing.id)}
                        </span>
                        <span className="wallet-account-form__identity-hint">
                            Cada conta tem um identificador único. Para nova função (crédito, VA…), edite esta conta e
                            marque os tipos — não crie outra com o mesmo nome.
                        </span>
                    </p>
                ) : null}
                <FormAlert message={error} />

                <div className="wallet-account-form__card wallet-account-form__card--head">
                    <FormGrid columns={showLinkField ? 2 : 1} className="wallet-account-form__head-grid">
                        <FormField id="wallet-account-name" label="Nome">
                            <FormInput
                                id="wallet-account-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoComplete="off"
                                placeholder={namePlaceholder()}
                            />
                        </FormField>
                        {showLinkField ? (
                            <FormField
                                id="wallet-account-linked"
                                label={linkedFieldLabel()}
                                hint={
                                    kinds.includes('store') || kinds.includes('credit')
                                        ? 'Opcional para cartão de loja.'
                                        : undefined
                                }
                            >
                                <FormSelect
                                    id="wallet-account-linked"
                                    value={linkedAccountId}
                                    onChange={(e) => setLinkedAccountId(e.target.value)}
                                    required={needsStrictLink}
                                >
                                    <option value="">Selecione…</option>
                                    {linkableAccounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} · {accountShortId(a.id)}
                                            {a.isPrimaryCash ? ' · principal' : ''}
                                        </option>
                                    ))}
                                </FormSelect>
                            </FormField>
                        ) : null}
                    </FormGrid>
                </div>

                <WalletAccountKindPicker kinds={kinds} onToggle={toggleKind} />

                <div className="wallet-account-form__card">
                    <FormGrid
                        columns={showBalanceField && canBePrimary ? 2 : 1}
                        className="wallet-account-form__pair"
                    >
                        {showBalanceField ? (
                            <FormField
                                id="wallet-account-balance"
                                label="Saldo inicial"
                                hint={
                                    isPrimaryCash
                                        ? 'Base do saldo no dashboard — altere se estiver inflado.'
                                        : 'Opcional'
                                }
                            >
                                <FormInput
                                    id="wallet-account-balance"
                                    type="number"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={balance}
                                    onChange={(e) => setBalance(e.target.value)}
                                    placeholder="0,00"
                                />
                            </FormField>
                        ) : null}
                        {canBePrimary ? (
                            <FormField id="wallet-account-primary-field" label="Conta principal" hint="Dashboard">
                                <FormCheckbox
                                    id="wallet-account-primary"
                                    checked={isPrimaryCash}
                                    onChange={setIsPrimaryCash}
                                    label="Ativar no dashboard"
                                />
                            </FormField>
                        ) : null}
                    </FormGrid>
                </div>

                <div className="wallet-account-form__card">
                    <h3 className="wallet-account-form__card-title">
                        <MaterialIcon name="palette" variant="app" opticalSize={18} aria-hidden />
                        Cor do cartão
                    </h3>
                    <p className="wallet-account-form__plastic-hint">
                        {plasticUseCustom
                            ? 'Cor personalizada no catálogo.'
                            : 'Usa a cor padrão do banco no catálogo.'}
                    </p>
                    <div className="wallet-account-form__plastic-row">
                        <div
                            className="wallet-account-form__plastic-preview"
                            style={plasticPreviewStyle}
                            aria-hidden
                        />
                        <div className="wallet-account-form__plastic-controls">
                            <div className="wallet-account-form__plastic-swatches" role="group" aria-label="Cores">
                                {PLASTIC_SWATCHES.map((swatch) => (
                                    <button
                                        key={swatch.hex}
                                        type="button"
                                        className={`wallet-account-form__plastic-swatch${
                                            plasticUseCustom && plasticHex === swatch.hex ? ' is-active' : ''
                                        }`}
                                        style={{ background: swatch.hex }}
                                        title={swatch.label}
                                        aria-label={swatch.label}
                                        aria-pressed={plasticUseCustom && plasticHex === swatch.hex}
                                        onClick={() => {
                                            setPlasticUseCustom(true);
                                            setPlasticHex(swatch.hex);
                                        }}
                                    />
                                ))}
                            </div>
                            <div className="wallet-account-form__plastic-more">
                                <label className="wallet-account-form__plastic-color-btn" title="Outra cor">
                                    <input
                                        type="color"
                                        className="wallet-account-form__plastic-color-input"
                                        value={plasticHex}
                                        onChange={(e) => {
                                            setPlasticUseCustom(true);
                                            setPlasticHex(e.target.value);
                                        }}
                                    />
                                    <span className="wallet-account-form__plastic-color-dot" style={{ background: plasticHex }} />
                                    Outra cor
                                </label>
                                <button
                                    type="button"
                                    className="wallet-account-form__plastic-reset"
                                    disabled={!plasticUseCustom}
                                    onClick={() => setPlasticUseCustom(false)}
                                >
                                    Padrão do banco
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {showCreditFields ? (
                    <div className="wallet-account-form__card">
                        <h3 className="wallet-account-form__card-title">
                            <MaterialIcon name="credit_card" variant="app" opticalSize={18} aria-hidden />
                            Crédito
                        </h3>
                        <FormGrid columns={2}>
                            <FormField id="wallet-account-limit" label="Limite">
                                <FormInput
                                    id="wallet-account-limit"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    inputMode="decimal"
                                    value={limit}
                                    onChange={(e) => setLimit(e.target.value)}
                                />
                            </FormField>
                            <FormField id="wallet-account-due-day" label="Vencimento (dia)">
                                <FormInput
                                    id="wallet-account-due-day"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={dueDay}
                                    onChange={(e) => setDueDay(e.target.value)}
                                />
                            </FormField>
                            <FormField id="wallet-account-close-day" label="Fechamento (dia)">
                                <FormInput
                                    id="wallet-account-close-day"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={closeDay}
                                    onChange={(e) => setCloseDay(e.target.value)}
                                />
                            </FormField>
                        </FormGrid>
                    </div>
                ) : null}
            </DialogForm>
        </DialogFrame>
    );
}

function WalletAccountKindPicker({
    kinds,
    onToggle
}: {
    kinds: WalletAccountKind[];
    onToggle: (kind: WalletAccountKind) => void;
}) {
    const selected = new Set(kinds);

    return (
        <section className="wallet-account-form__card wallet-account-form__card--kinds" aria-label="Tipos de conta">
            {WALLET_ACCOUNT_KIND_GROUPS.map((group) => (
                <div key={group.id} className="wallet-account-kind-group">
                    <span className="wallet-account-kind-group__label">{group.title}</span>
                    <div className="wallet-account-kind-chips" role="group" aria-label={group.title}>
                        {group.kinds.map((value) => {
                            const opt = WALLET_KIND_OPTION_BY_VALUE[value];
                            const isOn = selected.has(value);
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className={`wallet-account-kind-chip${isOn ? ' is-active' : ''}`}
                                    aria-pressed={isOn}
                                    onClick={() => onToggle(value)}
                                >
                                    {opt.icon ? (
                                        <MaterialIcon
                                            name={opt.icon}
                                            variant="app"
                                            opticalSize={16}
                                            aria-hidden
                                        />
                                    ) : null}
                                    <span>{opt.shortLabel ?? opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </section>
    );
}