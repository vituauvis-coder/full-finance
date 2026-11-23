function roundMoney(n) {
    return Math.round(Number(n) * 100) / 100;
}

function yearMonthKey(referenceMonth) {
    const s = String(referenceMonth ?? '').trim();
    const m = s.match(/^(\d{4}-\d{2})/);
    return m ? m[1] : '';
}

function applicationBucketId(row) {
    return String(row?.bucketId ?? row?.bucket_id ?? '');
}

/**
 * @param {{ bucketId: string, yearMonth: string, principal: number, balance: number, id: string, ids: string[] }[]} rows
 */
function aggregateSnapshotsByBucketMonth(snapshots) {
    /** @type {Map<string, { bucketId: string, yearMonth: string, principal: number, balance: number, id: string, ids: string[] }>} */
    const map = new Map();

    for (const raw of snapshots ?? []) {
        const bucketId = applicationBucketId(raw);
        const yearMonth = yearMonthKey(raw.referenceMonth ?? raw.reference_month);
        if (!bucketId || !yearMonth) continue;
        const principal = Number(raw.principalAmount ?? raw.principal_amount) || 0;
        const balance = Number(raw.balanceWithYield ?? raw.balance_with_yield) || 0;
        const key = `${bucketId}|${yearMonth}`;
        const id = String(raw.id ?? '');
        const prev = map.get(key);
        if (!prev) {
            map.set(key, {
                bucketId,
                yearMonth,
                principal,
                balance,
                id,
                ids: id ? [id] : []
            });
        } else {
            prev.principal = roundMoney(prev.principal + principal);
            prev.balance = roundMoney(prev.balance + balance);
            if (id) prev.ids.push(id);
            if (!prev.id && id) prev.id = id;
        }
    }

    return [...map.values()];
}

/**
 * Saldo líquido de aportes (entradas − saídas) na caixinha até o fim do mês inclusive.
 *
 * @param {string} bucketId
 * @param {string} throughYearMonth `YYYY-MM`
 * @param {{ bucketId?: string, yearMonth: string, amount: number, accountId?: string }[]} inflowEvents
 * @param {{ bucketId: string, yearMonth: string, amount: number, accountId?: string }[]} outflowEvents
 * @param {string} [accountId]
 */
export function cofrinhoNetPrincipalThroughMonth(
    bucketId,
    throughYearMonth,
    inflowEvents = [],
    outflowEvents = [],
    accountId = ''
) {
    if (!bucketId || !throughYearMonth) return 0;
    const acct = String(accountId ?? '').trim();
    let sum = 0;
    for (const ev of inflowEvents) {
        if (ev.bucketId !== bucketId) continue;
        if (acct && String(ev.accountId ?? '').trim() !== acct) continue;
        if (!ev.yearMonth || ev.yearMonth > throughYearMonth) continue;
        sum += Math.max(0, Number(ev.amount) || 0);
    }
    for (const ev of outflowEvents) {
        if (ev.bucketId !== bucketId) continue;
        if (acct && String(ev.accountId ?? '').trim() !== acct) continue;
        if (!ev.yearMonth || ev.yearMonth > throughYearMonth) continue;
        sum -= Math.max(0, Number(ev.amount) || 0);
    }
    return roundMoney(Math.max(0, sum));
}

/**
 * Rendimento do mês = variação do lucro acumulado (soma saldos − soma aportes), por caixinha.
 */
export function buildCofrinhoMonthlyYieldEvents(snapshots) {
    const aggregated = aggregateSnapshotsByBucketMonth(snapshots).map((row) => ({
        id: row.id || `${row.bucketId}-${row.yearMonth}`,
        bucketId: row.bucketId,
        referenceMonth: `${row.yearMonth}-01`,
        principalAmount: row.principal,
        balanceWithYield: row.balance,
        snapshotIds: row.ids
    }));

    const byBucket = new Map();

    for (const snap of aggregated) {
        const bucketId = snap.bucketId;
        const yearMonth = yearMonthKey(snap.referenceMonth);
        const cumulativeYield = roundMoney(Math.max(0, snap.balanceWithYield - snap.principalAmount));
        const item = {
            id: snap.id,
            bucketId,
            yearMonth,
            cumulativeYield,
            yieldMonthKey: `${bucketId}|${yearMonth}`,
            snapshotIds: snap.snapshotIds ?? []
        };
        if (!byBucket.has(bucketId)) byBucket.set(bucketId, []);
        byBucket.get(bucketId).push(item);
    }

    const events = [];
    for (const list of byBucket.values()) {
        list.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
        let prevCumulative = 0;
        for (const snap of list) {
            const monthly = roundMoney(snap.cumulativeYield - prevCumulative);
            if (Math.abs(monthly) >= 0.005) {
                events.push({
                    id: `yield-${snap.yieldMonthKey}`,
                    bucketId: snap.bucketId,
                    yearMonth: snap.yearMonth,
                    amount: monthly,
                    snapshotId: snap.id || undefined,
                    yieldMonthKey: snap.yieldMonthKey
                });
            }
            prevCumulative = snap.cumulativeYield;
        }
    }

    return events.sort((a, b) => {
        if (b.yearMonth !== a.yearMonth) return b.yearMonth.localeCompare(a.yearMonth);
        return String(a.bucketId).localeCompare(String(b.bucketId));
    });
}