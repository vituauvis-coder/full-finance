/** Datas de movimentação — extraído de legacy-web/js/core/utils.js para o motor. */
export function movementDateToJsDate(dateField) {
    if (dateField == null) return new Date(NaN);
    if (dateField instanceof Date) return dateField;
    if (typeof dateField === 'object' && dateField.seconds != null) {
        return new Date(Number(dateField.seconds) * 1000);
    }
    if (typeof dateField === 'string' || typeof dateField === 'number') {
        const d = new Date(dateField);
        return d;
    }
    return new Date(NaN);
}

export function movementDateToUnixSeconds(dateField) {
    return Math.floor(movementDateToJsDate(dateField).getTime() / 1000);
}