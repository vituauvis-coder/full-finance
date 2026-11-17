import { type FormEvent, useMemo, useState } from 'react';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { apiFetch } from '../../../lib/http';
import { ModalShell } from '../../../components/finance/ModalShell';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

type Bucket = { id?: string; name?: string; balance?: number; colorKey?: string };
type Application = { id?: string; bucketId?: string; amount?: number; date?: string; description?: string };
type Goal = { id?: string; bucketId?: string; name?: string; targetAmount?: number };

export function CofrinhosPage() {
    const { data, loading, error, refresh } = useFinanceData();
    const [modalOpen, setModalOpen] = useState(false);
    const [bucketName, setBucketName] = useState('');
    const currency = data?.userProfile?.currency ?? 'BRL';

    const totalBalance = useMemo(() => {
        const buckets = (data?.cofrinhoBuckets ?? []) as Bucket[];
        return buckets.reduce((s, b) => s + (Number(b.balance) || 0), 0);
    }, [data]);

    const appsByBucket = useMemo(() => {
        const map = new Map<string, Application[]>();
        for (const a of (data?.cofrinhoApplications ?? []) as Application[]) {
            const id = String(a.bucketId ?? '');
            if (!id) continue;
            if (!map.has(id)) map.set(id, []);
            map.get(id)!.push(a);
        }
        return map;
    }, [data]);

    if (loading) {
        return (
            <section className="page active cofrinhos-page">
                <ScreenLoader label="Carregando cofrinhos" />
            </section>
        );
    }

    if (error || !data) {
        return (
            <section className="page active cofrinhos-page">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    const buckets = (data.cofrinhoBuckets ?? []) as Bucket[];
    const goals = (data.cofrinhoBucketGoals ?? []) as Goal[];

    return (
        <section id="cofrinhos-page" className="page active cofrinhos-page" aria-label="Cofrinhos">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                    Nova caixinha
                </button>
            </div>
            <div className="summary-cards movements-summary cofrinhos-page__summary">
                <article className="summary-card summary-card--balance">
                    <h3 className="summary-card__title">Total alocado</h3>
                    <p className="summary-card__value">{formatBRL(totalBalance, currency)}</p>
                </article>
                <article className="summary-card summary-card--projection">
                    <h3 className="summary-card__title">Caixinhas</h3>
                    <p className="summary-card__value">{buckets.length}</p>
                </article>
                <article className="summary-card summary-card--income">
                    <h3 className="summary-card__title">Metas</h3>
                    <p className="summary-card__value">{goals.length}</p>
                </article>
            </div>
            <section className="cofrinhos-page__section" aria-label="Caixinhas">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Nome</th>
                                <th scope="col">Saldo</th>
                                <th scope="col">Aplicações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {buckets.length === 0 ? (
                                <tr>
                                    <td colSpan={3}>Nenhum cofrinho.</td>
                                </tr>
                            ) : (
                                buckets.map((b, i) => {
                                    const apps = b.id ? appsByBucket.get(b.id) ?? [] : [];
                                    return (
                                        <tr key={b.id ?? i}>
                                            <td>{b.name ?? 'Cofrinho'}</td>
                                            <td>{formatBRL(Number(b.balance) || 0, currency)}</td>
                                            <td>
                                                {apps.length === 0
                                                    ? '—'
                                                    : apps
                                                          .slice(0, 3)
                                                          .map((a) => a.description || formatBRL(Number(a.amount) || 0, currency))
                                                          .join(' · ')}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            {goals.length > 0 ? (
                <section className="cofrinhos-page__section" aria-label="Metas">
                    <h3>Metas</h3>
                    <ul>
                        {goals.map((g, i) => (
                            <li key={g.id ?? i}>
                                {g.name ?? 'Meta'} — meta {formatBRL(Number(g.targetAmount) || 0, currency)}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
            <ModalShell id="cofrinho-bucket-modal" open={modalOpen} title="Nova caixinha" onClose={() => setModalOpen(false)}>
                <form
                    onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        void (async () => {
                            const name = bucketName.trim();
                            if (!name) return;
                            await apiFetch('/api/cofrinho-buckets', { method: 'POST', body: JSON.stringify({ name }) });
                            setBucketName('');
                            setModalOpen(false);
                            await refresh();
                        })();
                    }}
                >
                    <label>
                        Nome
                        <input value={bucketName} onChange={(e) => setBucketName(e.target.value)} required />
                    </label>
                    <footer className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary">
                            Criar
                        </button>
                    </footer>
                </form>
            </ModalShell>
        </section>
    );
}