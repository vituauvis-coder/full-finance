/** Estado de rota para abrir o formulário «Nova» ao entrar em Entradas/Saídas. */
export type MovementCreateLocationState = {
    openCreate?: boolean;
};

export const MOVEMENT_CREATE_NAV_STATE: MovementCreateLocationState = { openCreate: true };