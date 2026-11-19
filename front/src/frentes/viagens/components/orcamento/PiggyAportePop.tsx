import { useState } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';

type Props = {
    onClose: () => void;
    onSave: (amount: number, recordedOn: string) => void;
};

export function PiggyAportePop({ onClose, onSave }: Props) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

    return (
        <div className="orc-pop-overlay" role="presentation" onClick={onClose}>
            <div
                className="orc-pop"
                role="dialog"
                aria-labelledby="orc-aporte-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="orc-pop__head">
                    <h2 id="orc-aporte-title">Novo aporte</h2>
                    <button type="button" className="orc-pop__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={18} />
                    </button>
                </header>
                <label className="orc-pop__field">
                    <span>Valor (R$)</span>
                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="viagens-field"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        autoFocus
                    />
                </label>
                <label className="orc-pop__field">
                    <span>Data</span>
                    <input type="date" className="viagens-field" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <footer className="orc-pop__foot">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="viagens-btn viagens-btn--coral"
                        onClick={() => {
                            const v = Number(amount) || 0;
                            if (v <= 0) return;
                            onSave(v, date);
                            onClose();
                        }}
                    >
                        Registrar
                    </button>
                </footer>
            </div>
        </div>
    );
}