const FILLS = {
    realizada: 'var(--v-coral)',
    em_curso: 'var(--v-turquesa)',
    planejada: 'rgba(242, 201, 76, 0.28)'
};
const STROKES = {
    realizada: 'var(--v-coral)',
    em_curso: 'var(--v-turquesa)',
    planejada: 'var(--v-ouro)'
};

export function renderViagensPinHtml(status, { hovering = false, index = 0, isPrincipal = false, size = 'md' } = {}) {
    const key = status === 'em_curso' || status === 'realizada' ? status : 'planejada';
    const w = size === 'sm' ? 22 : 28;
    const h = size === 'sm' ? 28 : 36;
    const ring = key === 'em_curso';
    const breathe = key === 'planejada' ? 'viagens-pin-wrap--breathe' : '';
    const hover = hovering ? 'viagens-pin-wrap--hover' : '';
    const symbol = isPrincipal ? '★' : '✈';
    return `
        <span class="viagens-pin-wrap ${breathe} ${hover}" style="animation-delay:${index * 0.06}s">
            ${ring ? '<span class="viagens-pin-ring" aria-hidden="true"></span>' : ''}
            <svg width="${w}" height="${h}" viewBox="0 0 28 36" class="viagens-pin-svg" aria-hidden="true">
                <path d="M14 0a14 14 0 0 1 14 14c0 8-14 22-14 22S0 22 0 14A14 14 0 0 1 14 0z"
                    fill="${FILLS[key]}" stroke="${STROKES[key]}" stroke-width="1.6"/>
                <text x="14" y="16" text-anchor="middle" font-size="9" font-weight="700"
                    fill="${isPrincipal ? 'var(--v-ouro)' : 'var(--v-areia)'}">${symbol}</text>
            </svg>
        </span>`;
}