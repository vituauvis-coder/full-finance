import { FormCheckbox } from '../../../components/ui/form';

type Props = {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
};

export function ProfileUiSoundsBlock({ enabled, onChange }: Props) {
    return (
        <div className="profile-modern__appearance-section">
            <div className="profile-modern__field profile-modern__field--grow">
                <span className="profile-modern__section-title">Sons da interface</span>
                <FormCheckbox
                    id="profile-ui-sounds"
                    label="Sons ao guardar, pagar e apagar"
                    hint="Som «save» ao confirmar alterações; «delete» ao apagar. Respeita «reduzir movimento» do sistema."
                    checked={enabled}
                    onChange={onChange}
                />
            </div>
        </div>
    );
}