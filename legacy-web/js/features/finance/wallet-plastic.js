function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const SLOT_LABELS = {
    bank: { credit: 'Crédito', debit: 'Débito' },
    benefit: { food: 'Alimentação', meal: 'Refeição' }
};

function defaultSlotLabel(slot, walletMode) {
    const mode = walletMode === 'benefit' ? 'benefit' : 'bank';
    return SLOT_LABELS[mode][slot] || slot;
}

function isBankCreditSlot(slot, walletMode) {
    return walletMode !== 'benefit' && slot === 'credit';
}

export function buildWalletPlasticHtml(plastic) {
    const walletMode = plastic.walletMode === 'benefit' ? 'benefit' : 'bank';
    const slot = plastic.slot || (walletMode === 'benefit' ? 'food' : 'credit');
    const due =
        isBankCreditSlot(slot, walletMode) && plastic.dueText
            ? `<span class="wallet-plastic__due">${escapeHtml(plastic.dueText)}</span>`
            : '';
    let foot;
    if (walletMode === 'benefit') {
        foot = `<span class="wallet-plastic__amount">${escapeHtml(plastic.amountText || 'R$ 0,00')}</span>`;
    } else if (slot === 'credit') {
        foot = `<span class="wallet-plastic__amount">${escapeHtml(plastic.amountText || '')}</span>`;
    } else {
        foot = `<span class="wallet-plastic__quiet">Sem fatura</span>`;
    }
    const label = plastic.kindLabel || defaultSlotLabel(slot, walletMode);
    const customCls = plastic.useCustom ? ' wallet-plastic--custom' : '';
    const theme = !plastic.useCustom && plastic.themeClass ? ` ${plastic.themeClass}` : '';
    const styleAttr = plastic.inlineStyle ? ` style="${escapeHtml(plastic.inlineStyle)}"` : '';
    return `<button type="button" class="wallet-plastic wallet-plastic--${slot}${theme}${customCls} wallet-card-open" data-card-id="${escapeHtml(plastic.id)}"${styleAttr} aria-label="Ver lançamentos: ${escapeHtml(plastic.name)}">
        <span class="wallet-plastic__top"><span class="wallet-plastic__kind">${label}</span>${due}</span>
        <span class="wallet-plastic__name">${escapeHtml(plastic.name)}</span>
        ${foot}
    </button>`;
}

function buildWalletPlasticPlaceholderHtml(slot, bankId, opts = {}) {
    const walletMode = opts.walletMode === 'benefit' ? 'benefit' : 'bank';
    const label = defaultSlotLabel(slot, walletMode);
    const hasBank = bankId != null && String(bankId).trim() !== '';
    let linkAttr = '';
    if (hasBank) {
        if (walletMode === 'benefit') {
            linkAttr =
                slot === 'food'
                    ? ` data-wallet-link-food="${escapeHtml(String(bankId))}"`
                    : ` data-wallet-link-meal="${escapeHtml(String(bankId))}"`;
        } else {
            linkAttr =
                slot === 'credit'
                    ? ` data-wallet-link-credit="${escapeHtml(String(bankId))}"`
                    : ` data-wallet-link-debit="${escapeHtml(String(bankId))}"`;
        }
    }
    const name = hasBank ? (walletMode === 'benefit' ? 'Adicionar vale' : 'Adicionar cartão') : 'Sem conta vinculada';
    const foot = hasBank ? 'Toque para cadastrar' : 'Vincule a uma conta';
    return `<button type="button" class="wallet-plastic wallet-plastic--placeholder wallet-plastic--${slot}"${linkAttr} aria-label="${escapeHtml(label)}: ${escapeHtml(name)}">
        <span class="wallet-plastic__top"><span class="wallet-plastic__kind">${escapeHtml(label)}</span><span class="wallet-plastic__add" aria-hidden="true">+</span></span>
        <span class="wallet-plastic__name">${escapeHtml(name)}</span>
        <span class="wallet-plastic__quiet">${escapeHtml(foot)}</span>
    </button>`;
}

/**
 * Coluna de plásticos: dois slots (banco: crédito/débito; benefício: alimentação/refeição).
 * @param {{
 *   bankId?: string|null,
 *   walletMode?: 'bank'|'benefit',
 *   slot1Plastics?: object[],
 *   slot2Plastics?: object[],
 *   creditPlastics?: object[],
 *   debitPlastics?: object[],
 *   institutionColors?: object|null
 * }} opts
 */
export function buildWalletAccountCardsHtml(opts) {
    const bankId = opts?.bankId ?? null;
    const walletMode = opts?.walletMode === 'benefit' ? 'benefit' : 'bank';
    const slot1 = walletMode === 'benefit' ? 'food' : 'credit';
    const slot2 = walletMode === 'benefit' ? 'meal' : 'debit';
    const slot1Plastics = opts?.slot1Plastics ?? opts?.creditPlastics ?? [];
    const slot2Plastics = opts?.slot2Plastics ?? opts?.debitPlastics ?? [];
    const placeholderOpts = {
        walletMode,
        institutionColors: opts?.institutionColors ?? null
    };

    const slot1Html =
        slot1Plastics.length > 0
            ? slot1Plastics.map((p) => buildWalletPlasticHtml({ ...p, slot: p.slot || slot1, walletMode })).join('')
            : buildWalletPlasticPlaceholderHtml(slot1, bankId, placeholderOpts);

    const slot2Html =
        slot2Plastics.length > 0
            ? slot2Plastics.map((p) => buildWalletPlasticHtml({ ...p, slot: p.slot || slot2, walletMode })).join('')
            : buildWalletPlasticPlaceholderHtml(slot2, bankId, placeholderOpts);

    return `<div class="wallet-plastics">${slot1Html}${slot2Html}</div>`;
}

/** @deprecated Use buildWalletAccountCardsHtml */
export function buildWalletPlasticsColumnHtml(plastics, emptyBankId = null) {
    const list = plastics || [];
    const credits = list.filter((p) => p.slot === 'credit' || p.kind === 'credit');
    const debits = list.filter((p) => p.slot === 'debit' || p.kind === 'debit');
    const themeClass = list.find((p) => p.themeClass)?.themeClass || '';
    return buildWalletAccountCardsHtml({
        bankId: emptyBankId,
        themeClass,
        creditPlastics: credits,
        debitPlastics: debits,
        walletMode: 'bank'
    });
}
