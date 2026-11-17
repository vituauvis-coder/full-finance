import { useId } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    id?: string;
    label: string;
    icon: string;
    type?: 'text' | 'email';
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    autoComplete?: string;
    minLength?: number;
};

export function AuthTextField({
    id: idProp,
    label,
    icon,
    type = 'text',
    value,
    onChange,
    placeholder,
    autoComplete,
    minLength
}: Props) {
    const fallbackId = useId();
    const id = idProp ?? fallbackId;

    return (
        <div className="auth-field">
            <label className="auth-label" htmlFor={id}>
                {label}
            </label>
            <div className="auth-input-wrap">
                <MaterialIcon name={icon} className="auth-input-icon" />
                <input
                    id={id}
                    name={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    required
                    minLength={minLength}
                />
            </div>
        </div>
    );
}