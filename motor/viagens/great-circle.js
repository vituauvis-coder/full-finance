function toRad(deg) {
    return (deg * Math.PI) / 180;
}

function toDeg(rad) {
    return (rad * 180) / Math.PI;
}

/** Pontos [lng, lat] ao longo do arco de menor distância (geodésica). */
export function greatCircleArc(start, end, steps = 48) {
    const lng1 = start.lng;
    const lat1 = start.lat;
    const lng2 = end.lng;
    const lat2 = end.lat;

    const φ1 = toRad(lat1);
    const λ1 = toRad(lng1);
    const φ2 = toRad(lat2);
    const λ2 = toRad(lng2);

    const sinD = Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
    );
    const d = 2 * Math.asin(Math.min(1, sinD));
    if (!Number.isFinite(d) || d < 1e-6) {
        return [
            [lng1, lat1],
            [lng2, lat2]
        ];
    }

    const coords = [];
    for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const a = Math.sin((1 - f) * d) / Math.sin(d);
        const b = Math.sin(f * d) / Math.sin(d);
        const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
        const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
        const z = a * Math.sin(φ1) + b * Math.sin(φ2);
        const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
        const λ = Math.atan2(y, x);
        coords.push([toDeg(λ), toDeg(φ)]);
    }
    return coords;
}

export function smoothRouteCoordinates(points, stepsPerLeg = 56) {
    if (!points?.length) return [];
    if (points.length < 2) return points.map((p) => [p.lng, p.lat]);
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
        const leg = greatCircleArc(points[i], points[i + 1], stepsPerLeg);
        if (i === 0) out.push(...leg);
        else out.push(...leg.slice(1));
    }
    return out;
}