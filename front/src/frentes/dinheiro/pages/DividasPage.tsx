import { type FormEvent, useMemo, useState } from 'react';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { movementDate } from '../../../lib/period';
import { apiFetch } from '../../../lib/http';
import { ModalShell } from '../../../components/finance/ModalShell';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

type Debt = { id: string; company?: string; initialAmount?: number; isClosed?: boolean };
type DebtUpdate = { debtId?: string; amount?: number; date?: string | { seconds?: number }; description?: string };

export function DividasPage() {
    const { data, loading, error, refresh } = useFinanceData();
    const currency = data?.userProfile?.currency ?? 'BRL';
    const [modalOpen, setModalOpen] = useState(false);
    const [company, setCompany] = useState('');
    const [initialAmount, setInitialAmount] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const updatesByDebt = useMemo(() => {
        const map = new Map<string, DebtUpdate[]>();
        if (!data) return map;
        for (const u of data.userDebtUpdates as DebtUpdate[]) {
            const id = String(u.debtId ?? '');
            if (!id) continue;
            if (!map.has(id)) map.set(id, []);
            map.get(id)!.push(u);
        }
        return map;
    }, [data]);

    async function createDebt(e: FormEvent) {
        e.preventDefault();
        const name = company.trim();
        const amt = parseFloat(initialAmount);
        if (!name) {
            setFormError('Informe o credor.');
            return;
        }
        if (!Number.isFinite(amt) || amt <= 0) {
            setFormError('Valor inicial inválido.');
            return;
        }
        setFormError(null);
        await apiFetch('/api/debts', { method: 'POST', body: JSON.stringify({ company: name, initialAmount: amt }) });
        setCompany('');
        setInitialAmount('');
        setModalOpen(false);
        await refresh();
    }

    if (loading) {
        return (
            <section className="page active">
                <ScreenLoader label="Carregando dívidas" />
            </section>
        );
    }

    if (error || !data) {
        return (
            <section className="page active">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    const debts = (data.userDebts ?? []) as Debt[];

    return (
        <section id="debts-page" className="page active" aria-label="Dívidas">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Dívidas</h2>
                <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                    Nova dívida
                </button>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Credor</th>
                            <th scope="col">Valor inicial</th>
                            <th scope="col">Status</th>
                            <th scope="col">Atualizações</th>
                            <th scope="col">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {debts.length === 0 ? (
                            <tr>
                                    <td colSpan={5}>Nenhuma dívida cadastrada.</td>
                            </tr>
                        ) : (
                            debts.map((d) => {
                                const ups = updatesByDebt.get(d.id) ?? [];
                                const last = ups
                                    .slice()
                                    .sort(
                                        (a, b) =>
                                            movementDate({ date: a.date }).getTime() -
                                            movementDate({ date: b.date }).getTime()
                                    )[0];
                                return (
                                    <tr key={d.id}>
                                        <td>{d.company || '—'}</td>
                                        <td>{formatBRL(Number(d.initialAmount) || 0, currency)}</td>
                                        <td>{d.isClosed ? 'Encerrada' : 'Ativa'}</td>
                                        <td>
                                            {ups.length} registro(s)
                                            {last ? ` · último ${movementDate({ date: last.date }).toLocaleDateString('pt-BR')}` : ''}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-secondary btn-small"
                                                onClick={async () => {
                                                    const amt = window.prompt('Valor da atualização');
                                                    if (!amt) return;
                                                    const amount = parseFloat(amt);
                                                    if (!Number.isFinite(amount)) return;
                                                    await apiFetch('/api/debt-updates', {
                                                        method: 'POST',
                                                        body: JSON.stringify({
                                                            debtId: d.id,
                                                            amount,
                                                            date: new Date().toISOString().slice(0, 10),
                                                            description: 'Atualização'
                                                        })
                                                    });
                                                    await refresh();
                                                }}
                                            >
                                                + Atualização
                                            </button>{' '}
                                            {!d.isClosed ? (
                                                <button
                                                    type="button"
                                                    className="btn-secondary btn-small"
                                                    onClick={async () => {
                                                        if (!window.confirm('Encerrar esta dívida?')) return;
                                                        await apiFetch(`/api/debts/${encodeURIComponent(d.id)}`, {
                                                            method: 'PUT',
                                                            body: JSON.stringify({ isClosed: true })
                                                        });
                                                        await refresh();
                                                    }}
                                                >
                                                    Encerrar
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <ModalShell open={modalOpen} title="Nova dívida" onClose={() => setModalOpen(false)} id="debt-modal">
                <form onSubmit={(e) => void createDebt(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {formError ? <p role="alert">{formError}</p> : null}
                    <motionField label="Credor" id="debt-company" value={company} onChange={setCompany} />
                    <motionField label="Valor inicial" id="debt-initial" type="number" value={initialAmount} onChange={setInitialAmount} />
                    <footer className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary">
                            Salvar
                        </button>
                    </footer>
                </form>
            </ModalShell>
        </section>
    );
}

function motionField({
    label,
    id,
    value,
    onChange,
    type = 'text'
}: {
    label: string;
    id: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
}) {
    return (
        <div className="form-group">
            <label htmlFor={id}>{label}</label>
            <input id={id} type={type} step={type === 'number' ? '0.01' : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}