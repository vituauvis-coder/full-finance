import { FormField } from '../../../../components/ui/form';
import type { DebtColorKey } from '../../domain/debtColors';
import { DebtColorSwatches } from './DebtColorSwatches';

type Props = {
    debtName: string;
    selectedKey?: string;
    onSelect: (key: DebtColorKey) => void;
    disabled?: boolean;
};

export function DebtFormColorField({ debtName, selectedKey, onSelect, disabled }: Props) {
    return (
        <FormField id="debt-form-color" label="Cor do card">
            <DebtColorSwatches
                layout="form"
                selectedKey={selectedKey || 'wine'}
                onSelect={(k) => onSelect(k as DebtColorKey)}
                ariaLabel={`Cor do card — ${debtName}`}
                disabled={disabled}
            />
        </FormField>
    );
}