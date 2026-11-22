import type { Trip } from '../types';
import type { TripDraft } from './ViagemFicha';
import { ViagensBackControl } from './ViagensBackControl';
import { TripCountriesSelector } from './TripCountriesSelector';
import { TripStatusControl } from './TripStatusControl';
import { DeleteIcon } from '../../../components/icons/DeleteIcon';
import type { FichaModuloId } from './ViagemModulos';
import { FICHA_MODULO_TITLE } from './ViagemModulos';
import '../styles/viagens-dash-hero.css';

type HomeProps = {
    mode: 'home';
    draft: TripDraft;
    trip: Trip;
    statusOverride: string;
    saving: boolean;
    onTitleChange: (title: string) => void;
    onCountriesChange: (countries: string[]) => void;
    onStatusChange: (value: string) => void;
    onBack: () => void;
    onDelete: () => void;
};

type ModuloProps = {
    mode: 'modulo';
    modulo: FichaModuloId;
    saving: boolean;
    onBack: () => void;
};

type Props = HomeProps | ModuloProps;

export function ViagemFichaHero(props: Props) {
    if (props.mode === 'modulo') {
        return (
            <header className="viagens-hero viagens-ficha-hero" aria-label="Módulo da viagem">
                <div className="viagens-hero__row viagens-hero__row--head">
                    <ViagensBackControl label="Voltar à ficha" iconOnly onClick={props.onBack} />
                    <h1 className="viagens-hero__module-title">{FICHA_MODULO_TITLE[props.modulo]}</h1>
                    {props.saving ? (
                        <span className="viagens-hero__save-hint" aria-live="polite">
                            Salvando…
                        </span>
                    ) : null}
                </div>
            </header>
        );
    }

    const { draft, trip, statusOverride, saving, onTitleChange, onCountriesChange, onStatusChange, onBack, onDelete } =
        props;

    return (
        <header className="viagens-hero viagens-ficha-hero" aria-label="Cabeçalho da viagem">
            <div className="viagens-hero__row viagens-hero__row--head">
                <ViagensBackControl label="Voltar às viagens" iconOnly onClick={onBack} />
                <input
                    className="viagens-hero__title"
                    value={draft.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    aria-label="Título da viagem"
                />
                <div className="viagens-hero__actions" aria-label="Ações da viagem">
                    {saving ? (
                        <span className="viagens-hero__save-hint" aria-live="polite">
                            Salvando…
                        </span>
                    ) : null}
                    <TripStatusControl
                        trip={trip}
                        statusOverride={statusOverride}
                        compact
                        onChange={onStatusChange}
                    />
                    <button
                        type="button"
                        className="viagens-btn viagens-btn--ghost viagens-btn--icon viagens-ficha__delete"
                        title="Apagar viagem"
                        aria-label="Apagar viagem"
                        onClick={onDelete}
                    >
                        <DeleteIcon size="md" />
                    </button>
                </div>
            </div>
            <div className="viagens-hero__row viagens-hero__row--meta">
                <TripCountriesSelector
                    payload={draft.payload}
                    destinations={draft.payload.destinations ?? []}
                    onChange={(tripCountries) =>
                        onCountriesChange(tripCountries)
                    }
                />
            </div>
        </header>
    );
}