import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { DatePicker, type DatePickerProps } from '../date-picker';

const controlClass = 'ui-control';

export function FormField({
    id,
    label,
    children,
    hint
}: {
    id: string;
    label: string;
    children: ReactNode;
    hint?: string;
}) {
    return (
        <div className="ui-form-field">
            <label className="ui-form-field__label" htmlFor={id}>
                {label}
            </label>
            {children}
            {hint ? <span className="ui-form-field__hint">{hint}</span> : null}
        </div>
    );
}

export function FormGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
    return <div className={`ui-form-grid ui-form-grid--${columns}`}>{children}</div>;
}

export function FormInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={[controlClass, className].filter(Boolean).join(' ')} {...props} />;
}

export function FormSelect({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select className={[controlClass, 'ui-control--select', className].filter(Boolean).join(' ')} {...props}>
            {children}
        </select>
    );
}

export function FormTextarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea className={[controlClass, 'ui-control--textarea', className].filter(Boolean).join(' ')} {...props} />;
}

export function FormDatePicker({
    id,
    value,
    onChange,
    disabled,
    required,
    min,
    max,
    placeholder
}: Pick<DatePickerProps, 'id' | 'value' | 'onChange' | 'disabled' | 'required' | 'min' | 'max' | 'placeholder'>) {
    return (
        <DatePicker
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            required={required}
            min={min}
            max={max}
            placeholder={placeholder}
        />
    );
}

export function FormCheckbox({
    id,
    label,
    checked,
    onChange,
    disabled
}: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className="ui-form-checkbox" htmlFor={id}>
            <input
                id={id}
                className="ui-form-checkbox__input"
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="ui-form-checkbox__box" aria-hidden="true" />
            <span className="ui-form-checkbox__text">{label}</span>
        </label>
    );
}

export function FormAlert({ message }: { message: string | null | undefined }) {
    if (!message) return null;
    return (
        <p role="alert" className="ui-form-alert">
            {message}
        </p>
    );
}

export function FormActions({
    onCancel,
    submitLabel = 'Salvar',
    busy = false,
    cancelLabel = 'Cancelar'
}: {
    onCancel: () => void;
    submitLabel?: string;
    busy?: boolean;
    cancelLabel?: string;
}) {
    return (
        <div className="ui-form-actions">
            <button type="button" className="ui-form-btn ui-form-btn--text" onClick={onCancel} disabled={busy}>
                {cancelLabel}
            </button>
            <button type="submit" className="ui-form-btn ui-form-btn--contained" disabled={busy}>
                {busy ? 'Salvando…' : submitLabel}
            </button>
        </div>
    );
}