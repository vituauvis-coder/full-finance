import { useEffect, useState, type ReactNode } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { formatBRL } from '../../utils/map-utils';
import { unitLabel } from '@motor/milhas/catalog.js';
import {
    BONUS_PRESETS,
    RATIO_PRESETS,
    formatDecimal,
    formatPts,
    parseDecimal,
    type MilesProgram
} from './pontos-format';
import { programMilheiro, saldoEmReais } from '../../domain/milhas-cmp';

export function PontosAlert({ children }: { children: ReactNode }) {
    if (!children) return null;
    return (
        <p role="alert" className="pontos-alert">
            {children}
        </p>
    );
}

export function PtsField({
    label,
    value,
    onChange,
    placeholder = '0',
    hint
}: {
    label?: string;
    value: number;
    onChange: (n: number) => void;
    placeholder?: string;
    hint?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value ? formatPts(value) : '');
    useEffect(() => {
        if (!editing) setText(value ? formatPts(value) : '');
    }, [value, editing]);
    return (
        <label className="voos-field">
            {label ? <span>{label}</span> : null}
            <input
                className="viagens-field pontos-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder={placeholder}
                value={editing ? text : value ? formatPts(value) : ''}
                onFocus={() => {
                    setEditing(true);
                    setText(value ? String(value) : '');
                }}
                onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setText(raw);
                    onChange(raw ? Number(raw) : 0);
                }}
                onBlur={() => setEditing(false)}
            />
            {hint ? <em className="pontos-hint">{hint}</em> : null}
        </label>
    );
}

export function DecimalField({
    label,
    value,
    onChange,
    placeholder = '0',
    suffix
}: {
    label?: string;
    value: number;
    onChange: (n: number) => void;
    placeholder?: string;
    suffix?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value ? formatDecimal(value) : '');
    useEffect(() => {
        if (!editing) setText(value ? formatDecimal(value) : '');
    }, [value, editing]);
    return (
        <label className="voos-field">
            {label ? <span>{label}</span> : null}
            <span className={suffix ? 'pontos-input-wrap' : undefined}>
                <input
                    className="viagens-field pontos-input"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={placeholder}
                    value={editing ? text : value ? formatDecimal(value) : ''}
                    onFocus={() => {
                        setEditing(true);
                        setText(value ? String(value).replace('.', ',') : '');
                    }}
                    onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d,.\-]/g, '');
                        setText(raw);
                        onChange(parseDecimal(raw));
                    }}
                    onBlur={() => setEditing(false)}
                />
                {suffix ? <i>{suffix}</i> : null}
            </span>
        </label>
    );
}

export function TextField({
    label,
    value,
    onChange,
    placeholder
}: {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="voos-field">
            {label ? <span>{label}</span> : null}
            <input
                className="viagens-field pontos-input"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    );
}

export function SelectField({
    label,
    value,
    onChange,
    children
}: {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    children: ReactNode;
}) {
    return (
        <label className="voos-field">
            {label ? <span>{label}</span> : null}
            <select className="viagens-field pontos-input" value={value} onChange={(e) => onChange(e.target.value)}>
                {children}
            </select>
        </label>
    );
}

export function ChipRow({ children }: { children: ReactNode }) {
    return <div className="pontos-chips">{children}</div>;
}

export function Chip({
    on,
    onClick,
    children
}: {
    on?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button type="button" className={`pontos-chip${on ? ' is-on' : ''}`} onClick={onClick}>
            {children}
        </button>
    );
}

export function RatioBar({
    from,
    to,
    onChange,
    fromUnit = 'pontos',
    toUnit = 'pontos',
    hint
}: {
    from: number;
    to: number;
    onChange: (from: number, to: number) => void;
    fromUnit?: string;
    toUnit?: string;
    hint?: string;
}) {
    const a = Math.max(1, from || 1);
    const b = Math.max(1, to || 1);
    return (
        <div className="pontos-ratio-box">
            <span className="pontos-kicker">Como vale nesta rota</span>
            <ChipRow>
                {RATIO_PRESETS.map(([x, y]) => (
                    <Chip key={`${x}:${y}`} on={x === a && y === b} onClick={() => onChange(x, y)}>
                        {x === 5 && y === 2 ? '2,5 : 1' : `${x} : ${y}`}
                    </Chip>
                ))}
            </ChipRow>
            <div className="pontos-ratio-custom">
                <PtsField
                    label={`A cada (${unitLabel(fromUnit, a)})`}
                    value={a}
                    onChange={(n) => onChange(Math.max(1, n || 1), b)}
                />
                <span className="pontos-ratio-colon" aria-hidden>
                    :
                </span>
                <PtsField
                    label={`Recebe (${unitLabel(toUnit, b)})`}
                    value={b}
                    onChange={(n) => onChange(a, Math.max(1, n || 1))}
                />
            </div>
            <p className="pontos-hint">
                {hint ||
                    `A cada ${a} ${unitLabel(fromUnit, a)} na origem, entram ${b} ${unitLabel(toUnit, b)} no destino — antes do bônus.`}
            </p>
        </div>
    );
}

export function BonusBar({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    const n = Math.max(0, value || 0);
    return (
        <div className="pontos-ratio-box">
            <span className="pontos-kicker">Bônus no destino</span>
            <ChipRow>
                {BONUS_PRESETS.map((p) => (
                    <Chip key={p} on={p === n} onClick={() => onChange(p)}>
                        {p === 0 ? 'Sem bônus' : `${p}%`}
                    </Chip>
                ))}
            </ChipRow>
            <DecimalField label="Percentual" value={n} onChange={(v) => onChange(Math.max(0, v))} suffix="%" />
        </div>
    );
}

export function Segmented({
    value,
    onChange,
    options
}: {
    value: string;
    onChange: (v: string) => void;
    options: Array<[string, string]>;
}) {
    return (
        <div className="pontos-seg" role="tablist">
            {options.map(([id, label]) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={value === id}
                    className={value === id ? 'is-on' : ''}
                    onClick={() => onChange(id)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

export function ProgramStrip({
    programs,
    selectedId,
    onSelect,
    variant = 'default'
}: {
    programs: MilesProgram[];
    selectedId?: string;
    onSelect?: (id: string) => void;
    variant?: 'default' | 'strip';
}) {
    if (programs.length === 0) {
        return <p className="voos-muted">Nenhum programa ainda.</p>;
    }
    const wrapCls = variant === 'strip' ? 'pontos-wallets pontos-wallets--strip' : 'pontos-wallets';
    return (
        <div className={wrapCls}>
            {programs.map((p) => {
                const on = selectedId === p.id;
                const cmp = programMilheiro(p);
                const saldoBrl = saldoEmReais(p);
                const meta =
                    variant === 'strip'
                        ? [
                              p.householdId ? 'Casa' : null,
                              cmp != null ? `CMP ${formatBRL(cmp)}` : null,
                              saldoBrl != null ? formatBRL(saldoBrl) : null
                          ].filter(Boolean)
                        : [
                              p.householdId ? 'Casa' : null,
                              p.holderUserName ? `Titular: ${p.holderUserName}` : null,
                              p.issuer || null,
                              cmp != null ? `CMP ${formatBRL(cmp)}` : null,
                              saldoBrl != null ? `Saldo ${formatBRL(saldoBrl)}` : null,
                              p.available != null ? `livre ${formatPts(p.available)}` : null
                          ].filter(Boolean);
                const inner = (
                    <>
                        <span className="pontos-wallet__brand">{unitLabel(p.unit || 'pontos', 2)}</span>
                        <strong>{formatPts(p.balance)}</strong>
                        {cmp != null ? (
                            <span className="pontos-wallet__cmp">
                                {formatBRL(cmp)} <small>/ milheiro</small>
                            </span>
                        ) : null}
                        <span className="pontos-wallet__name">{p.name}</span>
                        {meta.length ? <span className="pontos-wallet__meta">{meta.join(' · ')}</span> : null}
                    </>
                );
                const cls = `pontos-wallet pontos-wallet--${p.brand} pontos-wallet--unit-${p.unit || 'pontos'}${on ? ' is-on' : ''}`;
                return onSelect ? (
                    <button key={p.id} type="button" className={cls} onClick={() => onSelect(p.id)}>
                        {inner}
                    </button>
                ) : (
                    <article key={p.id} className={cls}>
                        {inner}
                    </article>
                );
            })}
        </div>
    );
}

export function ConvertStage({
    from,
    to,
    originPts,
    base,
    bonus,
    total,
    onSwap
}: {
    from?: MilesProgram;
    to?: MilesProgram;
    originPts: number;
    base: number;
    bonus: number;
    total: number;
    onSwap?: () => void;
}) {
    return (
        <div className="pontos-stage">
            <div className="pontos-stage__col">
                <span>{from?.name ?? 'Origem'}</span>
                <strong>{formatPts(originPts)}</strong>
                <em>{unitLabel(from?.unit || 'pontos', originPts || 2)} enviados</em>
            </div>
            {onSwap ? (
                <button type="button" className="pontos-swap" onClick={onSwap} aria-label="Inverter programas">
                    <MaterialIcon name="swap_horiz" variant="app" />
                </button>
            ) : (
                <span className="pontos-swap pontos-swap--static" aria-hidden>
                    <MaterialIcon name="east" variant="app" />
                </span>
            )}
            <div className="pontos-stage__col pontos-stage__col--dest">
                <span>{to?.name ?? 'Destino'}</span>
                <strong>{formatPts(total)}</strong>
                <em>
                    {formatPts(base)} {unitLabel(to?.unit || 'pontos', base || 2)}
                    {bonus > 0 ? ` + ${formatPts(bonus)} bônus` : ''}
                </em>
            </div>
        </div>
    );
}
