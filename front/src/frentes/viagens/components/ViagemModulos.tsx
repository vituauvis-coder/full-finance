import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { ViagensBackControl } from './ViagensBackControl';
import '../styles/viagens-ficha-modulos.css';

export type FichaModuloId = 'orcamento' | 'roteiros' | 'hospedagens';

export const FICHA_MODULO_TITLE: Record<FichaModuloId, string> = {
    orcamento: 'Orçamento',
    roteiros: 'Roteiros',
    hospedagens: 'Hospedagens & Transportes'
};

type TileTone = 'ouro' | 'turquesa' | 'coral' | 'oceano';

type TileDef = {
    id: FichaModuloId | 'voos';
    label: string;
    icon: string;
    tone: TileTone;
};

const TILES: TileDef[] = [
    { id: 'orcamento', label: 'Orçamento', icon: 'account_balance_wallet', tone: 'ouro' },
    { id: 'voos', label: 'Voos', icon: 'flight', tone: 'turquesa' },
    { id: 'roteiros', label: 'Roteiros', icon: 'map', tone: 'coral' },
    { id: 'hospedagens', label: 'Hospedagens', icon: 'apartment', tone: 'oceano' }
];

type ModulosProps = {
    tripId: string;
    onOpen: (id: FichaModuloId) => void;
};

function TileFace({ tile }: { tile: TileDef }) {
    return (
        <>
            <span className="viagem-modulo__icon-well" aria-hidden="true">
                <MaterialIcon
                    name={tile.icon}
                    className="viagem-modulo__icon"
                    variant="app"
                    filled
                    opticalSize={24}
                />
            </span>
            <span className="viagem-modulo__label">{tile.label}</span>
            <span className="viagem-modulo__chev" aria-hidden="true">
                <MaterialIcon name="chevron_right" variant="app" opticalSize={20} />
            </span>
        </>
    );
}

export function ViagemModulos({ tripId, onOpen }: ModulosProps) {
    return (
        <nav className="viagem-modulos" aria-label="Módulos da viagem">
            {TILES.map((tile) => {
                const className = `viagem-modulo viagem-modulo--${tile.tone}`;
                if (tile.id === 'voos') {
                    return (
                        <Link
                            key={tile.id}
                            className={className}
                            to={`/viagens/${tripId}/voos`}
                            aria-label={`Abrir ${tile.label}`}
                        >
                            <TileFace tile={tile} />
                        </Link>
                    );
                }
                return (
                    <button
                        key={tile.id}
                        type="button"
                        className={className}
                        onClick={() => onOpen(tile.id)}
                        aria-label={`Abrir ${tile.label}`}
                    >
                        <TileFace tile={tile} />
                    </button>
                );
            })}
        </nav>
    );
}

type PanelProps = {
    modulo: FichaModuloId;
    onBack: () => void;
    children: ReactNode;
};

export function ViagemModuloPanel({ modulo, onBack, children }: PanelProps) {
    const title = FICHA_MODULO_TITLE[modulo];
    return (
        <section className="viagem-modulo-panel" aria-label={title}>
            <header className="viagem-modulo-panel__head">
                <ViagensBackControl label="Voltar" onClick={onBack} />
                <h2 className="viagem-modulo-panel__title">{title}</h2>
            </header>
            <div className="viagem-modulo-panel__body">{children}</div>
        </section>
    );
}
