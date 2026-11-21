import type { ReactNode } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../../../lib/format';
import {
    computeDebtChangeFromInitial,
    getCurrentDebtAmount,
    resolveInitialDebtAmount
} from '../../domain/debtAggregations';
import { debtColorHex, type DebtColorKey } from '../../domain/debtColors';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import { DebtColorPicker } from './DebtColorPicker';

type Props = {
    debt: Debt;
    updates: DebtUpdate[];
    currency: string;
    onRegister: (debtId: string) => void;
    onSettings: (debtId: string) => void;
    onColorChange: (debtId: string, colorKey: DebtColorKey) => void | Promise<void>;
};

export function DebtGoalCard({
    debt,
    updates,
    currency,
    onRegister,
    onSettings,
    onColorChange
}: Props) {
    const isQuitada = debt.isClosed === true;
    const current = getCurrentDebtAmount(updates, debt.id);
    const initial = resolveInitialDebtAmount(debt, updates);
    const change = computeDebtChangeFromInitial(initial, current);
    const hex = debtColorHex(debt.colorKey);
    const name = debt.company || '—';
    const remainingPct =
        initial != null && initial > 0 && current != null
            ? Math.min(100, Math.max(0, (current / initial) * 100))
            : 0;

    let metaSecondary: ReactNode;
    if (isQuitada) {
        metaSecondary = <span className="debt-bucket-card__meta--quitada">Dívida quitada — saldo zerado no gráfico</span>;
    } else if (initial == null && current == null) {
        metaSecondary = <span className="debt-bucket-card__meta-unset">Sem saldo registrado</span>;
    } else if (!change) {
        metaSecondary = (
            <>
                <span>
                    Inicial {initial != null ? formatBRL(initial, currency) : '—'}
                </span>
                <span aria-hidden="true">·</span>
                <span>Defina o valor inicial</span>
            </>
        );
    } else if (change.kind === 'discounted') {
        metaSecondary = (
            <>
                <span>Inicial {initial != null ? formatBRL(initial, currency) : '—'}</span>
                <span aria-hidden="true">·</span>
                <span className="debt-bucket-card__meta--discounted">
                    −{change.percent.toFixed(1)}% ({formatBRL(Math.abs(change.delta), currency)} abaixo)
                </span>
            </>
        );
    } else if (change.kind === 'elevated') {
        metaSecondary = (
            <>
                <span>Inicial {initial != null ? formatBRL(initial, currency) : '—'}</span>
                <span aria-hidden="true">·</span>
                <span className="debt-bucket-card__meta--elevated">
                    +{change.percent.toFixed(1)}% ({formatBRL(change.delta, currency)} acima)
                </span>
            </>
        );
    } else {
        metaSecondary = (
            <>
                <span>Inicial {initial != null ? formatBRL(initial, currency) : '—'}</span>
                <span aria-hidden="true">·</span>
                <span>Igual ao inicial</span>
            </>
        );
    }

    return (
        <article
            className={`zero-budget__block-card debt-bucket-card${isQuitada ? ' debt-bucket-card--quitada' : ''}`}
            data-debt-id={debt.id}
            data-debt-quitada={isQuitada ? 'true' : undefined}
            style={{ ['--zb-accent' as string]: hex }}
        >
            <header className="zero-budget__block-head">
                <div className="zero-budget__block-title-row">
                    <span
                        className={`zero-budget__block-dot${isQuitada ? ' debt-bucket-card__dot-quitada' : ''}`}
                        style={isQuitada ? undefined : { backgroundColor: hex }}
                        aria-hidden="true"
                    />
                    <h3 className="zero-budget__block-title" title={name}>
                        {name}
                    </h3>
                </div>
                <button
                    type="button"
                    className="zero-budget__block-delete"
                    title="Definições"
                    aria-label={`Definições — ${name}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSettings(debt.id);
                    }}
                >
                    <MaterialIcon name="settings" variant="app" filled={false} weight={500} opticalSize={20} />
                </button>
            </header>

            <div className="debt-bucket-card__amount-stack">
                <div className="zero-budget__block-amount-wrap">
                    <span className="zero-budget__block-amount-value debt-bucket-card__amount">
                        {isQuitada ? formatBRL(0, currency) : current != null ? formatBRL(current, currency) : '—'}
                    </span>
                </div>
                {isQuitada ? (
                    <span className="debt-bucket-card__badge-quitada" aria-label="Dívida quitada">
                        <MaterialIcon name="check_circle" variant="app" weight={600} opticalSize={14} />
                        Quitada
                    </span>
                ) : null}
            </div>

            <p className="zero-budget__block-slider-meta">{metaSecondary}</p>

            {!isQuitada && initial != null && initial > 0 && current != null ? (
                <div
                    className="debt-bucket-card__progress"
                    role="progressbar"
                    aria-valuenow={Math.round(remainingPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Saldo em relação ao valor inicial"
                >
                    <span style={{ width: `${remainingPct.toFixed(1)}%`, backgroundColor: hex }} />
                </div>
            ) : null}

            <footer className="zero-budget__block-foot debt-bucket-card__foot">
                <DebtColorPicker
                    debtName={name}
                    selectedKey={debt.colorKey}
                    onSelect={(colorKey) => onColorChange(debt.id, colorKey)}
                />
                <div className="debt-bucket-card__actions">
                    <button type="button" className="zero-budget__block-list-btn" onClick={() => onRegister(debt.id)}>
                        <MaterialIcon name="add" variant="app" filled={false} weight={500} opticalSize={20} />
                        Registrar mês
                    </button>
                </div>
            </footer>
        </article>
    );
}