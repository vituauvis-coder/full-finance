import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withTransaction } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = fs.readFileSync(
    path.join(__dirname, '../platform/prisma/migrations/20261117010000_miles/migration_pg.sql'),
    'utf8'
);
const WALLET_SQL = fs.readFileSync(
    path.join(__dirname, '../platform/prisma/migrations/20261117140000_miles_wallets/migration_pg.sql'),
    'utf8'
);
const BENEFITS_SQL = fs.readFileSync(
    path.join(__dirname, '../platform/prisma/migrations/20261117180000_wallet_benefits/migration_pg.sql'),
    'utf8'
);
const CLUB_SQL = fs.readFileSync(
    path.join(__dirname, '../platform/prisma/migrations/20261117193000_wallet_club_subscription/migration_pg.sql'),
    'utf8'
);
const HOUSEHOLD_SQL = fs.readFileSync(
    path.join(__dirname, '../platform/prisma/migrations/20261119180000_miles_household/migration_pg.sql'),
    'utf8'
);

let schemaReady = false;

function dateKey(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    const s = String(value).trim();
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

export async function ensureMilesSchema() {
    if (!schemaReady) {
        await query(SCHEMA_SQL);
        schemaReady = true;
    }
    await query(WALLET_SQL);
    await query(BENEFITS_SQL);
    await query(CLUB_SQL);
    await query(`ALTER TABLE miles_emission_sims ADD COLUMN IF NOT EXISTS flight_simulation_id TEXT`);
    await query(`ALTER TABLE miles_programs ADD COLUMN IF NOT EXISTS club_bonus_per_month BIGINT NOT NULL DEFAULT 0`);
    await query(HOUSEHOLD_SQL);
}

function visibleProgramsSql(uidParam = '$1', tableAlias = 'p') {
    const col = (name) => (tableAlias ? `${tableAlias}.${name}` : name);
    return `(${col('user_id')} = ${uidParam} OR ${col('household_id')} IN (
        SELECT household_id FROM household_members WHERE user_id = ${uidParam}
    ))`;
}

function mapProgram(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        brand: row.brand,
        name: row.name,
        issuer: row.issuer,
        unit: row.unit || 'pontos',
        expiresOn: dateKey(row.expires_on),
        notes: row.notes,
        transferBonusPercent: Number(row.transfer_bonus_percent) || 0,
        clubActive: Boolean(row.club_active),
        clubFeeBrl: String(row.club_fee_brl ?? '0'),
        clubStartedOn: dateKey(row.club_started_on),
        clubPointsPerMonth: Number(row.club_points_per_month) || 0,
        clubBonusPerMonth: Number(row.club_bonus_per_month) || 0,
        buyMilheiro: String(row.buy_milheiro ?? '0'),
        householdId: row.household_id ?? null,
        holderUserId: row.holder_user_id ?? null,
        holderUserName: row.holder_user_name ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapRate(row) {
    if (!row) return null;
    return {
        fromProgramId: row.from_program_id,
        toProgramId: row.to_program_id,
        conversionFrom: Number(row.conversion_from) || 1,
        conversionTo: Number(row.conversion_to) || 1,
        bonusPercent: Number(row.bonus_percent) || 0,
        updatedAt: row.updated_at
    };
}

function mapMovement(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        programId: row.program_id,
        type: row.type,
        points: Number(row.points),
        pointsSign: Number(row.points_sign),
        amount: row.amount == null ? null : String(row.amount),
        currency: row.currency,
        amountBrl: row.amount_brl == null ? null : String(row.amount_brl),
        fxToBrl: row.fx_to_brl == null ? null : String(row.fx_to_brl),
        counterpartProgramId: row.counterpart_program_id,
        transferGroupId: row.transfer_group_id,
        bonusPoints: Number(row.bonus_points),
        conversionFrom: row.conversion_from,
        conversionTo: row.conversion_to,
        bonusPercent: row.bonus_percent == null ? null : String(row.bonus_percent),
        tripId: row.trip_id,
        emissionSimId: row.emission_sim_id,
        occurredOn: row.occurred_on,
        source: row.source,
        notes: row.notes,
        recordedByName: row.recorded_by_name ?? null,
        createdAt: row.created_at
    };
}

function mapOption(row) {
    return {
        id: row.id,
        simId: row.sim_id,
        label: row.label,
        destinationPoints: Number(row.destination_points),
        taxesAmount: String(row.taxes_amount ?? '0'),
        taxesCurrency: row.taxes_currency,
        sortIndex: row.sort_index
    };
}

function mapSim(row, options = []) {
    return {
        id: row.id,
        userId: row.user_id,
        tripId: row.trip_id,
        title: row.title,
        destinationProgramId: row.destination_program_id,
        originProgramId: row.origin_program_id,
        conversionFrom: row.conversion_from,
        conversionTo: row.conversion_to,
        bonusPercent: String(row.bonus_percent ?? '0'),
        pointsRound: row.points_round,
        buyMilheiro: String(row.buy_milheiro ?? '0'),
        buyDiscountPercent: String(row.buy_discount_percent ?? '0'),
        buyExtraFee: String(row.buy_extra_fee ?? '0'),
        buyExtraFeeCurrency: row.buy_extra_fee_currency,
        fxRate: String(row.fx_rate ?? '1'),
        iofPercent: String(row.iof_percent ?? '0'),
        spreadPercent: String(row.spread_percent ?? '0'),
        clubFeeBrl: String(row.club_fee_brl ?? '0'),
        status: row.status,
        chosenOptionId: row.chosen_option_id,
        flightSimulationId: row.flight_simulation_id || null,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        options
    };
}

export async function listPrograms(userId) {
    const { rows } = await query(
        `SELECT p.*, hu.name AS holder_user_name
         FROM miles_programs p
         LEFT JOIN users hu ON hu.id = p.holder_user_id
         WHERE ${visibleProgramsSql('$1')}
         ORDER BY p.household_id NULLS LAST, p.created_at ASC`,
        [userId]
    );
    return rows.map(mapProgram);
}

export async function getProgram(userId, id) {
    const { rows } = await query(
        `SELECT p.*, hu.name AS holder_user_name
         FROM miles_programs p
         LEFT JOIN users hu ON hu.id = p.holder_user_id
         WHERE p.id = $2 AND ${visibleProgramsSql('$1')}`,
        [userId, id]
    );
    return mapProgram(rows[0]);
}

export async function insertProgram(userId, { brand, name, issuer, unit, expiresOn, notes, transferBonusPercent, clubActive, clubFeeBrl, buyMilheiro }) {
    const { rows } = await query(
        `INSERT INTO miles_programs (
            user_id, brand, name, issuer, unit, expires_on, notes,
            transfer_bonus_percent, club_active, club_fee_brl, buy_milheiro
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
            userId,
            brand,
            name,
            issuer ?? '',
            unit || 'pontos',
            expiresOn || null,
            notes ?? '',
            Number(transferBonusPercent) || 0,
            Boolean(clubActive),
            Number(clubFeeBrl) || 0,
            Number(buyMilheiro) || 0
        ]
    );
    return mapProgram(rows[0]);
}

export async function updateProgram(userId, id, patch) {
    const current = await getProgram(userId, id);
    if (!current) return null;
    const householdId = patch.householdId;
    const holderUserId = patch.holderUserId;
    const expires =
        patch.expiresOn === undefined ? current.expiresOn : patch.expiresOn === '' ? null : patch.expiresOn;
    const clubActive = patch.clubActive === undefined ? current.clubActive : Boolean(patch.clubActive);
    const clubStartedOn =
        patch.clubStartedOn === undefined
            ? current.clubStartedOn
            : dateKey(patch.clubStartedOn);
    const { rows } = await query(
        `UPDATE miles_programs
         SET name = COALESCE($3, name),
             issuer = COALESCE($4, issuer),
             unit = COALESCE($5, unit),
             expires_on = $6,
             notes = COALESCE($7, notes),
             transfer_bonus_percent = COALESCE($8, transfer_bonus_percent),
             club_active = $9,
             club_fee_brl = COALESCE($10, club_fee_brl),
             buy_milheiro = COALESCE($11, buy_milheiro),
             club_started_on = $12,
             club_points_per_month = COALESCE($13, club_points_per_month),
             club_bonus_per_month = COALESCE($14, club_bonus_per_month),
             household_id = CASE WHEN $15::text = 'unchanged' THEN household_id WHEN $15::text = 'null' THEN NULL ELSE $15::uuid END,
             holder_user_id = CASE WHEN $16::text = 'unchanged' THEN holder_user_id WHEN $16::text = 'null' THEN NULL ELSE $16::uuid END,
             updated_at = NOW()
         WHERE id = $2 AND ${visibleProgramsSql('$1', '')}
         RETURNING *`,
        [
            userId,
            id,
            patch.name ?? null,
            patch.issuer ?? null,
            patch.unit ?? null,
            expires,
            patch.notes ?? null,
            patch.transferBonusPercent == null ? null : Number(patch.transferBonusPercent),
            clubActive,
            patch.clubFeeBrl == null ? null : Number(patch.clubFeeBrl),
            patch.buyMilheiro == null ? null : Number(patch.buyMilheiro),
            clubStartedOn,
            patch.clubPointsPerMonth == null ? null : Math.max(0, Math.round(Number(patch.clubPointsPerMonth) || 0)),
            patch.clubBonusPerMonth == null ? null : Math.max(0, Math.round(Number(patch.clubBonusPerMonth) || 0)),
            householdId === undefined ? 'unchanged' : householdId == null ? 'null' : householdId,
            holderUserId === undefined ? 'unchanged' : holderUserId == null ? 'null' : holderUserId
        ]
    );
    const row = rows[0];
    if (!row) return null;
    return getProgram(userId, row.id);
}

export async function listRates(userId) {
    const { rows } = await query(
        `SELECT * FROM miles_conversion_rates WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId]
    );
    return rows.map(mapRate);
}

export async function upsertRate(userId, { fromProgramId, toProgramId, conversionFrom, conversionTo, bonusPercent }) {
    const { rows } = await query(
        `INSERT INTO miles_conversion_rates (
            user_id, from_program_id, to_program_id, conversion_from, conversion_to, bonus_percent, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, from_program_id, to_program_id)
         DO UPDATE SET
            conversion_from = EXCLUDED.conversion_from,
            conversion_to = EXCLUDED.conversion_to,
            bonus_percent = EXCLUDED.bonus_percent,
            updated_at = NOW()
         RETURNING *`,
        [
            userId,
            fromProgramId,
            toProgramId,
            Math.max(1, Math.trunc(Number(conversionFrom) || 1)),
            Math.max(1, Math.trunc(Number(conversionTo) || 1)),
            Number(bonusPercent) || 0
        ]
    );
    return mapRate(rows[0]);
}

export async function listClubCreditDates(userId, programId) {
    const { rows } = await query(
        `SELECT occurred_on FROM miles_movements
         WHERE user_id = $1 AND program_id = $2 AND source IN ('clube', 'clube_suppressed')`,
        [userId, programId]
    );
    return rows.map((row) => dateKey(row.occurred_on)).filter(Boolean);
}

export async function listMovements(userId, { programId, limit = 80 } = {}) {
    const params = [userId];
    let sql = `SELECT m.*, u.name AS recorded_by_name
         FROM miles_movements m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.program_id IN (SELECT p.id FROM miles_programs p WHERE ${visibleProgramsSql('$1')})`;
    if (programId) {
        params.push(programId);
        sql += ` AND m.program_id = $2`;
    }
    params.push(Math.min(200, Math.max(1, Number(limit) || 80)));
    sql += ` ORDER BY m.occurred_on DESC, m.created_at DESC LIMIT $${params.length}`;
    const { rows } = await query(sql, params);
    return rows.map(mapMovement);
}

export async function insertMovement(userId, body, clientQuery = query) {
    const { rows } = await clientQuery(
        `INSERT INTO miles_movements (
            user_id, program_id, type, points, points_sign, amount, currency, amount_brl, fx_to_brl,
            counterpart_program_id, transfer_group_id, bonus_points, conversion_from, conversion_to,
            bonus_percent, trip_id, emission_sim_id, occurred_on, source, notes
         ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
         ) RETURNING *`,
        [
            userId,
            body.programId,
            body.type,
            body.points,
            body.pointsSign ?? 1,
            body.amount ?? null,
            body.currency ?? 'BRL',
            body.amountBrl ?? null,
            body.fxToBrl ?? null,
            body.counterpartProgramId ?? null,
            body.transferGroupId ?? null,
            body.bonusPoints ?? 0,
            body.conversionFrom ?? null,
            body.conversionTo ?? null,
            body.bonusPercent ?? null,
            body.tripId ?? null,
            body.emissionSimId ?? null,
            body.occurredOn ?? new Date().toISOString().slice(0, 10),
            body.source ?? '',
            body.notes ?? ''
        ]
    );
    return mapMovement(rows[0]);
}

export async function getMovement(userId, id) {
    const { rows } = await query(
        `SELECT m.*, u.name AS recorded_by_name
         FROM miles_movements m
         LEFT JOIN users u ON u.id = m.user_id
         JOIN miles_programs p ON p.id = m.program_id
         WHERE m.id = $2 AND ${visibleProgramsSql('$1')}`,
        [userId, id]
    );
    return mapMovement(rows[0]);
}

export async function deleteMovement(userId, id) {
    const current = await getMovement(userId, id);
    if (!current) return null;

    return withTransaction(async (client) => {
        const q = (text, params) => client.query(text, params);

        if (current.transferGroupId) {
            await q(
                `DELETE FROM miles_movements m
                 USING miles_programs p
                 WHERE m.program_id = p.id
                   AND m.transfer_group_id = $2
                   AND ${visibleProgramsSql('$1')}`,
                [userId, current.transferGroupId]
            );
        } else {
            await q(
                `DELETE FROM miles_movements m
                 USING miles_programs p
                 WHERE m.id = $2 AND m.program_id = p.id AND ${visibleProgramsSql('$1')}`,
                [userId, id]
            );
        }

        const isClubCredit =
            current.source === 'clube' ||
            (current.type === 'acumulo' && /^Clube \d{2}\/\d{4}$/.test(String(current.notes ?? '').trim()));
        if (isClubCredit && current.occurredOn) {
            await insertMovement(
                userId,
                {
                    programId: current.programId,
                    type: 'ajuste',
                    points: 0,
                    pointsSign: 1,
                    source: 'clube_suppressed',
                    notes: 'Crédito do clube removido manualmente',
                    occurredOn: current.occurredOn
                },
                q
            );
        }

        return current;
    });
}

export async function insertTransferGroup(userId, legs) {
    return withTransaction(async (client) => {
        const q = (text, params) => client.query(text, params);
        const out = [];
        for (const leg of legs) {
            out.push(await insertMovement(userId, leg, q));
        }
        return out;
    });
}

export async function listReservedSims(userId) {
    const { rows } = await query(
        `SELECT * FROM miles_emission_sims WHERE user_id = $1 AND status = 'reservada'`,
        [userId]
    );
    const ids = rows.map((r) => r.id);
    const options = ids.length ? await listOptionsForSims(ids) : [];
    const bySim = new Map();
    for (const opt of options) {
        const list = bySim.get(opt.simId) ?? [];
        list.push(opt);
        bySim.set(opt.simId, list);
    }
    return rows.map((r) => mapSim(r, bySim.get(r.id) ?? []));
}

async function listOptionsForSims(simIds) {
    const { rows } = await query(
        `SELECT * FROM miles_emission_options WHERE sim_id = ANY($1::uuid[]) ORDER BY sort_index ASC, label ASC`,
        [simIds]
    );
    return rows.map(mapOption);
}

export async function listEmissions(userId, tripId) {
    const { rows } = await query(
        `SELECT * FROM miles_emission_sims WHERE user_id = $1 AND trip_id = $2 ORDER BY updated_at DESC`,
        [userId, tripId]
    );
    const ids = rows.map((r) => r.id);
    const options = ids.length ? await listOptionsForSims(ids) : [];
    const bySim = new Map();
    for (const opt of options) {
        const list = bySim.get(opt.simId) ?? [];
        list.push(opt);
        bySim.set(opt.simId, list);
    }
    return rows.map((r) => mapSim(r, bySim.get(r.id) ?? []));
}

export async function getEmission(userId, id) {
    const { rows } = await query(`SELECT * FROM miles_emission_sims WHERE user_id = $1 AND id = $2`, [userId, id]);
    if (!rows[0]) return null;
    const options = await listOptionsForSims([id]);
    return mapSim(rows[0], options);
}

export async function insertEmission(userId, body) {
    return withTransaction(async (client) => {
        const { rows } = await client.query(
            `INSERT INTO miles_emission_sims (
                user_id, trip_id, title, destination_program_id, origin_program_id,
                conversion_from, conversion_to, bonus_percent, points_round,
                buy_milheiro, buy_discount_percent, buy_extra_fee, buy_extra_fee_currency,
                fx_rate, iof_percent, spread_percent, club_fee_brl, status, notes,
                flight_simulation_id
             ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
             ) RETURNING *`,
            [
                userId,
                body.tripId,
                body.title,
                body.destinationProgramId,
                body.originProgramId,
                body.conversionFrom ?? 1,
                body.conversionTo ?? 1,
                body.bonusPercent ?? 0,
                body.pointsRound ?? 'down',
                body.buyMilheiro ?? 0,
                body.buyDiscountPercent ?? 0,
                body.buyExtraFee ?? 0,
                body.buyExtraFeeCurrency ?? 'BRL',
                body.fxRate ?? 1,
                body.iofPercent ?? 0,
                body.spreadPercent ?? 0,
                body.clubFeeBrl ?? 0,
                body.status ?? 'rascunho',
                body.notes ?? '',
                body.flightSimulationId ?? null
            ]
        );
        const sim = rows[0];
        const options = [];
        for (const [i, opt] of (body.options ?? []).entries()) {
            const { rows: orows } = await client.query(
                `INSERT INTO miles_emission_options (sim_id, label, destination_points, taxes_amount, taxes_currency, sort_index)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                [sim.id, opt.label || String.fromCharCode(65 + i), opt.destinationPoints ?? 0, opt.taxesAmount ?? 0, opt.taxesCurrency ?? 'EUR', i]
            );
            options.push(mapOption(orows[0]));
        }
        return mapSim(sim, options);
    });
}

export async function updateEmission(userId, id, body) {
    const current = await getEmission(userId, id);
    if (!current) return null;
    if (current.status === 'emitida') return current;
    return withTransaction(async (client) => {
        const { rows } = await client.query(
            `UPDATE miles_emission_sims SET
                title = COALESCE($3, title),
                destination_program_id = COALESCE($4, destination_program_id),
                origin_program_id = COALESCE($5, origin_program_id),
                conversion_from = COALESCE($6, conversion_from),
                conversion_to = COALESCE($7, conversion_to),
                bonus_percent = COALESCE($8, bonus_percent),
                points_round = COALESCE($9, points_round),
                buy_milheiro = COALESCE($10, buy_milheiro),
                buy_discount_percent = COALESCE($11, buy_discount_percent),
                buy_extra_fee = COALESCE($12, buy_extra_fee),
                fx_rate = COALESCE($13, fx_rate),
                iof_percent = COALESCE($14, iof_percent),
                spread_percent = COALESCE($15, spread_percent),
                club_fee_brl = COALESCE($16, club_fee_brl),
                chosen_option_id = COALESCE($17, chosen_option_id),
                notes = COALESCE($18, notes),
                updated_at = NOW()
             WHERE user_id = $1 AND id = $2
             RETURNING *`,
            [
                userId,
                id,
                body.title ?? null,
                body.destinationProgramId ?? null,
                body.originProgramId ?? null,
                body.conversionFrom ?? null,
                body.conversionTo ?? null,
                body.bonusPercent ?? null,
                body.pointsRound ?? null,
                body.buyMilheiro ?? null,
                body.buyDiscountPercent ?? null,
                body.buyExtraFee ?? null,
                body.fxRate ?? null,
                body.iofPercent ?? null,
                body.spreadPercent ?? null,
                body.clubFeeBrl ?? null,
                body.chosenOptionId ?? null,
                body.notes ?? null
            ]
        );
        if (Array.isArray(body.options)) {
            await client.query(`DELETE FROM miles_emission_options WHERE sim_id = $1`, [id]);
            for (const [i, opt] of body.options.entries()) {
                await client.query(
                    `INSERT INTO miles_emission_options (id, sim_id, label, destination_points, taxes_amount, taxes_currency, sort_index)
                     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2,$3,$4,$5,$6,$7)`,
                    [opt.id ?? null, id, opt.label || String.fromCharCode(65 + i), opt.destinationPoints ?? 0, opt.taxesAmount ?? 0, opt.taxesCurrency ?? 'EUR', i]
                );
            }
        }
        const options = (await client.query(
            `SELECT * FROM miles_emission_options WHERE sim_id = $1 ORDER BY sort_index`,
            [id]
        )).rows.map(mapOption);
        return mapSim(rows[0], options);
    });
}

export async function setEmissionStatus(userId, id, status) {
    const { rows } = await query(
        `UPDATE miles_emission_sims SET status = $3, updated_at = NOW()
         WHERE user_id = $1 AND id = $2
         RETURNING *`,
        [userId, id, status]
    );
    if (!rows[0]) return null;
    const options = await listOptionsForSims([id]);
    return mapSim(rows[0], options);
}

export async function financePreferencesOf(userId) {
    const { rows } = await query(`SELECT finance_preferences FROM users WHERE id = $1`, [userId]);
    return rows[0]?.finance_preferences ?? null;
}
