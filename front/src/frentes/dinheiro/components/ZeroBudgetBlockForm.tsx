import { type FormEvent, useState } from 'react';
import { apiFetch } from '../../../lib/http';

type Props = {
    month: number;
    year: number;
    onCreated: () => void | Promise<void>;
};

export function ZeroBudgetBlockForm({ month, year, onCreated }: Props) {
    const [categoryName, setCategoryName] = useState('');
    const [allocatedAmount, setAllocatedAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const name = categoryName.trim();
        const amount = parseFloat(allocatedAmount);
        if (!name) {
            setError('Informe a categoria do bloco.');
            return;
        }
        if (!Number.isFinite(amount) || amount < 0) {
            setError('Valor alocado inválido.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await apiFetch('/api/zero-budget/blocks', {
                method: 'POST',
                body: JSON.stringify({ categoryName: name, allocatedAmount: amount, month, year })
            });
            setCategoryName('');
            setAllocatedAmount('');
            await onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao criar bloco');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="zero-budget-block-form" onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {error ? <p role="alert">{error}</p> : null}
            <input type="text" placeholder="Categoria do bloco" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            <input type="number" step="0.01" placeholder="Valor alocado" value={allocatedAmount} onChange={(e) => setAllocatedAmount(e.target.value)} />
            <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Criando…' : 'Novo bloco'}
            </button>
        </form>
    );
}