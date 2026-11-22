import { tripFlightSegments } from '@motor/viagens/flight-simulation.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripPayload } from '../../types';

type Props = {
    payload: TripPayload;
    onAddTrecho: () => void;
    onPrimeiroVoo: () => void;
    /** Ações compactas ao lado das abas no header da página. */
    placement?: 'header' | 'hero';
};

export function VoosListaHeroBar({
    payload,
    onAddTrecho,
    onPrimeiroVoo,
    placement = 'header'
}: Props) {
    const segments = tripFlightSegments(payload);
    const empty = segments.length === 0;

    const actions = (
        <div className="transporte-header__lista-actions">
            <button
                type="button"
                className="page-toolbar__cta btn-primary header-action-btn transporte-header__add-trecho"
                onClick={empty ? onPrimeiroVoo : onAddTrecho}
            >
                <MaterialIcon name="add" variant="app" />
                {empty ? 'Novo voo' : 'Novo trecho'}
            </button>
        </div>
    );

    if (placement === 'header') {
        return actions;
    }

    return <div className="transporte-hero__lista">{actions}</div>;
}