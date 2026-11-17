import { scenarioSnapshot } from '../viagens-api.js';

export function openSimuladorOverlay(host, ctx) {
    const { getDraft, patchDraft, scheduleSave, scenarioWinnerId, onClose } = ctx;
    const draft = getDraft();
    const scenarios = draft.payload?.time_scenarios ?? draft.payload?.timeScenarios ?? [];

    const overlay = document.createElement('div');
    overlay.className = 'viagens-simulador-overlay';
    overlay.innerHTML = `
        <div class="viagens-simulador">
            <header class="viagens-simulador__head">
                <h2>Simulador</h2>
                <p class="viagens-muted">Compare férias, rota e o que cada cenário visita</p>
                <button type="button" class="viagens-btn viagens-btn--ghost" id="viagens-sim-close">Fechar</button>
            </header>
            <div class="viagens-simulador__grid">
                <aside class="viagens-sim-list">
                    <button type="button" class="viagens-btn viagens-btn--coral" id="viagens-sim-new">+ Novo</button>
                    ${scenarios
                        .map(
                            (sc, i) => `<div class="viagens-sim-card-btn" data-sc-id="${sc.id}">
                        <strong>${escapeHtml(sc.title ?? `Cenário ${String.fromCharCode(65 + i)}`)}</strong>
                    </div>`
                        )
                        .join('')}
                </aside>
                <main class="viagens-sim-detail">
                    <p class="viagens-muted">Vencedor atual: ${scenarioWinnerId ?? '—'}</p>
                    <div id="viagens-sim-snapshot"></div>
                </main>
            </div>
        </div>`;

    host.appendChild(overlay);
    overlay.querySelector('#viagens-sim-close')?.addEventListener('click', () => {
        overlay.remove();
        onClose?.();
    });
    overlay.querySelector('#viagens-sim-new')?.addEventListener('click', () => {
        const id = crypto.randomUUID();
        patchDraft((d) => ({
            ...d,
            payload: {
                ...d.payload,
                time_scenarios: [
                    ...(d.payload.time_scenarios ?? []),
                    { id, title: `Cenário ${String.fromCharCode(65 + (d.payload.time_scenarios ?? []).length)}`, hops: [] }
                ]
            }
        }));
        scheduleSave();
        overlay.remove();
        openSimuladorOverlay(host, ctx);
    });

    const detail = overlay.querySelector('#viagens-sim-snapshot');
    void (async () => {
        try {
            const { snapshots, winnerId } = await scenarioSnapshot({
                scenarios,
                criteria: draft.payload?.scenario_criteria ?? []
            });
            detail.innerHTML = (snapshots ?? [])
                .map(
                    (sn) => `
                <div class="viagens-sim-snap">
                    <h4>${escapeHtml(sn.name ?? sn.scenarioId)}</h4>
                    <p>Turismo: ${sn.tourism?.tourismDays ?? '—'}d · Férias: ${sn.vacation?.consumedDays ?? '—'}d</p>
                    ${sn.scenarioId === winnerId ? '<span class="viagens-stamp viagens-stamp--planejada">★ Vencedor</span>' : ''}
                </div>`
                )
                .join('');
        } catch (e) {
            detail.textContent = e.message;
        }
    })();
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}