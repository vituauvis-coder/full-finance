import { useId, useRef } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    BUCKET_COLOR_KEYS,
    BUCKET_COLOR_LABELS,
    bucketColorHex,
    encodeCustomBucketColor,
    isPresetBucketColorKey,
    parseCustomBucketHex,
    type BucketColorKey
} from '../../domain/cofrinhoConstants';

type Props = {
    value: string;
    onChange: (colorKey: string) => void;
    ariaLabel?: string;
    disabled?: boolean;
    layout?: 'form' | 'popover';
};

export function CofrinhoBucketColorSwatches({
    value,
    onChange,
    ariaLabel = 'Cor da caixinha',
    disabled,
    layout = 'form'
}: Props) {
    const customInputRef = useRef<HTMLInputElement>(null);
    const customInputId = useId();
    const customHex = parseCustomBucketHex(value) ?? bucketColorHex('violet');
    const customActive = parseCustomBucketHex(value) !== null;

    const listClass =
        layout === 'form' ? 'cofrinho-bucket-form__colors' : 'zero-budget__colors-list';

    return (
        <div className={listClass} role="radiogroup" aria-label={ariaLabel}>
            {BUCKET_COLOR_KEYS.map((key) => {
                const selected = !customActive && value === key;
                return (
                    <button
                        key={key}
                        type="button"
                        className={`cofrinho-bucket-form__color-swatch${selected ? ' is-selected' : ''}`}
                        style={{ backgroundColor: bucketColorHex(key) }}
                        title={BUCKET_COLOR_LABELS[key]}
                        aria-label={BUCKET_COLOR_LABELS[key]}
                        aria-pressed={selected}
                        disabled={disabled}
                        onClick={() => onChange(key)}
                    />
                );
            })}
            <div
                className={`cofrinho-bucket-color-custom${customActive ? ' is-selected' : ''}`}
                title="Cor personalizada"
            >
                <input
                    ref={customInputRef}
                    id={customInputId}
                    type="color"
                    className="cofrinho-bucket-color-custom__input"
                    value={customHex}
                    disabled={disabled}
                    aria-label="Escolher cor personalizada"
                    onChange={(e) => onChange(encodeCustomBucketColor(e.target.value))}
                />
                <button
                    type="button"
                    className="cofrinho-bucket-color-custom__trigger"
                    disabled={disabled}
                    aria-pressed={customActive}
                    style={
                        customActive
                            ? {
                                  background: `linear-gradient(135deg, ${customHex}, color-mix(in srgb, ${customHex} 55%, white))`
                              }
                            : undefined
                    }
                    onClick={() => customInputRef.current?.click()}
                >
                    <MaterialIcon name="palette" variant="app" opticalSize={16} aria-hidden />
                    <span className="cofrinho-bucket-color-custom__label">Personalizar</span>
                </button>
            </div>
        </div>
    );
}

/** Valor inicial seguro ao criar caixinha. */
export function defaultBucketColorKey(): BucketColorKey {
    return 'violet';
}