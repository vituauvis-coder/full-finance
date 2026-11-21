import { canonicalCountryLabel, countryIso2ForLabel } from './trip-countries.js';

/** Moeda principal por país (catálogo de viagens). */
const ISO_CURRENCY = {
    BR: { code: 'BRL', name: 'Real' },
    AR: { code: 'ARS', name: 'Peso argentino' },
    CL: { code: 'CLP', name: 'Peso chileno' },
    CO: { code: 'COP', name: 'Peso colombiano' },
    PE: { code: 'PEN', name: 'Sol peruano' },
    MX: { code: 'MXN', name: 'Peso mexicano' },
    US: { code: 'USD', name: 'Dólar americano' },
    CA: { code: 'CAD', name: 'Dólar canadense' },
    PT: { code: 'EUR', name: 'Euro' },
    ES: { code: 'EUR', name: 'Euro' },
    FR: { code: 'EUR', name: 'Euro' },
    IT: { code: 'EUR', name: 'Euro' },
    DE: { code: 'EUR', name: 'Euro' },
    NL: { code: 'EUR', name: 'Euro' },
    GB: { code: 'GBP', name: 'Libra esterlina' },
    CH: { code: 'CHF', name: 'Franco suíço' },
    TR: { code: 'TRY', name: 'Lira turca' },
    AE: { code: 'AED', name: 'Dirham' },
    QA: { code: 'QAR', name: 'Rial catarense' },
    JP: { code: 'JPY', name: 'Iene' },
    CN: { code: 'CNY', name: 'Yuan chinês' },
    KR: { code: 'KRW', name: 'Won' },
    TH: { code: 'THB', name: 'Baht' },
    SG: { code: 'SGD', name: 'Dólar' },
    HK: { code: 'HKD', name: 'Dólar' },
    IN: { code: 'INR', name: 'Rupia' },
    MA: { code: 'MAD', name: 'Dirham' },
    ZA: { code: 'ZAR', name: 'Rand' },
    AU: { code: 'AUD', name: 'Dólar australiano' },
    NZ: { code: 'NZD', name: 'Dólar neozelandês' }
};

/** Referência para viajantes com passaporte brasileiro — conferir sempre em fontes oficiais. */
const BR_TRAVEL_BRIEF = {
    BR: {
        entryDoc: 'RG, CNH ou passaporte com foto',
        visaBr: 'Voo doméstico — sem visto',
        emergency: '190 (PM) · 192 (SAMU)',
        plug: 'Tomada N · 127/220 V',
        highlights: ['Documento com foto para check-in', 'CPF em reservas e locadoras']
    },
    US: {
        entryDoc: 'Passaporte válido',
        visaBr: 'ESTA aprovado antes do embarque (turismo até 90 dias)',
        emergency: '911',
        plug: 'Tomadas A/B · 120 V',
        paymentMethods: 'Cartão de crédito/débito quase universal; gorjeta 15–20%',
        internetChip: 'eSIM (Airalo, Holafly) ou chip pré-pago T-Mobile/AT&T no aeroporto',
        highlights: [
            'Passaporte com 6+ meses além da estadia',
            'CBP pode pedir volta, hotel e recursos financeiros',
            'Seguro saúde fortemente recomendado (custo alto)'
        ]
    },
    AR: {
        entryDoc: 'RG (Brasil) ou passaporte — Mercosul',
        visaBr: 'Isenção para brasileiros (turismo)',
        emergency: '911 / 107',
        plug: 'Tomadas C/I · 220 V',
        highlights: ['Menores: autorização de viagem se sem pais', 'Leve comprovante de volta']
    },
    CL: {
        entryDoc: 'RG ou passaporte',
        visaBr: 'Isenção para brasileiros',
        emergency: '131 (Carabineros)',
        plug: 'Tomadas C/L · 220 V',
        highlights: ['Validade de documento cobre toda a estadia']
    },
    PT: {
        entryDoc: 'Passaporte ou RG brasileiro válido',
        visaBr: 'Isenção Schengen (até 90 dias em 180)',
        emergency: '112',
        plug: 'Tomadas C/F · 230 V',
        highlights: [
            'Seguro viagem Schengen (≥ €30 mil) costuma ser exigido na imigração',
            'Passaporte válido 3 meses após saída do bloco'
        ]
    },
    ES: {
        entryDoc: 'Passaporte biométrico',
        visaBr: 'Isenção Schengen (até 90 dias em 180)',
        emergency: '112',
        plug: 'Tomadas C/F · 230 V',
        paymentMethods: 'Cartão (Visa/Master) amplo; contactless comum; dinheiro em feiras',
        internetChip: 'Roaming UE ou eSIM europeu; chips pré-pagos (Movistar, Orange)',
        highlights: ['ETIAS (pré-autorização UE) em implementação — verifique antes', 'Comprovante de hospedagem']
    },
    FR: {
        entryDoc: 'Passaporte biométrico',
        visaBr: 'Isenção Schengen (até 90 dias em 180)',
        emergency: '112',
        plug: 'Tomadas C/E · 230 V',
        highlights: ['Seguro médico Schengen exigido na fronteira', 'Reserva de volta ou continuação']
    },
    IT: {
        entryDoc: 'Passaporte biométrico',
        visaBr: 'Isenção Schengen (até 90 dias em 180)',
        emergency: '112',
        plug: 'Tomadas C/F/L · 230 V',
        highlights: ['Cidades turísticas: cuidado com golpes e horários de museus']
    },
    GB: {
        entryDoc: 'Passaporte biométrico',
        visaBr: 'Turismo: geralmente visto não necessário (até 6 meses) — confirme no gov.uk',
        emergency: '999',
        plug: 'Tomadas G · 230 V',
        highlights: ['Fila de imigração: prazo de passaporte além da estadia']
    },
    JP: {
        entryDoc: 'Passaporte biométrico',
        visaBr: 'Isenção para brasileiros (turismo até 90 dias)',
        emergency: '110 (PM) · 119 (ambulância)',
        plug: 'Tomadas A/B · 100 V',
        highlights: ['Visit Japan Web (imigração/customs) agiliza entrada', 'Dinheiro ainda útil fora dos grandes centros']
    },
    CN: {
        entryDoc: 'Passaporte válido (6+ meses recomendado)',
        visaBr: 'Visto de turismo obrigatório para brasileiros — solicite no consulado',
        emergency: '110 (PM) · 120 (ambulância)',
        plug: 'Tomadas A/C/I · 220 V',
        paymentMethods: 'Alipay, WeChat Pay, cartão internacional; levar yuan em espécie ajuda',
        internetChip: 'eSIM global ou chip local (China Mobile/Unicom); VPN pode ser necessária',
        highlights: [
            'Alipay/WeChat Pay dominam — prepare cartão internacional ou yuan em espécie',
            'VPN e apps chineses podem exigir preparação antes da viagem'
        ]
    },
    MX: {
        entryDoc: 'Passaporte',
        visaBr: 'Isenção para brasileiros com passaporte válido',
        emergency: '911',
        plug: 'Tomadas A/B · 127 V',
        highlights: ['Formulário de migração (FMM) ou comprovante digital']
    },
    AE: {
        entryDoc: 'Passaporte (6+ meses)',
        visaBr: 'Visto na chegada ou e-visa conforme emirado',
        emergency: '999',
        plug: 'Tomadas G · 230 V',
        highlights: ['Regras de vestimenta e álcool variam por emirado']
    },
    AU: {
        entryDoc: 'Passaporte biométrico',
        visaBr: 'eVisitor (subclasse 651) obrigatório — online',
        emergency: '000',
        plug: 'Tomadas I · 230 V',
        highlights: ['Declaração de produtos alimentícios e biomateriais na alfândega']
    }
};

const DEFAULT_OBLIGATIONS = {
    BR: ['Documento com foto (RG ou CNH).', 'CPF quando solicitado em reservas nacionais.'],
    US: ['ESTA aprovado.', 'Passaporte 6+ meses além da estadia.'],
    PT: ['Seguro Schengen recomendado.', 'Passaporte ou RG válido.'],
    ES: ['Passaporte 3 meses após volta.', 'Seguro e reserva de hospedagem podem ser cobrados.'],
    FR: ['Seguro viagem Schengen.', 'Comprovante de meios de subsistência.'],
    JP: ['Visit Japan Web (quando disponível).', 'Passaporte válido.']
};

export function localCurrencyForCountryLabel(label) {
    const iso = countryIso2ForLabel(label);
    if (!iso) return { code: null, name: 'Moeda local', iso2: null };
    const row = ISO_CURRENCY[iso];
    if (!row) return { code: null, name: 'Moeda local', iso2: iso };
    return { ...row, iso2: iso };
}

export function defaultObligationsForCountry(label) {
    const iso = countryIso2ForLabel(label);
    if (iso && DEFAULT_OBLIGATIONS[iso]) return [...DEFAULT_OBLIGATIONS[iso]];
    const name = canonicalCountryLabel(label);
    if (!name || name === 'Brasil') return DEFAULT_OBLIGATIONS.BR ?? [];
    return [
        'Passaporte válido para entrada.',
        'Confirme visto e vacinas em Itamaraty / consulado antes do embarque.'
    ];
}

const DEFAULT_PAYMENT =
    'Cartão internacional (Visa/Master) e dinheiro local; confirme taxas do banco';

const DEFAULT_INTERNET = 'eSIM internacional (Airalo, Holafly) ou chip local no aeroporto';

export function countryTravelBrief(label) {
    const country = canonicalCountryLabel(label);
    const iso = countryIso2ForLabel(country);
    const currency = localCurrencyForCountryLabel(country);
    const brief = (iso && BR_TRAVEL_BRIEF[iso]) || {
        entryDoc: 'Passaporte válido',
        visaBr: 'Consulte vistos para brasileiros (Portal Consular / Itamaraty)',
        emergency: 'Número local de emergência',
        plug: 'Verifique tipo de tomada e voltagem',
        highlights: defaultObligationsForCountry(country)
    };
    const requiredDocs = [brief.entryDoc, brief.visaBr].filter(Boolean).join(' · ');
    return {
        country,
        iso2: iso,
        currency,
        currencyLabel: currency.code
            ? `${currency.name} (${currency.code})`
            : currency.name,
        requiredDocs,
        paymentMethods: brief.paymentMethods ?? DEFAULT_PAYMENT,
        internetChip: brief.internetChip ?? DEFAULT_INTERNET,
        entryDoc: brief.entryDoc,
        visaBr: brief.visaBr,
        emergency: brief.emergency,
        plug: brief.plug,
        highlights: brief.highlights ?? defaultObligationsForCountry(country)
    };
}

/** Texto padrão do valor em real (1 unidade da moeda). `formatBrl` recebe formatter pt-BR. */
export function defaultBrlEquivalentLine(currencyCode, quotes, formatBrl) {
    if (!currencyCode || currencyCode === 'BRL') return 'Sem conversão (Real)';
    const rate = quotes?.[currencyCode];
    if (!rate || rate <= 0) return 'Cotação indisponível — atualize ao abrir o painel';
    const perHundred = (100 / rate).toFixed(2);
    return `1 ${currencyCode} = ${formatBrl(rate)} · R$ 100 ≈ ${perHundred} ${currencyCode}`;
}

/** Converte texto pt-BR (1.234,56) ou en (1234.56) para número. */
export function parseTripMoneyAmount(raw) {
    if (raw == null) return null;
    const s = String(raw).trim().replace(/\s/g, '');
    if (!s) return null;
    const hasComma = s.includes(',');
    const normalized = hasComma ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = Number(normalized);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

/** `quotes[code]` = quantos BRL por 1 unidade da moeda (par XXX-BRL). */
export function convertLocalAmountToBrl(localAmount, currencyCode, quotes) {
    const amount = typeof localAmount === 'number' ? localAmount : parseTripMoneyAmount(localAmount);
    if (amount == null) return null;
    if (!currencyCode || currencyCode === 'BRL') return amount;
    const rate = quotes?.[currencyCode];
    if (!rate || rate <= 0) return null;
    return amount * rate;
}

/** Cotação unitária `1 XXX = R$ …` para exibir na ficha. */
export function formatFxUnitRate(currencyCode, quotes, formatBrl) {
    if (!currencyCode || currencyCode === 'BRL') return 'Moeda: Real (BRL)';
    const rate = quotes?.[currencyCode];
    if (!rate || rate <= 0) return null;
    return `1 ${currencyCode} = ${formatBrl(rate)}`;
}

/** Converte BRL para moeda local (`quotes` = BRL por 1 unidade estrangeira). */
export function brlToForeignAmount(brl, currencyCode, quotes) {
    const amount = typeof brl === 'number' ? brl : parseTripMoneyAmount(brl);
    if (amount == null || amount <= 0) return null;
    if (!currencyCode || currencyCode === 'BRL') {
        return { amount, code: 'BRL' };
    }
    const rate = quotes?.[currencyCode];
    if (!rate || rate <= 0) return null;
    return { amount: Math.round((amount / rate) * 100) / 100, code: currencyCode };
}

export function formatForeignMoney(amount, currencyCode) {
    const code = String(currencyCode ?? 'BRL').toUpperCase();
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    try {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: code,
            maximumFractionDigits: code === 'JPY' || code === 'KRW' ? 0 : 2
        }).format(n);
    } catch {
        return `${n.toFixed(2)} ${code}`;
    }
}