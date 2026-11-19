import { useState } from 'react';
import { rateForPair } from '@motor/milhas/catalog.js';
import { emptyFlightSimulation } from '@motor/viagens/flight-simulation.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { type ConversionRate, type MilesProgram } from '../../pages/pontos/pontos-format';
import type { TripFlightSimulation } from '../../types';
import { FlightMilesBlock } from './FlightMilesBlock';

type Props = {
    programs: MilesProgram[];
    rates: ConversionRate[];
    originProgramId?: string;
    initial?: TripFlightSimulation | null;
    saveId?: string | null;
    view?: boolean;
    fixed?: boolean;
    onSave?: (sim: TripFlightSimulation, saveId: string | null) => string | void;
    onClose: () => void;
};

function unitOf(program?: MilesProgram | null) {
    return program?.unit || 'pontos';
}

function seedSim(originProgramId: string | undefined, programs: MilesProgram[], rates: ConversionRate[]): TripFlightSimulation {
    const origin = programs.find((p) => p.id === originProgramId) ?? programs[0];
    const dest =
        programs.find((p) => p.id !== origin?.id && (unitOf(p) === 'avios' || unitOf(p) === 'milhas')) ??
        programs.find((p) => unitOf(p) === 'avios' || unitOf(p) === 'milhas') ??
        origin;
    const saved =
        origin && dest
            ? rates.find((r) => r.fromProgramId === origin.id && r.toProgramId === dest.id)
            : undefined;
    const next =
        origin && dest && origin.id !== dest.id
            ? rateForPair(saved, origin.unit, dest.unit, origin.transferBonusPercent)
            : { from: 1, to: 1, bonusPercent: 0 };
    return {
        ...(emptyFlightSimulation() as TripFlightSimulation),
        miles: {
            payWith: 'points',
            originProgramId: origin?.id ?? null,
            destinationProgramId: dest?.id ?? null,
            destinationPoints: null,
            taxesAmount: null,
            taxesCurrency: 'EUR',
            conversionFrom: next.from,
            conversionTo: next.to,
            bonusPercent: next.bonusPercent,
            bonusActive: true,
            emissionId: null
        }
    };
}

export function MilesCalculatorPop({
    programs,
    rates,
    originProgramId,
    initial,
    saveId = null,
    view = false,
    fixed = false,
    onSave,
    onClose
}: Props) {
    const [sim, setSim] = useState(() => initial ?? seedSim(originProgramId, programs, rates));
    const [mode, setMode] = useState<'view' | 'edit'>(view ? 'view' : 'edit');
    const viewing = mode === 'view';

    return (
        <div className={`carteira-pop-scrim${fixed ? ' is-fixed' : ''}`} onClick={onClose}>
            <div
                className={`carteira-pop carteira-pop--calc${viewing ? ' is-view' : ''}`}
                role="dialog"
                aria-labelledby="miles-calc-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header>
                    <div>
                        <p className="pontos-kicker">{viewing ? 'Simulação' : 'Simular'}</p>
                        <h3 id="miles-calc-title">Calculadora de milhas</h3>
                    </div>
                    {viewing ? (
                        <button
                            type="button"
                            className="voos-icon-btn voos-icon-btn--oceano"
                            onClick={() => setMode('edit')}
                            title="Editar"
                            aria-label="Editar simulação"
                        >
                            <MaterialIcon name="edit" variant="app" opticalSize={18} />
                        </button>
                    ) : onSave ? (
                        <button
                            type="button"
                            className="carteira-pop__save"
                            onClick={() => {
                                onSave(sim, saveId ?? null);
                                onClose();
                            }}
                        >
                            Salvar
                        </button>
                    ) : null}
                    <button type="button" className="voos-icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={18} />
                    </button>
                </header>
                <FlightMilesBlock
                    simulation={sim}
                    programs={programs}
                    rates={rates}
                    onChange={(miles) => setSim((current) => ({ ...current, miles }))}
                    pointsOnly
                    walletsReady
                    readOnly={viewing}
                />
            </div>
        </div>
    );
}
