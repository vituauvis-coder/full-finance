import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { BusyButton } from '../../../components/ui/BusyButton';

type Props = {
    label: string;
    busyLabel: string;
    submitting: boolean;
};

export function AuthSubmitButton({ label, busyLabel, submitting }: Props) {
    return (
        <BusyButton type="submit" className="auth-submit" busy={submitting} busyLabel={busyLabel}>
            <span>{label}</span>
            <MaterialIcon name="arrow_forward" />
        </BusyButton>
    );
}