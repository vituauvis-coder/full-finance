import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { convertPoints } from '../../motor/milhas/convert.js';
import { purchaseCost } from '../../motor/milhas/purchase.js';
import { money2 } from '../../motor/milhas/purchase.js';
import {
    acquisitionBuckets,
    acquisitionMilheiro,
    movementDelta,
    programBalance,
    setBalanceAdjustment
} from '../../motor/milhas/ledger.js';
import { buildDashboard, compareEmissionOptions, originNeededForSim } from '../../motor/milhas/emission.js';
import { clubInvested, clubMilheiro, clubMonthPoints, clubPricesStock, missingClubCredits, todayKey } from '../../motor/milhas/club.js';
import {
    MILES_PROGRAM_PRESETS,
    WALLET_UNITS,
    defaultUnitForBrand,
    isWalletUnit,
    presetByBrand
} from '../../motor/milhas/catalog.js';
import { ensureHouseholdForUser, validateHolderUserId } from '../household.js';
import * as repo from '../miles-repository.js';

const SIMPLE_TYPES = ['acumulo', 'compra', 'bonus', 'emissao', 'expiracao', 'ajuste'];

function parsePrefs(raw) {
    if (raw == null || raw === '') return {};
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return typeof raw === 'object' ? raw : {};
}

function amountBrlOf(body) {
    if (body.amount == null || body.amount === '') return null;
    const currency = String(body.currency || 'BRL').toUpperCase();
    const amount = new Decimal(body.amount);
    if (!amount.isFinite()) return null;
    if (currency === 'BRL') return money2(amount).toString();
    const fx = new Decimal(body.fxToBrl ?? body.fx_to_brl ?? 0);
    if (!fx.gt(0)) return null;
    return money2(amount.mul(fx)).toString();
}

async function seedFromLegacy(userId) {
    let programs = await repo.listPrograms(userId);
    if (programs.length === 0) {
        const prefs = parsePrefs(await repo.financePreferencesOf(userId));
        const legacy = Array.isArray(prefs.viagensMiles?.programs) ? prefs.viagensMiles.programs : [];
        if (legacy.length === 0) {
            const esfera = presetByBrand('esfera');
            await repo.insertProgram(userId, esfera);
        } else {
            for (const p of legacy) {
                const brand = MILES_PROGRAM_PRESETS.some((x) => x.brand === p.brand) ? p.brand : 'outro';
                const meta = presetByBrand(brand);
                const created = await repo.insertProgram(userId, {
                    brand,
                    name: p.name || meta.name,
                    issuer: meta.issuer,
                    unit: meta.unit
                });
                const bal = Math.max(0, Math.round(Number(p.balance) || 0));
                if (bal > 0) {
                    await repo.insertMovement(userId, {
                        programId: created.id,
                        type: 'ajuste',
                        points: bal,
                        pointsSign: 1,
                        notes: 'Abertura (Casa das milhas)',
                        occurredOn: new Date().toISOString().slice(0, 10)
                    });
                }
            }
        }
        programs = await repo.listPrograms(userId);
    }
    if (!programs.some((p) => p.brand === 'esfera')) {
        try {
            await repo.insertProgram(userId, presetByBrand('esfera'));
            programs = await repo.listPrograms(userId);
        } catch {
            programs = await repo.listPrograms(userId);
        }
    }
    return programs;
}

async function ensureClubCredits(userId) {
    const programs = await repo.listPrograms(userId);
    const today = todayKey();
    for (const program of programs) {
        if (!program.clubActive || !program.clubStartedOn) continue;
        const existingOn = await repo.listClubCreditDates(userId, program.id);
        const missing = missingClubCredits({
            startedOn: program.clubStartedOn,
            today,
            existingOn,
            program,
            feeBrl: program.clubFeeBrl
        });
        for (const credit of missing) {
            try {
                await repo.insertMovement(userId, {
                    programId: program.id,
                    type: 'acumulo',
                    points: credit.points,
                    pointsSign: 1,
                    amount: credit.amountBrl,
                    currency: 'BRL',
                    amountBrl: credit.amountBrl,
                    source: 'clube',
                    notes: credit.notes,
                    occurredOn: credit.occurredOn
                });
            } catch (e) {
                if (e.code !== '23505') throw e;
            }
        }
    }
}

async function programsWithBalance(userId) {
    const programs = await seedFromLegacy(userId);
    await ensureClubCredits(userId);
    const movements = await repo.listMovements(userId, { limit: 200 });
    return programs.map((p) => {
        const balance = programBalance(movements, p.id);
        const acquired = acquisitionMilheiro(movements, p.id);
        const declared = Number(p.buyMilheiro) || 0;
        const clubRate = clubMilheiro(p, balance);
        const milheiro = acquired.gt(0)
            ? acquired
            : clubRate > 0
              ? new Decimal(clubRate)
              : declared > 0
                ? new Decimal(declared)
                : new Decimal(0);
        const buckets = acquisitionBuckets(movements, p.id).map((b) => ({
            key: b.key,
            label: b.label,
            points: Math.round(b.points),
            amountBrl: b.amountBrl.toString(),
            milheiro: b.milheiro.toString()
        }));
        return {
            ...p,
            balance,
            acquisitionMilheiro: acquired.gt(0) ? acquired.toString() : '0',
            acquisitionBuckets: buckets,
            milheiro: milheiro.toString(),
            invested: clubPricesStock(p) ? String(clubInvested(p, balance)) : undefined
        };
    });
}

export function registerMilesRoutes(app, { requireAuth }) {
    app.use('/api/miles', requireAuth, async (_req, _res, next) => {
        try {
            await repo.ensureMilesSchema();
            next();
        } catch (e) {
            next(e);
        }
    });

    app.get('/api/miles/programs', async (req, res) => {
        try {
            const userId = req.session.userId;
            res.json({
                programs: await programsWithBalance(userId),
                presets: MILES_PROGRAM_PRESETS,
                units: WALLET_UNITS,
                rates: await repo.listRates(userId)
            });
        } catch (e) {
            console.error('GET /api/miles/programs', e);
            res.status(500).json({ error: 'Erro ao listar programas' });
        }
    });

    app.post('/api/miles/programs', async (req, res) => {
        try {
            const brand = String(req.body?.brand || 'outro');
            if (!MILES_PROGRAM_PRESETS.some((p) => p.brand === brand)) {
                return res.status(400).json({ error: 'Programa inválido' });
            }
            const name = String(req.body?.name || '').trim();
            if (!name) return res.status(400).json({ error: 'Dê um nome à carteira' });
            const meta = presetByBrand(brand);
            const unit = isWalletUnit(req.body?.unit) ? req.body.unit : defaultUnitForBrand(brand);
            const payload = {
                brand,
                name,
                issuer: req.body?.issuer ?? meta.issuer,
                unit,
                expiresOn: req.body?.expiresOn || null,
                notes: req.body?.notes || ''
            };
            let program;
            try {
                program = await repo.insertProgram(req.session.userId, payload);
            } catch (e) {
                if (e.code !== '23505') throw e;
                program = await repo.insertProgram(req.session.userId, { ...payload, brand: 'outro' });
            }
            res.status(201).json({ program: { ...program, balance: 0 } });
        } catch (e) {
            if (e.code === '23505') return res.status(400).json({ error: 'Programa já cadastrado' });
            console.error('POST /api/miles/programs', e);
            res.status(500).json({ error: 'Erro ao criar programa' });
        }
    });

    app.patch('/api/miles/programs/:id', async (req, res) => {
        try {
            const body = req.body ?? {};
            if (body.unit != null && !isWalletUnit(body.unit)) {
                return res.status(400).json({ error: 'Moeda inválida' });
            }
            if (body.name != null && !String(body.name).trim()) {
                return res.status(400).json({ error: 'Dê um nome à carteira' });
            }
            const patch = {
                ...body,
                name: body.name != null ? String(body.name).trim() : undefined
            };
            if (body.householdShared === true) {
                patch.householdId = await ensureHouseholdForUser(req.session.userId);
                if (body.holderUserId) {
                    patch.holderUserId = await validateHolderUserId(body.holderUserId, req.session.userId);
                } else {
                    patch.holderUserId = req.session.userId;
                }
            } else if (body.householdShared === false) {
                patch.householdId = null;
                patch.holderUserId = null;
            }
            delete patch.householdShared;
            const program = await repo.updateProgram(req.session.userId, req.params.id, patch);
            if (!program) return res.status(404).json({ error: 'Programa não encontrado' });
            if (body.clubFeeBrl != null) {
                await repo.syncClubFeeOnMovements(req.session.userId, program.id, program.clubFeeBrl);
            }
            await ensureClubCredits(req.session.userId);
            const [fresh] = (await programsWithBalance(req.session.userId)).filter((p) => p.id === program.id);
            res.json({ program: fresh ?? program });
        } catch (e) {
            console.error('PATCH /api/miles/programs', e);
            res.status(500).json({ error: 'Erro ao atualizar programa' });
        }
    });

    app.get('/api/miles/movements', async (req, res) => {
        try {
            const movements = await repo.listMovements(req.session.userId, {
                programId: req.query.programId,
                limit: req.query.limit
            });
            res.json({ movements });
        } catch (e) {
            console.error('GET /api/miles/movements', e);
            res.status(500).json({ error: 'Erro ao listar extrato' });
        }
    });

    app.delete('/api/miles/movements/:id', async (req, res) => {
        try {
            const movement = await repo.deleteMovement(req.session.userId, req.params.id);
            if (!movement) return res.status(404).json({ error: 'Lançamento não encontrado' });
            res.json({ ok: true });
        } catch (e) {
            console.error('DELETE /api/miles/movements', e);
            const detail = e?.message && process.env.NODE_ENV !== 'production' ? String(e.message) : null;
            res.status(500).json({ error: detail || 'Erro ao apagar lançamento' });
        }
    });

    app.post('/api/miles/movements', async (req, res) => {
        try {
            const body = req.body ?? {};
            if (body.type === 'transferencia') {
                const fromId = body.fromProgramId;
                const toId = body.toProgramId;
                if (!fromId || !toId) return res.status(400).json({ error: 'Origem e destino obrigatórios' });
                const originPoints = Math.max(0, Math.round(Number(body.originPoints) || 0));
                if (originPoints <= 0) return res.status(400).json({ error: 'Pontos inválidos' });
                const fromMoves = await repo.listMovements(req.session.userId, { programId: fromId, limit: 200 });
                if (programBalance(fromMoves, fromId) < originPoints) {
                    return res.status(400).json({ error: 'Saldo insuficiente na origem' });
                }
                const converted = convertPoints({
                    originPoints,
                    from: body.conversionFrom ?? 1,
                    to: body.conversionTo ?? 1,
                    bonusPercent: body.bonusPercent ?? 0
                });
                const groupId = randomUUID();
                const occurredOn = body.occurredOn;
                const notes = body.notes ?? '';
                const legs = [
                    {
                        programId: fromId,
                        type: 'transferencia_saida',
                        points: originPoints,
                        counterpartProgramId: toId,
                        transferGroupId: groupId,
                        conversionFrom: body.conversionFrom ?? 1,
                        conversionTo: body.conversionTo ?? 1,
                        bonusPercent: body.bonusPercent ?? 0,
                        occurredOn,
                        notes
                    },
                    {
                        programId: toId,
                        type: 'transferencia_entrada',
                        points: converted.base,
                        counterpartProgramId: fromId,
                        transferGroupId: groupId,
                        conversionFrom: body.conversionFrom ?? 1,
                        conversionTo: body.conversionTo ?? 1,
                        bonusPercent: body.bonusPercent ?? 0,
                        occurredOn,
                        notes
                    }
                ];
                if (converted.bonus > 0) {
                    legs.push({
                        programId: toId,
                        type: 'bonus',
                        points: converted.bonus,
                        bonusPoints: converted.bonus,
                        counterpartProgramId: fromId,
                        transferGroupId: groupId,
                        conversionFrom: body.conversionFrom ?? 1,
                        conversionTo: body.conversionTo ?? 1,
                        bonusPercent: body.bonusPercent ?? 0,
                        occurredOn,
                        notes
                    });
                }
                const movements = await repo.insertTransferGroup(req.session.userId, legs);
                const rate = await repo.upsertRate(req.session.userId, {
                    fromProgramId: fromId,
                    toProgramId: toId,
                    conversionFrom: body.conversionFrom ?? 1,
                    conversionTo: body.conversionTo ?? 1,
                    bonusPercent: body.bonusPercent ?? 0
                });
                return res.status(201).json({ movements, converted, rate });
            }
            if (!SIMPLE_TYPES.includes(body.type)) {
                return res.status(400).json({ error: 'Tipo de movimentação inválido' });
            }
            const points = Math.max(0, Math.round(Number(body.points) || 0));
            if (points <= 0) return res.status(400).json({ error: 'Pontos inválidos' });
            if (!body.programId) return res.status(400).json({ error: 'Programa obrigatório' });
            const brl = amountBrlOf(body);
            if ((body.currency && String(body.currency).toUpperCase() !== 'BRL') && body.amount && brl == null) {
                return res.status(400).json({ error: 'Informe fxToBrl para converter o valor' });
            }
            const draft = {
                ...body,
                points,
                amountBrl: brl,
                pointsSign: body.type === 'ajuste' ? (Number(body.pointsSign) >= 0 ? 1 : -1) : 1
            };
            const all = await repo.listMovements(req.session.userId, { programId: body.programId, limit: 200 });
            if (programBalance(all, body.programId) + movementDelta(draft) < 0) {
                return res.status(400).json({ error: 'Saldo não pode ficar negativo' });
            }
            const movement = await repo.insertMovement(req.session.userId, draft);
            res.status(201).json({ movement });
        } catch (e) {
            console.error('POST /api/miles/movements', e);
            res.status(500).json({ error: 'Erro ao lançar movimentação' });
        }
    });

    app.post('/api/miles/programs/:id/set-balance', async (req, res) => {
        try {
            const program = await repo.getProgram(req.session.userId, req.params.id);
            if (!program) return res.status(404).json({ error: 'Programa não encontrado' });
            const movements = await repo.listMovements(req.session.userId, { programId: program.id, limit: 200 });
            const current = programBalance(movements, program.id);
            const adj = setBalanceAdjustment({ current, target: req.body?.balance });
            if (!adj) return res.json({ movement: null, balance: current });
            const movement = await repo.insertMovement(req.session.userId, {
                programId: program.id,
                type: 'ajuste',
                points: adj.points,
                pointsSign: adj.pointsSign,
                notes: req.body?.notes || 'Ajuste de saldo'
            });
            res.status(201).json({ movement, balance: current + adj.points * adj.pointsSign });
        } catch (e) {
            console.error('POST set-balance', e);
            res.status(500).json({ error: 'Erro ao ajustar saldo' });
        }
    });

    app.get('/api/miles/dashboard', async (req, res) => {
        try {
            const userId = req.session.userId;
            const programs = await seedFromLegacy(userId);
            await ensureClubCredits(userId);
            const movements = await repo.listMovements(userId, { limit: 200 });
            const reservedSims = await repo.listReservedSims(userId);
            const excludeFlightSimulationId = req.query.excludeFlightSimulationId
                ? String(req.query.excludeFlightSimulationId)
                : undefined;
            const dash = buildDashboard({ programs, movements, reservedSims, excludeFlightSimulationId });
            const tripReserved = req.query.tripId
                ? reservedSims.filter((s) => s.tripId === req.query.tripId)
                : reservedSims;
            res.json({
                programs: dash.programs.map((p) => ({
                    ...p,
                    milheiro: p.milheiro.toString(),
                    acquisitionMilheiro: p.acquisitionMilheiro?.toString?.() ?? '0',
                    acquisitionBuckets: p.acquisitionBuckets ?? [],
                    invested: p.invested.toString()
                })),
                recent: dash.recent,
                reserved: tripReserved
            });
        } catch (e) {
            console.error('GET /api/miles/dashboard', e);
            res.status(500).json({ error: 'Erro no dashboard de pontos' });
        }
    });

    app.post('/api/miles/preview/convert', (req, res) => {
        res.json(convertPoints(req.body ?? {}));
    });

    app.post('/api/miles/preview/purchase', (req, res) => {
        const r = purchaseCost(req.body ?? {});
        res.json({
            gross: r.gross.toString(),
            total: r.total.toString(),
            costPerPoint: r.costPerPoint.toString(),
            costPerMilheiro: r.costPerMilheiro.toString()
        });
    });

    app.post('/api/miles/preview/emission', async (req, res) => {
        try {
            const { sim, options, originBalance, originProgramId } = req.body ?? {};
            let milheiro = req.body?.acquisitionMilheiro;
            if (milheiro == null && originProgramId) {
                const movements = await repo.listMovements(req.session.userId, { programId: originProgramId, limit: 200 });
                milheiro = acquisitionMilheiro(movements, originProgramId);
            }
            const compared = compareEmissionOptions(sim ?? {}, options ?? [], originBalance ?? 0, milheiro ?? 0);
            res.json({
                ...compared,
                options: compared.options.map((o) => ({
                    ...o,
                    buyCost: o.buyCost.toString(),
                    taxesBrl: o.taxesBrl.toString(),
                    outlay: o.outlay.toString(),
                    sunk: o.sunk.toString(),
                    economic: o.economic.toString(),
                    valueScore: o.valueScore == null ? null : o.valueScore.toString()
                })),
                diffs: compared.diffs.map((d) => ({ id: d.id, outlayVsBest: d.outlayVsBest.toString() }))
            });
        } catch (e) {
            console.error('preview emission', e);
            res.status(400).json({ error: 'Não foi possível simular a emissão' });
        }
    });

    app.get('/api/miles/emissions', async (req, res) => {
        try {
            const tripId = req.query.tripId;
            if (!tripId) return res.status(400).json({ error: 'tripId obrigatório' });
            const emissions = await repo.listEmissions(req.session.userId, tripId);
            res.json({ emissions });
        } catch (e) {
            console.error('GET emissions', e);
            res.status(500).json({ error: 'Erro ao listar emissões' });
        }
    });

    app.post('/api/miles/emissions', async (req, res) => {
        try {
            const body = req.body ?? {};
            if (!body.tripId || !body.title || !body.originProgramId || !body.destinationProgramId) {
                return res.status(400).json({ error: 'Dados incompletos' });
            }
            const emission = await repo.insertEmission(req.session.userId, body);
            res.status(201).json({ emission });
        } catch (e) {
            console.error('POST emissions', e);
            res.status(500).json({ error: 'Erro ao salvar simulação' });
        }
    });

    app.get('/api/miles/emissions/:id', async (req, res) => {
        const emission = await repo.getEmission(req.session.userId, req.params.id);
        if (!emission) return res.status(404).json({ error: 'Simulação não encontrada' });
        res.json({ emission });
    });

    app.patch('/api/miles/emissions/:id', async (req, res) => {
        try {
            const emission = await repo.updateEmission(req.session.userId, req.params.id, req.body ?? {});
            if (!emission) return res.status(404).json({ error: 'Simulação não encontrada' });
            res.json({ emission });
        } catch (e) {
            console.error('PATCH emission', e);
            res.status(500).json({ error: 'Erro ao atualizar simulação' });
        }
    });

    app.post('/api/miles/emissions/:id/reserve', async (req, res) => {
        const current = await repo.getEmission(req.session.userId, req.params.id);
        if (!current) return res.status(404).json({ error: 'Simulação não encontrada' });
        if (current.status === 'emitida') return res.status(400).json({ error: 'Já emitida' });
        const emission = await repo.setEmissionStatus(req.session.userId, req.params.id, 'reservada');
        res.json({ emission });
    });

    app.post('/api/miles/emissions/:id/emit', async (req, res) => {
        try {
            const current = await repo.getEmission(req.session.userId, req.params.id);
            if (!current) return res.status(404).json({ error: 'Simulação não encontrada' });
            if (current.status === 'emitida') return res.json({ emission: current });
            const chosen =
                current.options.find((o) => o.id === current.chosenOptionId) ?? current.options[0];
            if (!chosen) return res.status(400).json({ error: 'Cadastre ao menos uma opção' });
            const needed = originNeededForSim(current, chosen);
            const movements = await repo.listMovements(req.session.userId, {
                programId: current.originProgramId,
                limit: 200
            });
            const reserved = (await repo.listReservedSims(req.session.userId)).filter((s) => s.id !== current.id);
            const available =
                programBalance(movements, current.originProgramId) -
                reserved
                    .filter((s) => s.originProgramId === current.originProgramId)
                    .reduce((n, s) => {
                        const opt = s.options.find((o) => o.id === s.chosenOptionId) ?? s.options[0];
                        return n + (opt ? originNeededForSim(s, opt) : 0);
                    }, 0);
            if (available < needed) {
                return res.status(409).json({ error: 'Pontos insuficientes para emitir', needed, available });
            }
            await repo.insertMovement(req.session.userId, {
                programId: current.originProgramId,
                type: 'emissao',
                points: needed,
                tripId: current.tripId,
                emissionSimId: current.id,
                notes: current.title
            });
            const emission = await repo.setEmissionStatus(req.session.userId, current.id, 'emitida');
            res.json({ emission });
        } catch (e) {
            console.error('emit', e);
            res.status(500).json({ error: 'Erro ao registrar emissão' });
        }
    });
}
