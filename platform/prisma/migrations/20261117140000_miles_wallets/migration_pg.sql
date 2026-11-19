ALTER TABLE miles_programs
    ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pontos';

UPDATE miles_programs SET unit = 'avios' WHERE brand IN ('iberia', 'tap') AND unit = 'pontos';
UPDATE miles_programs SET unit = 'milhas' WHERE brand IN ('azul', 'latam', 'smiles') AND unit = 'pontos';

CREATE TABLE IF NOT EXISTS miles_conversion_rates (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    from_program_id UUID NOT NULL REFERENCES miles_programs (id) ON DELETE CASCADE,
    to_program_id UUID NOT NULL REFERENCES miles_programs (id) ON DELETE CASCADE,
    conversion_from INT NOT NULL DEFAULT 1,
    conversion_to INT NOT NULL DEFAULT 1,
    bonus_percent NUMERIC(8, 4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, from_program_id, to_program_id)
);

INSERT INTO miles_conversion_rates (
    user_id, from_program_id, to_program_id, conversion_from, conversion_to, bonus_percent, updated_at
)
SELECT DISTINCT ON (m.user_id, m.program_id, m.counterpart_program_id)
    m.user_id,
    m.program_id,
    m.counterpart_program_id,
    COALESCE(m.conversion_from, 1),
    COALESCE(m.conversion_to, 1),
    COALESCE(m.bonus_percent, 0),
    m.created_at
FROM miles_movements m
JOIN miles_programs origin ON origin.id = m.program_id
JOIN miles_programs dest ON dest.id = m.counterpart_program_id
WHERE m.type = 'transferencia_saida'
  AND m.counterpart_program_id IS NOT NULL
ORDER BY m.user_id, m.program_id, m.counterpart_program_id, m.created_at DESC
ON CONFLICT (user_id, from_program_id, to_program_id) DO NOTHING;
