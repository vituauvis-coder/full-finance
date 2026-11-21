import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import '../styles/viagens-ficha-modulos.css';

export type FichaModuloId = 'orcamento' | 'roteiros' | 'hospedagens';

export function parseFichaModulo(value: string | null): FichaModuloId | null {
    if (value === 'orcamento' || value === 'roteiros' || value === 'hospedagens') return value;
    return null;
}

export const FICHA_MODULO_TITLE: Record<FichaModuloId, string> = {
    orcamento: 'Orçamento',
    roteiros: 'Roteiros',
    hospedagens: 'Hospedagens'
};

type TileDef = {
    id: FichaModuloId | 'transporte' | 'trip-id';
    label: string;
    icon: string;
};

const TILES: TileDef[] = [
    { id: 'trip-id', label: 'ID viagem', icon: 'badge' },
    { id: 'orcamento', label: 'Orçamento', icon: 'account_balance_wallet' },
    { id: 'transporte', label: 'Transportes', icon: 'flight' },
    { id: 'hospedagens', label: 'Hospedagens', icon: 'apartment' },
    { id: 'roteiros', label: 'Roteiros', icon: 'map' }
];

type ModulosProps = {
    tripId: string;
    onOpen: (id: FichaModuloId) => void;
    onOpenTripId: () => void;
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

export function ViagemModulos({ tripId, onOpen, onOpenTripId }: ModulosProps) {
    return (
        <nav className="viagem-modulos" aria-label="Módulos da viagem">
            {TILES.map((tile) => {
                const className = 'viagem-modulo viagem-modulo--turquesa';
                if (tile.id === 'trip-id') {
                    return (
                        <button
                            key={tile.id}
                            type="button"
                            className={className}
                            onClick={onOpenTripId}
                            aria-label="Abrir ID da viagem"
                        >
                            <TileFace tile={tile} />
                        </button>
                    );
                }
                if (tile.id === 'transporte' || tile.id === 'hospedagens' || tile.id === 'roteiros') {
                    const path =
                        tile.id === 'transporte' ? 'transporte/voos' : tile.id === 'hospedagens' ? 'hospedagens' : 'roteiros';
                    return (
                        <Link
                            key={tile.id}
                            className={className}
                            to={`/viagens/${tripId}/${path}`}
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
    children: ReactNode;
};

export function ViagemModuloPanel({ modulo, children }: PanelProps) {
    const title = FICHA_MODULO_TITLE[modulo];
    return (
        <section className="viagem-modulo-panel" aria-label={title}>
            <div className="viagem-modulo-panel__body">{children}</div>
        </section>
    );
}
