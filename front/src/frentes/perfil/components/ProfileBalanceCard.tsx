import type { FormEvent } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { ProfileCard } from './ProfileCard';

type Props = {
    currencySymbol: string;
    balance: string;
    onBalanceChange: (v: string) => void;
    saving: boolean;
    message: string | null;
    onSubmit: (e: FormEvent) => void;
    /** Dentro de `profile-modern__bento-stack` (sem célula própria no bento). */
    nested?: boolean;
};

export function ProfileBalanceCard({
    currencySymbol,
    balance,
    onBalanceChange,
    saving,
    message,
    onSubmit,
    nested
}: Props) {
    return (
        <ProfileCard
            slot={nested ? false : 'half'}
            title="Ajuste de saldo"
            subtitle="Iguala o saldo do dashboard ao valor real (conta principal, se houver)"
            icon="payments"
        >
            <form
                className="profile-modern__form profile-modern__form--balance"
                onSubmit={onSubmit}
            >
                <label className="profile-modern__field">
                    <span>Saldo total atual ({currencySymbol})</span>
                    <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        id="profile-current-balance"
                        value={balance}
                        onChange={(e) => onBalanceChange(e.target.value)}
                        required
                        placeholder="0,00"
                        className="profile-modern__input"
                    />
                </label>
                <button type="submit" className="profile-modern__btn" disabled={saving}>
                    <MaterialIcon name="sync" variant="app" />
                    {saving ? 'Atualizando…' : 'Atualizar'}
                </button>
                <p className="profile-modern__field-hint profile-modern__field-hint--balance">
                    Com conta principal na Carteira, o ajuste vale só para ela. Caso contrário, corrige o total de
                    todas as contas de caixa.
                </p>
                {message ? <p className="profile-modern__feedback">{message}</p> : null}
            </form>
        </ProfileCard>
    );
}