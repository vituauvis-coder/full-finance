import { useId, useMemo, useState } from 'react';
import { formatBRL } from '../../utils/map-utils';

type PaymentSliceKey = 'pix' | 'card_once' | 'card_installment' | 'other';

type PaymentSlice = {
    key: PaymentSliceKey;
    label: string;
    value: number;
    color: string;
    hint?: string;
};

type Props = {
    total: number;
    pixPaid: number;
    cardSingle: number;
    cardInstallmentTotal: number;
    cardInstallmentMonthly?: number;
};

const PAYMENT_COLORS: Record<PaymentSliceKey, string> = {
    pix: 'color-mix(in srgb, var(--v-turquesa) 85%, var(--v-janela))',
    card_once: 'color-mix(in srgb, var(--v-ouro) 72%, var(--v-janela))',
    card_installment: 'color-mix(in srgb, var(--v-ouro) 95%, var(--v-coral))',
    other: 'color-mix(in srgb, var(--v-coral) 55%, var(--v-tinta))'
};

export function OrcamentoPaymentDonut({
    total,
    pixPaid,
    cardSingle,
    cardInstallmentTotal,
    cardInstallmentMonthly = 0
}: Props) {
    const listId = useId();
    const [active, setActive] = useState<PaymentSliceKey | null>(null);

    const cardCommitted = cardSingle + cardInstallmentTotal;

    const slices = useMemo(() => {
        const other = Math.max(0, total - pixPaid - cardCommitted);
        const list: PaymentSlice[] = [];
        if (pixPaid > 0) {
            list.push({ key: 'pix', label: 'Pix', value: pixPaid, color: PAYMENT_COLORS.pix });
        }
        if (cardSingle > 0) {
            list.push({
                key: 'card_once',
                label: 'Cartão à vista',
                value: cardSingle,
                color: PAYMENT_COLORS.card_once,
                hint: '1x no cartão — total na fatura'
            });
        }
        if (cardInstallmentTotal > 0) {
            list.push({
                key: 'card_installment',
                label: 'Cartão parcelado',
                value: cardInstallmentTotal,
                color: PAYMENT_COLORS.card_installment,
                hint:
                    cardInstallmentMonthly > 0
                        ? `Compromisso total parcelado · ~${formatBRL(cardInstallmentMonthly)}/mês no Dinheiro`
                        : 'Soma das compras em 2x ou mais no cartão'
            });
        }
        if (other > 0.009) {
            list.push({ key: 'other', label: 'Outros', value: other, color: PAYMENT_COLORS.other });
        }
        return list;
    }, [total, pixPaid, cardSingle, cardInstallmentTotal, cardCommitted, cardInstallmentMonthly]);

    const sum = slices.reduce((p, s) => p + s.value, 0);
    const empty = total <= 0 || sum <= 0;

    const r = 70;
    const stroke = 20;
    const c = 2 * Math.PI * r;
    const cx = 80;
    const cy = 80;
    const vb = 160;

    let offset = 0;
    const arcs = slices.map((s) => {
        const frac = sum > 0 ? s.value / sum : 0;
        const len = frac * c;
        const arc = {
            ...s,
            dash: `${len} ${Math.max(0, c - len)}`,
            offset: -offset,
            pct: total > 0 ? Math.round((s.value / total) * 100) : 0
        };
        offset += len;
        return arc;
    });

    const focus = active ? arcs.find((a) => a.key === active) : null;

    return (
        <div className="orc-donut orc-donut--categories orc-donut--payment" aria-label="Gastos da viagem por forma de pagamento">
            <header className="orc-donut-cats__head">
                <span className="orc-donut-cats__kicker">Gastos da viagem</span>
            </header>
            <div className={`orc-donut__stage orc-donut__stage--categories${empty ? ' is-empty' : ''}`}>
                <div className={`orc-donut__figure orc-donut__figure--categories${empty ? ' is-empty' : ''}`}>
                    <svg className="orc-donut__svg" viewBox={`0 0 ${vb} ${vb}`} role="img" aria-labelledby={listId}>
                        <title id={listId}>Total da viagem por forma de pagamento</title>
                        <circle cx={cx} cy={cy} r={r} className="orc-donut__track" strokeWidth={stroke} fill="none" />
                        {!empty ? (
                            <g transform={`rotate(-90 ${cx} ${cy})`}>
                                {arcs.map((a) => {
                                    const dim = active != null && active !== a.key;
                                    const boost = active === a.key;
                                    return (
                                        <circle
                                            key={a.key}
                                            cx={cx}
                                            cy={cy}
                                            r={r}
                                            fill="none"
                                            stroke={a.color}
                                            strokeWidth={boost ? stroke + 4 : stroke}
                                            strokeLinecap="round"
                                            strokeDasharray={a.dash}
                                            strokeDashoffset={a.offset}
                                            className={`orc-donut__slice orc-donut__slice--pay-${a.key}${dim ? ' is-dim' : ''}${boost ? ' is-active' : ''}`}
                                            onMouseEnter={() => setActive(a.key)}
                                            onMouseLeave={() => setActive(null)}
                                            onFocus={() => setActive(a.key)}
                                            onBlur={() => setActive(null)}
                                            style={{ pointerEvents: 'stroke' }}
                                            tabIndex={0}
                                            role="graphics-symbol"
                                            aria-label={`${a.label} ${formatBRL(a.value)}`}
                                        />
                                    );
                                })}
                            </g>
                        ) : null}
                    </svg>
                    <div className="orc-donut__center">
                        {focus ? (
                            <>
                                <span className="orc-donut__center-tag orc-donut__center-tag--cat">{focus.label}</span>
                                <strong className="orc-donut__center-val">{formatBRL(focus.value)}</strong>
                                <span className="orc-donut__center-pct">{focus.pct}% do total</span>
                                {focus.hint ? (
                                    <span className="orc-donut__center-hint">{focus.hint}</span>
                                ) : null}
                            </>
                        ) : (
                            <>
                                <span className="orc-donut__center-label">{empty ? 'Sem gastos' : 'Total viagem'}</span>
                                <strong className="orc-donut__center-val orc-donut__center-val--coral">
                                    {empty ? '—' : formatBRL(total)}
                                </strong>
                            </>
                        )}
                    </div>
                </div>

                <div className="orc-donut__legend orc-donut__legend--categories" role="tablist" aria-label="Formas de pagamento">
                    {arcs.map((s) => {
                        const isOn = active === s.key;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={isOn}
                                className={`orc-donut__chip orc-donut__chip--cat orc-donut__chip--pay-${s.key}${isOn ? ' is-active' : ''}${s.value <= 0 ? ' is-zero' : ''}`}
                                onMouseEnter={() => setActive(s.key)}
                                onMouseLeave={() => setActive(null)}
                                onFocus={() => setActive(s.key)}
                                onBlur={() => setActive(null)}
                                onClick={() => setActive(isOn ? null : s.key)}
                                title={s.hint}
                            >
                                <span className="orc-donut__chip-dot" style={{ background: s.color }} aria-hidden />
                                <span className="orc-donut__chip-name">{s.label}</span>
                                <strong className="orc-donut__chip-val">{formatBRL(s.value)}</strong>
                                <span className="orc-donut__chip-pct">{s.pct}%</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}