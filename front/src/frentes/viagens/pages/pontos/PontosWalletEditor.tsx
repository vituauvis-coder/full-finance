import { useState, type FormEvent } from 'react';
import { MILES_PROGRAM_PRESETS, WALLET_UNITS, defaultUnitForBrand } from '@motor/milhas/catalog.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { Chip, ChipRow, PtsField, TextField } from './PontosFields';
import type { MilesProgram } from './pontos-format';

export type WalletDraft = {
    name: string;
    brand: string;
    unit: string;
    issuer: string;
    notes: string;
    expiresOn: string;
    balance?: number;
};

type Props = {
    title: string;
    initial?: Partial<MilesProgram>;
    showBalance?: boolean;
    balance?: number;
    busy?: boolean;
    onClose: () => void;
    onSave: (draft: WalletDraft) => void;
};

export function PontosWalletEditor({ title, initial, showBalance, balance = 0, busy, onClose, onSave }: Props) {
    const [name, setName] = useState(initial?.name ?? '');
    const [brand, setBrand] = useState(initial?.brand ?? 'outro');
    const [unit, setUnit] = useState(initial?.unit ?? 'pontos');
    const [issuer, setIssuer] = useState(initial?.issuer ?? '');
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [expiresOn, setExpiresOn] = useState((initial?.expiresOn ?? '').slice(0, 10));
    const [saldo, setSaldo] = useState(balance);

    function applyPreset(presetBrand: string) {
        const meta = MILES_PROGRAM_PRESETS.find((p) => p.brand === presetBrand);
        if (!meta) return;
        setBrand(presetBrand);
        setName(meta.name);
        setIssuer(meta.issuer);
        setUnit(defaultUnitForBrand(presetBrand));
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            brand,
            unit,
            issuer: issuer.trim(),
            notes: notes.trim(),
            expiresOn,
            balance: showBalance ? saldo : undefined
        });
    }

    return (
        <div className="voos-overlay" role="presentation" onClick={onClose}>
            <form
                className="voos-editor pontos-editor"
                onClick={(e) => e.stopPropagation()}
                onSubmit={submit}
            >
                <div className="voos-editor__head">
                    <div className="voos-editor__identity">
                        <p className="pontos-kicker">Carteira</p>
                        <h3>{title}</h3>
                    </div>
                    <button type="button" className="voos-icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={20} />
                    </button>
                </div>
                <span className="pontos-kicker">Atalho de programa</span>
                <ChipRow>
                    {MILES_PROGRAM_PRESETS.filter((p) => p.brand !== 'outro').map((p) => (
                        <Chip key={p.brand} on={brand === p.brand} onClick={() => applyPreset(p.brand)}>
                            {p.name}
                        </Chip>
                    ))}
                    <Chip
                        on={brand === 'outro'}
                        onClick={() => {
                            setBrand('outro');
                        }}
                    >
                        Personalizada
                    </Chip>
                </ChipRow>
                <TextField label="Nome da carteira" value={name} onChange={setName} placeholder="Esfera, Iberia Club…" />
                <div>
                    <span className="pontos-kicker">Moeda</span>
                    <ChipRow>
                        {WALLET_UNITS.map((u) => (
                            <Chip key={u.id} on={unit === u.id} onClick={() => setUnit(u.id)}>
                                {u.label}
                            </Chip>
                        ))}
                    </ChipRow>
                </div>
                <div className="pontos-form-grid">
                    <TextField label="Emissor / banco" value={issuer} onChange={setIssuer} placeholder="Santander, Iberia…" />
                    <label className="voos-field">
                        <span>Validade (opcional)</span>
                        <input
                            className="viagens-field pontos-input"
                            type="date"
                            value={expiresOn}
                            onChange={(e) => setExpiresOn(e.target.value)}
                        />
                    </label>
                </div>
                <TextField label="Notas" value={notes} onChange={setNotes} placeholder="Clube, cartão, vencimento de pontos…" />
                {showBalance ? <PtsField label="Saldo" value={saldo} onChange={setSaldo} /> : null}
                <div className="voos-editor__foot">
                    <button type="button" className="viagens-btn viagens-btn--ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="pontos-btn-primary" disabled={busy || !name.trim()}>
                        {busy ? 'Salvando…' : 'Salvar carteira'}
                    </button>
                </div>
            </form>
        </div>
    );
}
