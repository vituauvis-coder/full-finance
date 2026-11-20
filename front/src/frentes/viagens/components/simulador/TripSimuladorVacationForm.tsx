import { useMemo } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import {
    sortHopsChronologically,
    suggestedVacationStart,
    vacationEndsOn,
    type TripTimeHop,
    type TripVacationPeriod,
    type TripRemotePolicy
} from '../../domain/tripTimeScenario';
import { formatTripDayShort } from '../../utils/tripCalendar';
import type { TripTimeScenario } from '../../types';
import { TripSimDayPicker } from './TripSimDayPicker';

const AUTH_LABEL: Record<string, string> = {
    authorized: 'Autorizado',
    pending: 'Pendente',
    not_allowed: 'Não permitido'
};

const DAY_PRESETS = [18, 20, 25, 30] as const;

type Props = {
    scenario: TripTimeScenario;
    onChange: (next: TripTimeScenario) => void;
    onVacationStart?: (startKey: string, periodIndex: number) => void;
    onDone?: () => void;
};

function vacationsOf(sc: TripTimeScenario): TripVacationPeriod[] {
    return (sc.vacations as TripVacationPeriod[] | undefined) ?? [];
}

function remoteOf(sc: TripTimeScenario): TripRemotePolicy {
    return (sc.remote as TripRemotePolicy | undefined) ?? { authorization: 'pending' };
}

function periodId(period: TripVacationPeriod, index: number): string {
    return period.id ?? `vac-${index}`;
}

export function TripSimuladorVacationForm({ scenario, onChange, onVacationStart, onDone }: Props) {
    const vacations = vacationsOf(scenario);
    const remote = remoteOf(scenario);
    const auth = remote.authorization ?? 'pending';
    const hops = useMemo(
        () => sortHopsChronologically((scenario.hops as TripTimeHop[] | undefined) ?? []),
        [scenario.hops]
    );
    const vacationHint = useMemo(() => suggestedVacationStart(hops), [hops]);

    function patchVacations(next: TripVacationPeriod[]) {
        onChange({
            ...scenario,
            vacations: next.map((p, i) => {
                const start = (p.starts_on ?? p.startsOn ?? '').trim().slice(0, 10);
                return {
                    ...p,
                    id: periodId(p, i),
                    days: Math.max(1, Number(p.days ?? 18)),
                    startsOn: start,
                    starts_on: start
                };
            })
        });
    }

    function patchScenario(partial: Partial<TripTimeScenario>) {
        onChange({ ...scenario, ...partial });
    }

    return (
        <div className="viagens-sim-ferias-form">
            {vacations.length === 0 ? (
                <button
                    type="button"
                    className="viagens-sim-ferias__cta"
                    onClick={() =>
                        patchVacations([{ id: crypto.randomUUID(), days: 18, startsOn: '', starts_on: '' }])
                    }
                >
                    <MaterialIcon name="beach_access" variant="app" opticalSize={20} />
                    <span>
                        <strong>Começar período de férias</strong>
                        <small>18 dias por padrão — ajuste abaixo</small>
                    </span>
                </button>
            ) : (
                vacations.map((period, idx) => {
                    const pid = periodId(period, idx);
                    const endKey = vacationEndsOn(period);
                    const days = Math.max(1, period.days ?? 18);

                    return (
                        <article key={pid} className="viagens-sim-ferias__card">
                            {vacations.length > 1 ? (
                                <header className="viagens-sim-ferias__card-head">Período {idx + 1}</header>
                            ) : null}

                            <div className="viagens-sim-ferias__presets" aria-label="Atalhos de duração">
                                {DAY_PRESETS.map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        className={`viagens-sim-ferias__preset${days === d ? ' is-on' : ''}`}
                                        onClick={() => {
                                            const next = [...vacations];
                                            next[idx] = { ...period, id: pid, days: d };
                                            patchVacations(next);
                                        }}
                                    >
                                        {d} d
                                    </button>
                                ))}
                            </div>

                            <div className="viagens-sim-ferias__grid viagens-sim-ferias__grid--main">
                                <div className="viagens-sim-ferias__field viagens-sim-ferias__field--date">
                                    <span>Começa</span>
                                    <TripSimDayPicker
                                        value={(period.starts_on ?? period.startsOn ?? '').slice(0, 10)}
                                        placeholder="Escolher início"
                                        onChange={(iso) => {
                                            const key = iso.trim().slice(0, 10);
                                            if (onVacationStart) {
                                                onVacationStart(key, idx);
                                                return;
                                            }
                                            const next = [...vacations];
                                            next[idx] = {
                                                ...period,
                                                id: pid,
                                                startsOn: key,
                                                starts_on: key
                                            };
                                            patchVacations(next);
                                        }}
                                    />
                                    {!(period.starts_on ?? period.startsOn ?? '').trim() && vacationHint ? (
                                        <p className="viagens-sim-ferias__date-hint viagens-muted">
                                            Sugestão: {formatTripDayShort(vacationHint)}
                                        </p>
                                    ) : null}
                                </div>

                                <label className="viagens-sim-ferias__field">
                                    <span>Dias</span>
                                    <div className="viagens-sim-ferias__stepper">
                                        <button
                                            type="button"
                                            aria-label="Menos um dia"
                                            onClick={() => {
                                                const next = [...vacations];
                                                next[idx] = { ...period, id: pid, days: Math.max(1, days - 1) };
                                                patchVacations(next);
                                            }}
                                        >
                                            −
                                        </button>
                                        <input
                                            type="number"
                                            min={1}
                                            max={90}
                                            aria-label="Quantidade de dias"
                                            value={days}
                                            onChange={(e) => {
                                                const n = Math.min(90, Math.max(1, Number(e.target.value) || 1));
                                                const next = [...vacations];
                                                next[idx] = { ...period, id: pid, days: n };
                                                patchVacations(next);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            aria-label="Mais um dia"
                                            onClick={() => {
                                                const next = [...vacations];
                                                next[idx] = { ...period, id: pid, days: Math.min(90, days + 1) };
                                                patchVacations(next);
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                </label>

                                <div className="viagens-sim-ferias__field" aria-live="polite">
                                    <span>Termina</span>
                                    <p className="viagens-sim-ferias__end-box">
                                        {endKey ? formatTripDayShort(endKey) : '—'}
                                    </p>
                                </div>
                            </div>

                            {vacations.length > 1 ? (
                                <button
                                    type="button"
                                    className="viagens-sim-ferias__remove"
                                    onClick={() => patchVacations(vacations.filter((_, i) => i !== idx))}
                                >
                                    <MaterialIcon name="delete" variant="app" opticalSize={16} />
                                    Excluir período
                                </button>
                            ) : null}
                        </article>
                    );
                })
            )}

            {vacations.length > 0 ? (
                <div className="viagens-sim-ferias__extras">
                    <SaldoField scenario={scenario} onPatch={patchScenario} />
                    <div className={`viagens-sim-ferias__auth viagens-sim-ferias__auth--${auth}`}>
                        <p className="viagens-sim-ferias__auth-label">
                            <MaterialIcon name="laptop_mac" variant="app" opticalSize={14} />
                            Remoto
                        </p>
                        <div className="viagens-sim-ferias__auth-options" role="group" aria-label="Autorização remoto">
                            {(Object.entries(AUTH_LABEL) as [TripRemotePolicy['authorization'], string][]).map(
                                ([k, label]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className={`viagens-sim-ferias__auth-opt${auth === k ? ' is-on' : ''}`}
                                        onClick={() =>
                                            onChange({
                                                ...scenario,
                                                remote: { ...remote, authorization: k }
                                            })
                                        }
                                    >
                                        {label}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            <label className="viagens-sim-ferias__notes">
                <span>Observações</span>
                <textarea
                    rows={2}
                    placeholder="Opcional: feriados, aprovações, restrições…"
                    value={String(scenario.notes ?? '')}
                    onChange={(e) => onChange({ ...scenario, notes: e.target.value })}
                />
            </label>

            {onDone ? (
                <footer className="viagens-sim-ferias__foot">
                    <button type="button" className="viagens-sim-ferias__done" onClick={onDone}>
                        Salvar e fechar
                    </button>
                </footer>
            ) : null}
        </div>
    );
}

function SaldoField({
    scenario,
    onPatch
}: {
    scenario: TripTimeScenario;
    onPatch: (p: Partial<TripTimeScenario>) => void;
}) {
    const balance = scenario.vacation_balance ?? scenario.vacationBalance;
    return (
        <label className="viagens-sim-ferias__balance">
            <span className="viagens-sim-ferias__balance-label">
                <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={14} />
                Saldo no ano
            </span>
            <span className="viagens-sim-ferias__balance-input">
                <input
                    type="number"
                    min={0}
                    aria-label="Saldo de férias no ano"
                    placeholder="—"
                    value={balance ?? ''}
                    onChange={(e) => {
                        const raw = e.target.value;
                        const n = raw === '' ? undefined : Math.max(0, Number(raw) || 0);
                        onPatch({ vacation_balance: n, vacationBalance: n });
                    }}
                />
                <span>dias</span>
            </span>
        </label>
    );
}