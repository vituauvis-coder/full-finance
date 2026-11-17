/**
 * Equivalente React de `runWithButtonLoading` — controla um flag `busy` em torno de uma Promise.
 */
export async function runWithBusyAction<T>(setBusy: (value: boolean) => void, action: () => Promise<T>): Promise<T> {
    setBusy(true);
    try {
        return await action();
    } finally {
        setBusy(false);
    }
}