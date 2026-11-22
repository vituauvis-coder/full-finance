import { useMemo } from 'react';
import type { PaymentOption } from '../../lib/accounts';
import { EXPENSE_LOAN_PAYMENT_VALUE } from '../../lib/loanExpense';
import { FormSelect } from '../ui/form';

type Props = {
    paymentMethodId: string;
    onChange: (id: string) => void;
    paymentOptions: PaymentOption[];
    loanMode: boolean;
};

export function ExpenseFormPaymentPicker({ paymentMethodId, onChange, paymentOptions, loanMode }: Props) {
    const pixOptions = useMemo(() => paymentOptions.filter((o) => o.group === 'pix'), [paymentOptions]);
    const cardOptions = useMemo(() => paymentOptions.filter((o) => o.group === 'card'), [paymentOptions]);

    if (loanMode) {
        return (
            <FormSelect
                id="expense-payment-method"
                value={paymentMethodId || EXPENSE_LOAN_PAYMENT_VALUE}
                onChange={(e) => onChange(e.target.value)}
                required
                aria-label="Forma de pagamento"
            >
                {pixOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </FormSelect>
        );
    }

    if (!pixOptions.length && !cardOptions.length) {
        return (
            <p className="expense-form-modal__pay-empty">
                Cadastre uma conta na Carteira.
            </p>
        );
    }

    return (
        <FormSelect
            id="expense-payment-method"
            value={paymentMethodId}
            onChange={(e) => onChange(e.target.value)}
            required
            aria-label="Forma de pagamento"
        >
            <option value="">Selecione…</option>
            {pixOptions.length > 0 ? (
                <optgroup label="PIX">
                    {pixOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label.replace(/^PIX — /, '')}
                        </option>
                    ))}
                </optgroup>
            ) : null}
            {cardOptions.length > 0 ? (
                <optgroup label="Cartões">
                    {cardOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </optgroup>
            ) : null}
        </FormSelect>
    );
}