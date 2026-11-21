import { DatePicker } from '../../../../components/ui/date-picker';

type Props = {
    value?: string;
    onChange: (isoDate: string) => void;
};

/** Campo de data do orçamento — usa o DatePicker compartilhado. */
export function ExpenseDateField({ value, onChange }: Props) {
    return (
        <DatePicker
            className="orc-exp-date"
            value={value ?? ''}
            onChange={onChange}
            placeholder="Escolher data"
        />
    );
}