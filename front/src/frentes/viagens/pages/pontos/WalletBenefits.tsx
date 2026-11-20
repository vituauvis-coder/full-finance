import { useEffect, useRef, useState } from 'react';
import { notifyWalletChanged, patchMilesProgram } from '../../api/miles';
import { Chip, ChipRow, DecimalField, PontosAlert, PtsField } from './PontosFields';
import { BONUS_PRESETS, milesError, type MilesProgram } from './pontos-format';

type Props = {
    program: MilesProgram;
    onSaved: (next: MilesProgram) => void;
};

type ClubPatch = {
    bonus?: number;
    club?: boolean;
    fee?: number;
    milheiro?: number;
    started?: string;
    points?: number;
    clubBonus?: number;
};

function localDayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function WalletBenefits({ program, onSaved }: Props) {
    const [bonus, setBonus] = useState(program.transferBonusPercent ?? 0);
    const [club, setClub] = useState(Boolean(program.clubActive));
    const [fee, setFee] = useState(Number(program.clubFeeBrl) || 0);
    const [milheiro, setMilheiro] = useState(Number(program.buyMilheiro) || 0);
    const [started, setStarted] = useState(program.clubStartedOn ?? '');
    const [points, setPoints] = useState(program.clubPointsPerMonth ?? 0);
    const [clubBonus, setClubBonus] = useState(program.clubBonusPerMonth ?? 0);
    const [error, setError] = useState<string | null>(null);
    const timer = useRef(0);

    useEffect(() => {
        setBonus(program.transferBonusPercent ?? 0);
        setClub(Boolean(program.clubActive));
        setFee(Number(program.clubFeeBrl) || 0);
        setMilheiro(Number(program.buyMilheiro) || 0);
        setStarted(program.clubStartedOn ?? '');
        setPoints(program.clubPointsPerMonth ?? 0);
        setClubBonus(program.clubBonusPerMonth ?? 0);
    }, [
        program.id,
        program.transferBonusPercent,
        program.clubActive,
        program.clubFeeBrl,
        program.buyMilheiro,
        program.clubStartedOn,
        program.clubPointsPerMonth,
        program.clubBonusPerMonth
    ]);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    function persist(next: {
        transferBonusPercent: number;
        clubActive: boolean;
        clubFeeBrl: number;
        buyMilheiro: number;
        clubStartedOn: string | null;
        clubPointsPerMonth: number;
        clubBonusPerMonth: number;
    }) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            void patchMilesProgram(program.id, next)
                .then((res) => {
                    const saved = (res as { program: MilesProgram }).program;
                    onSaved({
                        ...program,
                        ...saved,
                        milheiro: saved.milheiro ?? program.milheiro,
                        invested: saved.invested ?? program.invested
                    });
                    notifyWalletChanged();
                })
                .catch((err: unknown) => setError(milesError(err)));
        }, 420);
    }

    function apply(patch: ClubPatch) {
        const transferBonusPercent = patch.bonus ?? bonus;
        const clubActive = patch.club ?? club;
        const clubFeeBrl = patch.fee ?? fee;
        const buyMilheiro = patch.milheiro ?? milheiro;
        const clubPointsPerMonth = patch.points ?? points;
        const clubBonusPerMonth = patch.clubBonus ?? clubBonus;
        let clubStartedOn = patch.started ?? started;
        if (clubActive && !clubStartedOn) clubStartedOn = localDayKey();
        if (patch.bonus != null) setBonus(patch.bonus);
        if (patch.club != null) setClub(patch.club);
        if (patch.fee != null) setFee(patch.fee);
        if (patch.milheiro != null) setMilheiro(patch.milheiro);
        if (patch.started != null || (clubActive && !started)) setStarted(clubStartedOn);
        if (patch.points != null) setPoints(patch.points);
        if (patch.clubBonus != null) setClubBonus(patch.clubBonus);
        setError(null);
        persist({
            transferBonusPercent,
            clubActive,
            clubFeeBrl,
            buyMilheiro,
            clubStartedOn: clubActive ? clubStartedOn || null : started || null,
            clubPointsPerMonth,
            clubBonusPerMonth
        });
    }

    return (
        <section className="wallet-benefits" aria-label="Benefícios da carteira">
            <div className="wallet-benefits__head">
                <p className="pontos-kicker">Benefícios</p>
                <div className="wallet-benefits__badges">
                    {bonus > 0 ? <span className="voo-pay__badge is-ok">+{bonus}%</span> : null}
                    {club ? <span className="voo-pay__badge">Clube</span> : null}
                </div>
            </div>
            <PontosAlert>{error}</PontosAlert>
            <div className="wallet-benefits__bonus">
                <span>Bônus de transferência</span>
                <ChipRow>
                    {BONUS_PRESETS.map((p) => (
                        <Chip key={p} on={bonus === p} onClick={() => apply({ bonus: p })}>
                            {p === 0 ? '0%' : `+${p}%`}
                        </Chip>
                    ))}
                </ChipRow>
            </div>
            <div className={`wallet-benefits__grid${club ? ' is-club' : ''}`}>
                <div className="wallet-benefits__club">
                    <span>Clube</span>
                    <div className="voo-pay__mode" role="group" aria-label="Clube">
                        <button type="button" className={!club ? 'is-on' : undefined} onClick={() => apply({ club: false })}>
                            Não
                        </button>
                        <button type="button" className={club ? 'is-on' : undefined} onClick={() => apply({ club: true })}>
                            Ativo
                        </button>
                    </div>
                </div>
                <DecimalField
                    label="Milheiro"
                    value={milheiro}
                    onChange={(n) => apply({ milheiro: Math.max(0, n) })}
                    suffix="R$"
                />
                {club ? (
                    <div className="wallet-benefits__club-fields">
                        <DecimalField
                            label="Mensalidade"
                            value={fee}
                            onChange={(n) => apply({ fee: Math.max(0, n) })}
                            suffix="R$"
                        />
                        <PtsField
                            label="Pontos / mês"
                            value={points}
                            onChange={(n) => apply({ points: Math.max(0, n) })}
                        />
                        <PtsField
                            label="Bônus no 1º mês"
                            value={clubBonus}
                            onChange={(n) => apply({ clubBonus: Math.max(0, n) })}
                        />
                        <label className="voos-field">
                            <span>Assinatura</span>
                            <input
                                className="viagens-field pontos-input"
                                type="date"
                                value={started}
                                onChange={(e) => apply({ started: e.target.value })}
                            />
                        </label>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
