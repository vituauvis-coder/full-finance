import { parseHopInstant } from './country-schedule.js';

export function hopTimelineMs(hop) {
    const dep = parseHopInstant(hop?.departsAt ?? hop?.departs_at);
    if (dep) return dep.getTime();
    const arr = parseHopInstant(hop?.arrivesAt ?? hop?.arrives_at);
    if (arr) return arr.getTime();
    return Number.POSITIVE_INFINITY;
}

export function sortHopsChronologically(hops) {
    return (hops ?? [])
        .map((hop, index) => ({ hop, index, t: hopTimelineMs(hop) }))
        .sort((a, b) => a.t - b.t || a.index - b.index)
        .map((row) => row.hop);
}