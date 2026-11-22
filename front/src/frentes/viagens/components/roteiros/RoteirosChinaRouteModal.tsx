import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { RoteirosChinaRoutePanel } from './RoteirosChinaRoutePanel';
import type { TripDestination, TripPayload } from '../../types';

type Props = {
    open: boolean;
    destinations: TripDestination[];
    payload: TripPayload;
    onPatchPayload: (update: (payload: TripPayload) => TripPayload) => void;
    selectedLegId: string | null;
    onSelectLeg: (legId: string | null) => void;
    onClose: () => void;
};

export function RoteirosChinaRouteModal({
    open,
    destinations,
    payload,
    onPatchPayload,
    selectedLegId,
    onSelectLeg,
    onClose
}: Props) {
    if (!open) return null;

    return (
        <div className="rote-modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="rote-modal rote-modal--china-route"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rote-china-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="rote-modal__head">
                    <h2 id="rote-china-modal-title">Rota China</h2>
                    <button type="button" className="rote-modal__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={20} />
                    </button>
                </header>
                <div className="rote-modal__body rote-modal__body--china">
                    <RoteirosChinaRoutePanel
                        inModal
                        destinations={destinations}
                        payload={payload}
                        onPatchPayload={onPatchPayload}
                        selectedLegId={selectedLegId}
                        onSelectLeg={(id) => {
                            onSelectLeg(id);
                            if (id) onClose();
                        }}
                    />
                </div>
                <footer className="rote-modal__foot">
                    <button type="button" className="viagens-btn viagens-btn--primary" onClick={onClose}>
                        Concluir
                    </button>
                </footer>
            </div>
        </div>
    );
}