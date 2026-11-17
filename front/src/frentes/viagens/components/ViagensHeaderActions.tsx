import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { useViagensHeaderSlot } from '../context/ViagensHeaderSlotContext';

type Props = {
    hidden: boolean;
};

export function ViagensHeaderActions({ hidden }: Props) {
    const slot = useViagensHeaderSlot();
    if (hidden || !slot) return null;

    return (
        <div
            id="viagens-header-actions"
            className="page-toolbar header-page-actions viagens-header-actions"
            data-toolbar-accent="viagens"
            aria-label="Ações do atlas"
        >
            <div className="page-toolbar__tools">
                <button
                    type="button"
                    id="add-trip-btn"
                    className="page-toolbar__cta btn-primary header-action-btn"
                    disabled={slot.busy}
                    onClick={slot.onNew}
                >
                    <MaterialIcon name="add" variant="app" />
                    Nova viagem
                </button>
            </div>
        </div>
    );
}