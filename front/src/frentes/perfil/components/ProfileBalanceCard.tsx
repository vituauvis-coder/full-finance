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
};

export function ProfileBalanceCard({
    currencySymbol,
    balance,
    onBalanceChange,
    saving,
    message,
    onSubmit
}: Props) {
    return (
        <ProfileCard
            slot="half"
            title="Ajuste de saldo"
            subtitle="Defina o saldo total atual da sua conta"
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
                    Novo ponto de partida para o cálculo do saldo.
                </p>
                {message ? <p className="profile-modern__feedback">{message}</p> : null}
            </form>
        </ProfileCard>
    );
}