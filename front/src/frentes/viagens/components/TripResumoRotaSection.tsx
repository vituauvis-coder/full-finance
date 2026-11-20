import { useMemo, useState } from 'react';
import { chosenScenarioRota } from '../domain/chosenScenarioResumo';
import type { TripDestination } from '../types';
import type { TripDraft } from './ViagemFicha';
import { TripSimuladorDestinosPanel } from './simulador/TripSimuladorDestinosPanel';
import '../styles/viagens-simulador.css';

type Props = {
    draft: TripDraft;
    destinations: TripDestination[];
};

export function TripResumoRotaSection({ draft, destinations }: Props) {
    const [focusedCountry, setFocusedCountry] = useState<string | null>(null);

    const rota = useMemo(
        () => chosenScenarioRota(draft.payload, destinations, draft.startsOn),
        [draft.payload, destinations, draft.startsOn]
    );

    if (!rota?.countries.length) return null;

    return (
        <section className="viagens-resumo__rota" aria-label="Rota e destinos">
            <TripSimuladorDestinosPanel
                rows={rota.countries}
                snapshot={rota.snapshot}
                hops={rota.hops}
                focusedCountry={focusedCountry}
                onCountry={setFocusedCountry}
            />
        </section>
    );
}