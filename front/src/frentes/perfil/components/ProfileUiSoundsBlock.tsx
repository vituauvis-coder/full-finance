type Props = {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
};

export function ProfileUiSoundsBlock({ enabled, onChange }: Props) {
    return (
        <div className="profile-modern__appearance-section">
            <h4 className="profile-modern__section-title">Sons da interface</h4>
            <label className="profile-modern__check">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span>Sons ao guardar, pagar e apagar</span>
            </label>
            <p className="profile-modern__section-hint">
                Som «save» ao confirmar alterações; «delete» ao apagar. Respeita «reduzir movimento» do sistema.
            </p>
        </div>
    );
}