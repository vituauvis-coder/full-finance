import { useId, useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { bucketColorHex } from '../../domain/cofrinhoConstants';
import { CofrinhoBucketColorSwatches } from './CofrinhoBucketColorSwatches';

type Props = {
    bucketName: string;
    selectedKey?: string;
    onSelect: (colorKey: string) => void | Promise<void>;
};

export function CofrinhoBucketColorPicker({ bucketName, selectedKey, onSelect }: Props) {
    const [expanded, setExpanded] = useState(false);
    const listId = useId();
    const currentHex = bucketColorHex(selectedKey);

    return (
        <div
            className={`zero-budget__block-colors${expanded ? ' zero-budget__block-colors--expanded' : ''}`}
            data-zb-block-colors=""
        >
            <button
                type="button"
                className="zero-budget__color-toggle"
                aria-expanded={expanded}
                aria-controls={listId}
                title="Cor da caixinha"
                onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((v) => !v);
                }}
            >
                <span
                    className="zero-budget__color-toggle-preview"
                    style={{ backgroundColor: currentHex }}
                    aria-hidden="true"
                />
                <span className="zero-budget__color-toggle-label">Cor</span>
                <MaterialIcon
                    name={expanded ? 'expand_less' : 'expand_more'}
                    variant="app"
                    filled={false}
                    weight={500}
                    opticalSize={18}
                    className="zero-budget__color-toggle-chevron"
                />
            </button>
            {expanded ? (
                <div
                    id={listId}
                    className="zero-budget__colors-popover cofrinho-bucket-color-popover"
                    role="group"
                    aria-label={`Cor da caixinha ${bucketName}`}
                >
                    <CofrinhoBucketColorSwatches
                        layout="popover"
                        value={selectedKey ?? 'violet'}
                        onChange={(key) => void onSelect(key)}
                    />
                </div>
            ) : null}
        </div>
    );
}