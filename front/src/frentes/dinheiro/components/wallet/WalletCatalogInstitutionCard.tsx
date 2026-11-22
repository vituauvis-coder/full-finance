import { useMemo } from 'react';
import {
    buildWalletCardShellGradient,
    resolvePlasticColors
} from '@legacy/js/features/finance/account-plastic-appearance.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../../../lib/format';
import { accountTypeDisplayLabel } from '../../../../lib/walletAccountLabels';
import {
    WALLET_KIND_OPTION_BY_VALUE,
    walletKindsFromAccount
} from '../../wallet/walletAccountKind';
import { accountIdTitle, accountShortId } from '../../../../lib/accountIdentity';
import type { Account, FinanceData } from '../../../../lib/types/finance';
import type { WalletCatalogFacet, WalletCatalogGroup } from '../../domain/walletCatalogGroups';
import { walletDisplayCashBalance } from '../../domain/walletCashBalance';

type Props = {
    group: WalletCatalogGroup;
    data: FinanceData;
    year: number;
    monthIndex: number;
    currency: string;
    monthLbl: string;
    onEdit: (account: Account) => void;
};

function cashFacet(facets: WalletCatalogFacet[]) {
    return facets.find(
        (f): f is Extract<WalletCatalogFacet, { kind: 'balance' | 'savings' | 'investment' }> =>
            f.kind === 'balance' || f.kind === 'savings' || f.kind === 'investment'
    );
}

function creditFacet(facets: WalletCatalogFacet[]) {
    return facets.find((f): f is Extract<WalletCatalogFacet, { kind: 'credit' }> => f.kind === 'credit');
}

function cofrinhoFacet(facets: WalletCatalogFacet[]) {
    return facets.find((f): f is Extract<WalletCatalogFacet, { kind: 'cofrinho' }> => f.kind === 'cofrinho');
}

function MetricCell({
    label,
    value,
    meta,
    cardId,
    tone
}: {
    label: string;
    value: string;
    meta?: string;
    cardId?: string;
    tone?: 'credit' | 'cofrinho' | 'neutral';
}) {
    const className = [
        'wallet-catalog-unified__metric',
        tone ? `wallet-catalog-unified__metric--${tone}` : '',
        cardId ? 'wallet-card-open' : 'wallet-catalog-unified__metric--static'
    ]
        .filter(Boolean)
        .join(' ');

    const body = (
        <>
            <span className="wallet-catalog-unified__metric-label">{label}</span>
            <strong className="wallet-catalog-unified__metric-value">{value}</strong>
            {meta ? <span className="wallet-catalog-unified__metric-meta">{meta}</span> : null}
        </>
    );

    if (cardId) {
        return (
            <button type="button" className={className} data-card-id={cardId} aria-label={`${label}: ${value}`}>
                {body}
            </button>
        );
    }

    return <div className={className}>{body}</div>;
}

/** Um cartão por instituição — saldo, fatura, limite e cofrinho no mesmo painel. */
export function WalletCatalogInstitutionCard({
    group,
    data,
    year,
    monthIndex,
    currency,
    monthLbl,
    onEdit
}: Props) {
    const { title, themeClass, facets, primaryAccount } = group;
    const cash = cashFacet(facets);
    const credit = creditFacet(facets);
    const cofrinho = cofrinhoFacet(facets);

    const balanceAccount = cash?.account ?? primaryAccount;
    const balanceValue = formatBRL(
        walletDisplayCashBalance(data, balanceAccount, { year, monthIndex }),
        currency
    );

    const invoiceValue = credit ? formatBRL(credit.invoice, currency) : '—';
    const limitValue =
        credit && Number(credit.limit) > 0 ? formatBRL(credit.limit, currency) : credit ? 'Sem limite' : '—';
    const cofrinhoNet = cofrinho
        ? cofrinho.net ?? cofrinho.accumulated - cofrinho.withdrawn
        : 0;
    const cofrinhoHasActivity =
        cofrinho &&
        (cofrinho.accumulated > 0 || cofrinho.withdrawn > 0 || Math.abs(cofrinhoNet) > 0);
    const cofrinhoValue = cofrinho ? formatBRL(cofrinhoNet, currency) : '—';
    const cofrinhoMeta = useMemo(() => {
        if (!cofrinho || !cofrinhoHasActivity) return cofrinho ? 'Sem aportes nesta conta vinculada' : undefined;
        const parts: string[] = [];
        const ledgerName = cofrinho.ledgerAccountId
            ? data.userAccounts.find((a) => a.id === cofrinho.ledgerAccountId)?.name
            : undefined;
        if (ledgerName) parts.push(`Saídas: ${ledgerName}`);
        const monthDelta = cofrinho.monthAccumulated - cofrinho.monthWithdrawn;
        if (monthDelta !== 0) {
            parts.push(`${monthLbl}: ${monthDelta > 0 ? '+' : '−'}${formatBRL(Math.abs(monthDelta), currency)}`);
        }
        if (cofrinho.accumulated > 0) parts.push(`Aportado ${formatBRL(cofrinho.accumulated, currency)}`);
        if (cofrinho.withdrawn > 0) parts.push(`Usado ${formatBRL(cofrinho.withdrawn, currency)}`);
        if (cofrinho.lastEventAt) {
            const d = new Date(`${cofrinho.lastEventAt}T12:00:00`);
            if (!Number.isNaN(d.getTime())) {
                parts.push(
                    `Último ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace(/\./g, '')}`
                );
            }
        }
        return parts.join(' · ');
    }, [cofrinho, cofrinhoHasActivity, monthLbl, currency, data.userAccounts]);

    const balanceCardId = cash?.account.id ?? primaryAccount.id;
    const creditCardId = credit?.card.id;
    const cofrinhoCardId = cofrinho?.ledgerAccountId ?? cofrinho?.account.id;

    const dueHint =
        credit?.dueDay != null ? `Vence dia ${credit.dueDay}` : credit ? `Ref. ${monthLbl}` : undefined;

    const shellStyle = useMemo(() => {
        const custom = resolvePlasticColors(primaryAccount, null);
        if (!custom?.credit) return undefined;
        return { background: buildWalletCardShellGradient(custom.credit) };
    }, [primaryAccount]);

    return (
        <article className={`wallet-catalog-unified ${themeClass}`.trim()} data-group-id={group.id}>
            <div className="wallet-catalog-unified__shell" style={shellStyle}>
                <header className="wallet-catalog-unified__head">
                    <div className="wallet-catalog-unified__titles">
                        <h3 className="wallet-catalog-unified__name">
                            {title}
                            {primaryAccount.isPrimaryCash ? (
                                <span className="wallet-catalog-unified__primary">Principal</span>
                            ) : null}
                        </h3>
                        <p className="wallet-catalog-unified__type">
                            {walletKindsFromAccount(primaryAccount)
                                .map((k) => WALLET_KIND_OPTION_BY_VALUE[k]?.shortLabel ?? k)
                                .join(' · ') || accountTypeDisplayLabel(primaryAccount.type)}
                            <span
                                className="wallet-catalog-unified__id-tag"
                                title={accountIdTitle(primaryAccount.id)}
                            >
                                {accountShortId(primaryAccount.id)}
                            </span>
                        </p>
                    </div>
                    <button
                        type="button"
                        className="wallet-catalog-unified__edit"
                        onClick={() => onEdit(primaryAccount)}
                    >
                        Editar
                    </button>
                </header>

                <div className="wallet-catalog-unified__metrics" role="group" aria-label={`Resumo ${title}`}>
                    <MetricCell label="Saldo" value={balanceValue} cardId={balanceCardId} />
                    <MetricCell
                        label="Fatura"
                        value={invoiceValue}
                        meta={dueHint}
                        cardId={creditCardId}
                        tone="credit"
                    />
                    <MetricCell
                        label="Limite"
                        value={limitValue}
                        cardId={creditCardId}
                        tone="neutral"
                    />
                    {cofrinho ? (
                        <MetricCell
                            label="Cofrinho"
                            value={cofrinhoValue}
                            meta={cofrinhoMeta}
                            cardId={cofrinhoCardId}
                            tone="cofrinho"
                        />
                    ) : null}
                </div>

                {credit && credit.invoice > 0 && credit.dueDay != null ? (
                    <footer className="wallet-catalog-unified__foot">
                        <MaterialIcon name="event" variant="app" opticalSize={14} aria-hidden />
                        <span>
                            Fatura <strong>{formatBRL(credit.invoice, currency)}</strong> · vence dia{' '}
                            <strong>{credit.dueDay}</strong>
                        </span>
                    </footer>
                ) : null}
            </div>
        </article>
    );
}