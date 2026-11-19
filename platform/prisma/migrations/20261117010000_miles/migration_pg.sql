CREATE TABLE IF NOT EXISTS miles_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    brand TEXT NOT NULL
        CHECK (brand IN ('esfera', 'livelo', 'azul', 'latam', 'smiles', 'iberia', 'tap', 'outro')),
    name TEXT NOT NULL,
    issuer TEXT NOT NULL DEFAULT '',
    expires_on DATE,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS miles_programs_user_brand_uidx
    ON miles_programs (user_id, brand)
    WHERE brand <> 'outro';

CREATE INDEX IF NOT EXISTS miles_programs_user_idx ON miles_programs (user_id);

CREATE TABLE IF NOT EXISTS miles_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES miles_programs (id) ON DELETE CASCADE,
    type TEXT NOT NULL
        CHECK (type IN (
            'acumulo',
            'compra',
            'transferencia_saida',
            'transferencia_entrada',
            'bonus',
            'emissao',
            'expiracao',
            'ajuste'
        )),
    points BIGINT NOT NULL CHECK (points >= 0),
    points_sign SMALLINT NOT NULL DEFAULT 1 CHECK (points_sign IN (-1, 1)),
    amount NUMERIC(14, 4),
    currency TEXT NOT NULL DEFAULT 'BRL',
    amount_brl NUMERIC(14, 4),
    fx_to_brl NUMERIC(18, 8),
    counterpart_program_id UUID REFERENCES miles_programs (id) ON DELETE SET NULL,
    transfer_group_id UUID,
    bonus_points BIGINT NOT NULL DEFAULT 0,
    conversion_from INT,
    conversion_to INT,
    bonus_percent NUMERIC(8, 4),
    trip_id UUID REFERENCES trips (id) ON DELETE SET NULL,
    emission_sim_id UUID,
    occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS miles_movements_user_program_idx
    ON miles_movements (user_id, program_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS miles_emission_sims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    destination_program_id UUID NOT NULL REFERENCES miles_programs (id),
    origin_program_id UUID NOT NULL REFERENCES miles_programs (id),
    conversion_from INT NOT NULL DEFAULT 1,
    conversion_to INT NOT NULL DEFAULT 1,
    bonus_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    points_round TEXT NOT NULL DEFAULT 'down' CHECK (points_round IN ('down', 'up')),
    buy_milheiro NUMERIC(14, 6) NOT NULL DEFAULT 0,
    buy_discount_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    buy_extra_fee NUMERIC(14, 4) NOT NULL DEFAULT 0,
    buy_extra_fee_currency TEXT NOT NULL DEFAULT 'BRL',
    fx_rate NUMERIC(18, 8) NOT NULL DEFAULT 1,
    iof_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    spread_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    club_fee_brl NUMERIC(14, 4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho', 'reservada', 'emitida')),
    chosen_option_id UUID,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS miles_emission_sims_trip_idx
    ON miles_emission_sims (user_id, trip_id);

CREATE TABLE IF NOT EXISTS miles_emission_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sim_id UUID NOT NULL REFERENCES miles_emission_sims (id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    destination_points BIGINT NOT NULL CHECK (destination_points >= 0),
    taxes_amount NUMERIC(14, 4) NOT NULL DEFAULT 0,
    taxes_currency TEXT NOT NULL DEFAULT 'EUR',
    sort_index INT NOT NULL DEFAULT 0
);
