function coercePrefsObject(value) {
    let raw = value;
    if (raw == null || raw === '') return {};
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            return {};
        }
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return { ...raw };
}

function trimOrUndef(v) {
    const t = String(v ?? '').trim();
    return t || undefined;
}

function normalizeDoc(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
        cpf: trimOrUndef(src.cpf),
        passportNumber: trimOrUndef(src.passportNumber ?? src.passport_number),
        passportExpiresOn: trimOrUndef(src.passportExpiresOn ?? src.passport_expires_on),
        birthDate: trimOrUndef(src.birthDate ?? src.birth_date)
    };
}

/** Documentos de viagem no `finance_preferences` do usuário (Meu Mundo). */
export function travelDocumentFromFinancePreferences(financePreferences) {
    const prefs = coercePrefsObject(financePreferences);
    return normalizeDoc(prefs.travelDocument ?? prefs.travel_document);
}

export function mergeTravelDocumentIntoFinancePreferences(existing, patch) {
    const prefs = coercePrefsObject(existing);
    const prev = normalizeDoc(prefs.travelDocument ?? prefs.travel_document);
    const next = normalizeDoc({ ...prev, ...patch });
    return { ...prefs, travelDocument: next };
}