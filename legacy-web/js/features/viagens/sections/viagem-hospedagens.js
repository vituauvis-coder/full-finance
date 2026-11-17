export function renderHospedagensSection(draft) {
    const stays = draft.payload?.stays ?? [];
    const legs = draft.payload?.legs ?? [];
    const dests = (draft.payload?.destinations ?? []).map((d) => ({
        id: d.id,
        label: d.name
    }));
    const destOpts = dests.map((d) => `<option value="${d.id}">${escapeHtml(d.label)}</option>`).join('');
    return `
        <details class="viagens-secao">
            <summary class="viagens-secao__head"><span class="viagens-secao__dot viagens-secao__dot--turquesa"></span> Hospedagens & transporte terrestre</summary>
            <div class="viagens-secao__body viagens-two-cols">
                <div>
                    <h4>Hospedagens</h4>
                    ${stays
                        .map(
                            (s) => `
                        <div class="viagens-list-item" data-stay-id="${s.id}">
                            <input class="viagens-field" data-stay-name value="${escapeHtml(s.name ?? '')}" placeholder="Nome">
                            <input type="number" class="viagens-field" data-stay-amount min="0" value="${s.amount ?? ''}">
                            <select class="viagens-field" data-stay-dest>${destOpts}</select>
                            <button type="button" data-stay-del class="viagens-btn viagens-btn--ghost">✕</button>
                        </div>`
                        )
                        .join('')}
                    <button type="button" class="viagens-btn viagens-btn--ghost" data-add-stay>+ Hospedagem</button>
                </div>
                <div>
                    <h4>Terrestre</h4>
                    ${legs.length === 0 ? '<p class="viagens-muted">Nenhum trecho terrestre</p>' : ''}
                    ${legs
                        .map(
                            (l) => `
                        <div class="viagens-list-item" data-leg-id="${l.id}">
                            <input class="viagens-field" data-leg-kind value="${escapeHtml(l.kind ?? 'trecho')}">
                            <input type="number" class="viagens-field" data-leg-amount value="${l.amount ?? ''}">
                            <button type="button" data-leg-del class="viagens-btn viagens-btn--ghost">✕</button>
                        </div>`
                        )
                        .join('')}
                    <button type="button" class="viagens-btn viagens-btn--ghost" data-add-leg>+ Trecho terrestre</button>
                </div>
            </div>
        </details>`;
}

export function bindHospedagensSection(root, ctx) {
    const { patchDraft, scheduleSave } = ctx;
    root.querySelector('[data-add-stay]')?.addEventListener('click', () => {
        patchDraft((d) => ({
            ...d,
            payload: {
                ...d.payload,
                stays: [
                    ...(d.payload.stays ?? []),
                    { id: crypto.randomUUID(), name: '', amount: 0, destinationId: d.payload.destinations?.[0]?.id ?? null }
                ]
            }
        }));
        scheduleSave();
        root.dispatchEvent(new CustomEvent('viagens:rerender'));
    });
    root.querySelector('[data-add-leg]')?.addEventListener('click', () => {
        patchDraft((d) => ({
            ...d,
            payload: {
                ...d.payload,
                legs: [
                    ...(d.payload.legs ?? []),
                    {
                        id: crypto.randomUUID(),
                        kind: 'ônibus',
                        amount: 0,
                        tripDestinationId: d.payload.destinations?.[0]?.id ?? null
                    }
                ]
            }
        }));
        scheduleSave();
        root.dispatchEvent(new CustomEvent('viagens:rerender'));
    });
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}