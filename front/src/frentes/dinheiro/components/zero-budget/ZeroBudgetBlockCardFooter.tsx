import type { MouseEvent } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { ZeroBudgetColorPicker } from './ZeroBudgetColorPicker';

type Props = {
    categoryName: string;
    selectedColor?: string;
    onColorSelect: (colorClass: string) => void | Promise<void>;
    onOpenList: (e: MouseEvent<HTMLButtonElement>) => void;
};

export function ZeroBudgetBlockCardFooter({ categoryName, selectedColor, onColorSelect, onOpenList }: Props) {
    return (
        <footer className="zero-budget__block-foot">
            <ZeroBudgetColorPicker categoryName={categoryName} selectedColor={selectedColor} onSelect={onColorSelect} />
            <button type="button" className="zero-budget__block-list-btn" onClick={onOpenList}>
                <MaterialIcon name="checklist" variant="app" filled={false} weight={500} opticalSize={20} />
                Lista
            </button>
        </footer>
    );
}