import { useEffect, useId, useRef, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    BUCKET_FORM_KINDS,
    COFRINHO_KIND_META,
    type BucketFormKind
} from '../../domain/cofrinhoBucketTypes';

type Props = {
    value: BucketFormKind;
    onChange: (kind: BucketFormKind) => void;
    disabled?: boolean;
};

export function CofrinhoBucketTypePicker({ value, onChange, disabled }: Props) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const listId = useId();
    const selected = COFRINHO_KIND_META[value];

    useEffect(() => {
        if (!open) return;
        function onDocPointer(e: MouseEvent) {
            const el = rootRef.current;
            if (!el?.contains(e.target as Node)) setOpen(false);
        }
        function onEsc(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onDocPointer);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocPointer);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    return (
        <div
            ref={rootRef}
            className={`cofrinho-kind-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
        >
            <button
                type="button"
                id="cofrinho-bucket-kind"
                className="cofrinho-kind-select__trigger ui-control"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => {
                    if (disabled) return;
                    setOpen((v) => !v);
                }}
            >
                <span className="cofrinho-kind-select__trigger-icon" aria-hidden>
                    <MaterialIcon name={selected.icon} variant="app" opticalSize={18} />
                </span>
                <span className="cofrinho-kind-select__trigger-text">
                    <span className="cofrinho-kind-select__trigger-label">{selected.label}</span>
                    <span className="cofrinho-kind-select__trigger-hint">{selected.hint}</span>
                </span>
                <MaterialIcon
                    name="expand_more"
                    variant="app"
                    opticalSize={20}
                    className="cofrinho-kind-select__chevron"
                    aria-hidden
                />
            </button>
            {open ? (
                <ul
                    id={listId}
                    className="cofrinho-kind-select__menu"
                    role="listbox"
                    aria-label="Tipo da caixinha"
                >
                    {BUCKET_FORM_KINDS.map((kind) => {
                        const meta = COFRINHO_KIND_META[kind];
                        const active = value === kind;
                        return (
                            <li key={kind} role="presentation">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    className={`cofrinho-kind-select__option${active ? ' is-active' : ''}`}
                                    onClick={() => {
                                        onChange(kind);
                                        setOpen(false);
                                    }}
                                >
                                    <span className="cofrinho-kind-select__option-icon" aria-hidden>
                                        <MaterialIcon name={meta.icon} variant="app" opticalSize={18} />
                                    </span>
                                    <span className="cofrinho-kind-select__option-body">
                                        <span className="cofrinho-kind-select__option-label">{meta.label}</span>
                                        <span className="cofrinho-kind-select__option-hint">{meta.hint}</span>
                                    </span>
                                    {active ? (
                                        <MaterialIcon
                                            name="check"
                                            variant="app"
                                            opticalSize={18}
                                            className="cofrinho-kind-select__check"
                                            aria-hidden
                                        />
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}