import { useId, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    id?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    autoComplete?: string;
    minLength?: number;
};

export function AuthPasswordField({
    id: idProp,
    label,
    value,
    onChange,
    placeholder = '••••••••',
    autoComplete = 'current-password',
    minLength
}: Props) {
    const fallbackId = useId();
    const id = idProp ?? fallbackId;
    const [visible, setVisible] = useState(false);

    return (
        <div className="auth-field">
            <label className="auth-label" htmlFor={id}>
                {label}
            </label>
            <div className="password-wrapper">
                <div className="auth-input-wrap auth-input-wrap--password">
                    <MaterialIcon name="lock" className="auth-input-icon" />
                    <input
                        id={id}
                        name={id}
                        type={visible ? 'text' : 'password'}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        autoComplete={autoComplete}
                        required
                        minLength={minLength}
                    />
                </div>
                <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setVisible((v) => !v)}
                    aria-pressed={visible}
                    title={visible ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    <MaterialIcon name={visible ? 'visibility_off' : 'visibility'} />
                </button>
            </div>
        </div>
    );
}