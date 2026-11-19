/** Clube da carteira: aniversário mensal e créditos em atraso. */

const TZ = 'America/Sao_Paulo';

function ymd(raw) {
    const m = String(raw ?? '')
        .slice(0, 10)
        .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y, mo, d };
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function lastDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function creditOn(start, year, month) {
    const day = Math.min(start.d, lastDayOfMonth(year, month));
    return `${year}-${pad(month)}-${pad(day)}`;
}

function asKey(parts) {
    return `${parts.y}-${pad(parts.mo)}-${pad(parts.d)}`;
}

export function todayKey(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
}

/** Datas de crédito do clube de `startedOn` até `today` (inclusive, se o dia já chegou). */
export function clubCreditDates(startedOn, today) {
    const start = ymd(startedOn);
    const now = ymd(today);
    if (!start || !now) return [];
    const todayStr = asKey(now);
    const dates = [];
    let y = start.y;
    let mo = start.mo;
    while (y < now.y || (y === now.y && mo <= now.mo)) {
        const on = creditOn(start, y, mo);
        if (on <= todayStr) dates.push(on);
        mo += 1;
        if (mo > 12) {
            mo = 1;
            y += 1;
        }
        if (dates.length >= 60) break;
    }
    return dates;
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function clubOn(program) {
    return Boolean(program?.clubActive ?? program?.club_active);
}

function clubFeeOf(program) {
    return Math.max(0, num(program?.clubFeeBrl ?? program?.club_fee_brl));
}

function clubBasePts(program) {
    return Math.max(0, Math.round(num(program?.clubPointsPerMonth ?? program?.club_points_per_month)));
}

function clubBonusPts(program) {
    return Math.max(0, Math.round(num(program?.clubBonusPerMonth ?? program?.club_bonus_per_month)));
}

function money2(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

function clubDeclaredMonth(program) {
    return clubBasePts(program) + clubBonusPts(program);
}

/** Pontos que o clube entrega no mês (cota + bônus). Sem cota, usa o saldo atual. */
export function clubMonthPoints(program, fallbackPts = 0) {
    const monthly = clubDeclaredMonth(program);
    if (monthly > 0) return monthly;
    return Math.max(0, Math.round(num(fallbackPts)));
}

export function clubPricesStock(program) {
    return clubOn(program) && clubFeeOf(program) > 0;
}

/** Milheiro implícito da mensalidade (pontos do mês, ou o saldo atual se ainda não houver cota). */
export function clubMilheiro(program, balancePts = 0) {
    if (!clubOn(program)) return 0;
    const fee = clubFeeOf(program);
    if (fee <= 0) return 0;
    const pts = clubMonthPoints(program, balancePts);
    if (pts <= 0) return 0;
    return fee / (pts / 1000);
}

/**
 * Reais de um lote de pontos na mensalidade.
 * Meses completos valem a mensalidade cheia; 2 pontos a mais não somam centavos.
 */
export function clubValuePoints(program, pts, balancePts = 0) {
    if (!clubPricesStock(program)) return 0;
    const fee = clubFeeOf(program);
    const n = Math.max(0, Math.round(num(pts)));
    if (fee <= 0 || n <= 0) return 0;
    const declared = clubDeclaredMonth(program);
    if (declared <= 0) return fee;
    const lots = Math.floor(n / declared);
    if (lots <= 0) return money2((fee * n) / declared);
    return lots * fee;
}

/** Quanto o saldo vale: 1 mês = mensalidade; o próximo só entra com o crédito do mês. */
export function clubInvested(program, balancePts = 0) {
    return clubValuePoints(program, balancePts, balancePts);
}

function clubPointsForCreditMonth(program, occurredOn, startedOn, today) {
    const base = clubBasePts(program);
    const bonus = clubBonusPts(program);
    const schedule = clubCreditDates(startedOn, today);
    const firstOn = schedule[0];
    if (!firstOn) return 0;
    return occurredOn === firstOn ? base + bonus : base;
}

export function missingClubCredits({ startedOn, today, existingOn = [], program, points, feeBrl }) {
    const have = new Set((existingOn ?? []).map((d) => String(d).slice(0, 10)));
    const fee = Number(feeBrl);
    const amountBrl = Number.isFinite(fee) && fee > 0 ? String(fee) : null;
    const schedule = clubCreditDates(startedOn, today).filter((occurredOn) => !have.has(occurredOn));
    return schedule
        .map((occurredOn) => {
            let pts = 0;
            if (program) {
                pts = clubPointsForCreditMonth(program, occurredOn, startedOn, today);
            } else {
                pts = Math.max(0, Math.round(Number(points) || 0));
            }
            if (pts <= 0) return null;
            return {
                occurredOn,
                points: pts,
                amountBrl,
                notes: `Clube ${occurredOn.slice(5, 7)}/${occurredOn.slice(0, 4)}`
            };
        })
        .filter(Boolean);
}
