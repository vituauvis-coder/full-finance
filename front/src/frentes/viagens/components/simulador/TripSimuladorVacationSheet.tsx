import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripTimeScenario } from '../../types';
import { TripSimuladorVacationForm } from './TripSimuladorVacationForm';

type Props = {
    open: boolean;
    scenario: TripTimeScenario;
    onChange: (next: TripTimeScenario) => void;
    onVacationStart?: (startKey: string, periodIndex: number) => void;
    onClose: () => void;
};

export function TripSimuladorVacationSheet({ open, scenario, onChange, onVacationStart, onClose }: Props) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    const sheet = (
        <div className="viagens-sim-sheet viagens-sim-sheet--portal" role="presentation">
            <button type="button" className="viagens-sim-sheet__backdrop" aria-label="Fechar" onClick={onClose} />
            <div
                ref={panelRef}
                className="viagens-sim-sheet__panel viagens-sim-sheet__panel--wide viagens-sim-ferias-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="viagens-sim-ferias-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="viagens-sim-sheet__head">
                    <div>
                        <h3 id="viagens-sim-ferias-title">
                            <MaterialIcon name="eco" variant="app" opticalSize={18} />
                            Férias e remoto
                        </h3>
                        <p className="viagens-sim-ferias-sheet__lede viagens-muted">
                            Período em coral no calendário e nos KPIs do cenário.
                        </p>
                    </div>
                    <button type="button" className="viagens-sim-sheet__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={20} />
                    </button>
                </header>
                <TripSimuladorVacationForm
                    scenario={scenario}
                    onChange={onChange}
                    onVacationStart={onVacationStart}
                    onDone={onClose}
                />
            </div>
        </div>
    );

    if (typeof document === 'undefined') return sheet;
    return createPortal(sheet, document.body);
}