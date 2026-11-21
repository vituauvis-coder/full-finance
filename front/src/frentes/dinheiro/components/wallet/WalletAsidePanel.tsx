import { formatBRL } from '../../../../lib/format';
import { MONTH_NAMES } from '../../../../lib/period';
import type { Account } from '../../../../lib/types/finance';
import type { WalletActivityItem } from '../../domain/walletInstitutions';

type DueRow = {
    card: Account;
    dueLabel: string;
    amount: number;
};

type Props = {
    monthIndex: number;
    year: number;
    currency: string;
    dueRows: DueRow[];
    activity: WalletActivityItem[];
};

export function WalletAsidePanel({ monthIndex, year, currency, dueRows, activity }: Props) {
    const monthLbl = `${MONTH_NAMES[monthIndex]}/${String(year).slice(-2)}`;

    return (
        <>
            <div id="wallet-due-panel" className="wallet-aside-card">
                <h3 className="wallet-aside-card__title">
                    Vencimentos <span className="wallet-aside-card__title-note">{monthLbl}</span>
                </h3>
                <div id="wallet-due-list" className="wallet-aside-card__body">
                    {dueRows.length === 0 ? (
                        <p className="wallet-aside-empty">Nenhum cartão de crédito.</p>
                    ) : (
                        dueRows.map((row) => {
                            const amtCls =
                                row.amount > 0
                                    ? 'wallet-aside-row__amt wallet-aside-row__amt--out'
                                    : 'wallet-aside-row__amt wallet-aside-row__amt--zero';
                            return (
                                <div key={row.card.id} className="wallet-aside-row wallet-aside-row--compact">
                                    <div className="wallet-aside-row__main">
                                        <div className="wallet-aside-row__name">{row.card.name}</div>
                                        <div className="wallet-aside-row__sub">{row.dueLabel}</div>
                                    </div>
                                    <div className={amtCls}>{formatBRL(row.amount, currency)}</div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            <div id="wallet-activity-panel" className="wallet-aside-card">
                <h3 className="wallet-aside-card__title">
                    Compras na fatura <span className="wallet-aside-card__title-note">{monthLbl}</span>
                </h3>
                <div id="wallet-activity-list" className="wallet-aside-card__body">
                    {activity.length === 0 ? (
                        <p className="wallet-aside-empty">
                            Nenhuma parcela desta fatura com vencimento em {monthLbl}.
                        </p>
                    ) : (
                        activity.map((m, i) => {
                            const sub =
                                m.inst != null
                                    ? `Parcela ${m.inst.index} de ${m.inst.total} · ${m.cardName}`
                                    : m.cardName;
                            return (
                                <div key={`${m.label}-${i}`} className="wallet-aside-row">
                                    <div className="wallet-aside-row__main">
                                        <div className="wallet-aside-row__name">{m.label}</div>
                                        <div className="wallet-aside-row__sub">{sub}</div>
                                    </div>
                                    <div className="wallet-aside-row__amt wallet-aside-row__amt--out">
                                        {formatBRL(m.amount, currency)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}