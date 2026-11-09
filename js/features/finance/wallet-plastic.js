function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildWalletPlasticHtml(plastic) {
    const kind = plastic.kind === 'debit' ? 'debit' : 'credit';
    const theme = plastic.themeClass ? ` ${plastic.themeClass}` : '';
    const due =
        kind === 'credit' && plastic.dueText
            ? `<span class="wallet-plastic__due">${escapeHtml(plastic.dueText)}</span>`
            : '';
    const foot =
        kind === 'credit'
            ? `<span class="wallet-plastic__amount">${escapeHtml(plastic.amountText || '')}</span>`
            : `<span class="wallet-plastic__quiet">Sem fatura</span>`;
    const label = kind === 'credit' ? 'Crédito' : 'Débito';
    return `<button type="button" class="wallet-plastic wallet-plastic--${kind}${theme} wallet-card-open" data-card-id="${escapeHtml(plastic.id)}" aria-label="Ver lançamentos: ${escapeHtml(plastic.name)}">
        <span class="wallet-plastic__top"><span class="wallet-plastic__kind">${label}</span>${due}</span>
        <span class="wallet-plastic__name">${escapeHtml(plastic.name)}</span>
        ${foot}
    </button>`;
}

export function buildWalletPlasticsColumnHtml(plastics, emptyBankId = null) {
    if (!plastics || plastics.length === 0) {
        const link =
            emptyBankId != null && String(emptyBankId).trim() !== ''
                ? `<button type="button" class="wallet-link-add-card" data-wallet-link-credit="${escapeHtml(String(emptyBankId))}">Adicionar cartão de crédito</button>`
                : '';
        return `<div class="wallet-institution-row__empty"><i class="fas fa-lock" aria-hidden="true"></i> Sem cartão de crédito atrelado${link}</div>`;
    }
    return `<div class="wallet-plastics">${plastics.map((p) => buildWalletPlasticHtml(p)).join('')}</div>`;
}
