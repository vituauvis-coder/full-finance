import { FormInput } from '../../../../components/ui/form';
import { formatBRL } from '../../../../lib/format';
import { parseMoneyInput } from '../../domain/parseMoneyInput';

type Props = {
    id: string;
    value: string;
    onChange: (next: string) => void;
    disabled?: boolean;
};

/** Campo de meta anual em real (pt-BR). */
export function CofrinhoBucketGoalInput({ id, value, onChange, disabled }: Props) {
    return (
        <FormInput
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="R$ 0,00"
            disabled={disabled}
            value={value}
            className="cofrinho-bucket-form__money-input"
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
                const trimmed = value.trim();
                if (!trimmed) {
                    onChange('');
                    return;
                }
                const n = parseMoneyInput(trimmed);
                if (n != null && n > 0) onChange(formatBRL(n, 'BRL'));
            }}
            onFocus={() => {
                const n = parseMoneyInput(value);
                if (n != null && n > 0) {
                    onChange(
                        n.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                    );
                }
            }}
        />
    );
}