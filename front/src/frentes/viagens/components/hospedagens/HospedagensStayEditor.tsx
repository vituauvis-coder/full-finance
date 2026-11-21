import { stayAirportInsight } from '@motor/viagens/stay-logistics.js';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { TripPayload, TripStay } from '../../types';
import { formatBRL } from '../../utils/map-utils';
import { pickPlaceDisplayName } from '../../utils/place-display';
import { formatTripDayShort } from '../../utils/tripCalendar';
import { TripSimDayPicker } from '../simulador/TripSimDayPicker';

type DestOpt = { id: string; label: string };

export type HospEditorMode = 'view' | 'edit';

type Props = {
    stay: TripStay;
    tripCtx: { payload: TripPayload };
    destOptions: DestOpt[];
    mode: HospEditorMode;
    saving?: boolean;
    onPatch: (partial: Partial<TripStay>) => void;
    onRemove: () => void;
    onEdit: () => void;
    onSave: () => void | Promise<void>;
    onCancel: () => void;
};

function stayNights(stay: TripStay): number | null {
    const a = stay.checkInOn ?? stay.check_in_on;
    const b = stay.checkOutOn ?? stay.check_out_on;
    if (!a || !b) return null;
    const nights = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
    return nights > 0 ? nights : null;
}

function isoDate(stay: TripStay, key: 'in' | 'out'): string {
    return (key === 'in' ? stay.checkInOn ?? stay.check_in_on : stay.checkOutOn ?? stay.check_out_on) ?? '';
}

export function HospedagensStayEditor({
    stay,
    tripCtx,
    destOptions,
    mode,
    saving,
    onPatch,
    onRemove,
    onEdit,
    onSave,
    onCancel
}: Props) {
    const viewing = mode === 'view';
    const insight = stayAirportInsight(tripCtx, stay);
    const paid = Boolean(stay.paid);
    const hasPin = stay.latitude != null && stay.longitude != null;
    const title =
        pickPlaceDisplayName({
            name: stay.name,
            countryName: stay.country ?? stay.city
        }) || 'Sem nome';
    const nights = stayNights(stay);
    const destLabel = destOptions.find((d) => d.id === stay.destinationId)?.label ?? '—';
    const checkIn = isoDate(stay, 'in');
    const checkOut = isoDate(stay, 'out');

    return (
        <section
            className={`hosp-editor${viewing ? ' hosp-editor--view' : ' hosp-editor--edit'}`}
            aria-label={viewing ? 'Hospedagem' : 'Editar hospedagem'}
        >
            <header className="hosp-editor__hero">
                <div className="hosp-editor__hero-icon" aria-hidden="true">
                    <MaterialIcon name="apartment" variant="app" opticalSize={26} />
                </div>
                <div className="hosp-editor__hero-text">
                    <p className="hosp-editor__kicker">{viewing ? 'Registro salvo' : 'Editando registro'}</p>
                    <h3 className="hosp-editor__title">{title}</h3>
                    <div className="hosp-editor__chips">
                        {destLabel !== '—' ? (
                            <span className="hosp-chip hosp-chip--dest">
                                <MaterialIcon name="pin_drop" variant="app" opticalSize={15} />
                                {destLabel}
                            </span>
                        ) : null}
                        {nights != null ? (
                            <span className="hosp-chip">
                                <MaterialIcon name="nights_stay" variant="app" opticalSize={15} />
                                {nights} {nights === 1 ? 'noite' : 'noites'}
                            </span>
                        ) : null}
                        {hasPin ? (
                            <span className="hosp-chip hosp-chip--ok">
                                <MaterialIcon name="location_on" variant="app" opticalSize={15} />
                                No mapa
                            </span>
                        ) : (
                            <span className="hosp-chip hosp-chip--warn">
                                <MaterialIcon name="add_location_alt" variant="app" opticalSize={15} />
                                Sem pin
                            </span>
                        )}
                        {paid ? (
                            <span className="hosp-chip hosp-chip--paid">
                                <MaterialIcon name="check_circle" variant="app" opticalSize={15} />
                                Pago
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="hosp-editor__hero-side">
                    <div className="hosp-editor__mode" role="tablist" aria-label="Modo">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={viewing}
                            className={viewing ? 'is-on' : undefined}
                            onClick={onCancel}
                        >
                            Ficha
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={!viewing}
                            className={!viewing ? 'is-on' : undefined}
                            onClick={onEdit}
                        >
                            Editar
                        </button>
                    </div>
                    <p className="hosp-editor__amount-label">Total</p>
                    <p className="hosp-editor__amount-value">{formatBRL(stay.amount ?? 0)}</p>
                    <button type="button" className="hosp-editor__remove" onClick={onRemove}>
                        <MaterialIcon name="delete_outline" variant="app" opticalSize={18} />
                        Excluir
                    </button>
                </div>
            </header>

            {viewing ? (
                <div className="hosp-editor__facts">
                    <Fact icon="label" label="Nome" value={title} />
                    <Fact icon="pin_drop" label="Destino" value={destLabel} />
                    <Fact
                        icon="event"
                        label="Check-in"
                        value={checkIn ? formatTripDayShort(checkIn) : '—'}
                    />
                    <Fact
                        icon="event_available"
                        label="Check-out"
                        value={checkOut ? formatTripDayShort(checkOut) : '—'}
                    />
                    <Fact icon="location_city" label="Cidade" value={stay.city?.trim() || '—'} />
                    <Fact icon="home_pin" label="Endereço" value={stay.address?.trim() || '—'} wide />
                    <Fact
                        icon="my_location"
                        label="Coordenadas"
                        value={
                            hasPin
                                ? `${stay.latitude?.toFixed(5)}, ${stay.longitude?.toFixed(5)}`
                                : 'Marque no mapa ao lado'
                        }
                        wide
                    />
                    {insight.hint ? <Fact icon="flight_land" label="Aeroporto" value={insight.hint} wide accent /> : null}
                </div>
            ) : (
                <div className="hosp-editor__grid">
                    <article className="hosp-editor__card">
                        <h4 className="hosp-editor__card-title">
                            <MaterialIcon name="event" variant="app" opticalSize={18} />
                            Estadia
                        </h4>
                        <label className="hosp-editor__field">
                            <span>Nome</span>
                            <input
                                className="viagens-field hosp-field"
                                value={stay.name ?? ''}
                                placeholder="Hotel, Airbnb, pousada…"
                                onChange={(e) => onPatch({ name: e.target.value })}
                            />
                        </label>
                        <label className="hosp-editor__field">
                            <span>Destino do roteiro</span>
                            <select
                                className="viagens-field hosp-field"
                                value={stay.destinationId ?? ''}
                                onChange={(e) => onPatch({ destinationId: e.target.value || null })}
                            >
                                <option value="">Selecione</option>
                                {destOptions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="hosp-editor__pair">
                            <label className="hosp-editor__field">
                                <span>Check-in</span>
                                <TripSimDayPicker
                                    value={checkIn}
                                    placeholder="Check-in"
                                    onChange={(iso) => onPatch({ checkInOn: iso, check_in_on: iso })}
                                />
                            </label>
                            <label className="hosp-editor__field">
                                <span>Check-out</span>
                                <TripSimDayPicker
                                    value={checkOut}
                                    placeholder="Check-out"
                                    onChange={(iso) => onPatch({ checkOutOn: iso, check_out_on: iso })}
                                />
                            </label>
                        </div>
                    </article>

                    <article className="hosp-editor__card">
                        <h4 className="hosp-editor__card-title">
                            <MaterialIcon name="payments" variant="app" opticalSize={18} />
                            Pagamento
                        </h4>
                        <label className="hosp-editor__field hosp-editor__field--amount">
                            <span>Valor total (R$)</span>
                            <input
                                className="viagens-field hosp-field hosp-editor__amount-input"
                                type="number"
                                min={0}
                                step={1}
                                value={stay.amount ?? ''}
                                placeholder="0"
                                onChange={(e) => onPatch({ amount: Number(e.target.value) || 0 })}
                            />
                        </label>
                        <button
                            type="button"
                            className={`hosp-editor__paid${paid ? ' is-on' : ''}`}
                            aria-pressed={paid}
                            onClick={() => onPatch({ paid: !paid })}
                        >
                            <MaterialIcon
                                name={paid ? 'check_circle' : 'radio_button_unchecked'}
                                variant="app"
                                opticalSize={20}
                            />
                            {paid ? 'Marcado como pago' : 'Marcar como pago'}
                        </button>
                    </article>

                    <article className="hosp-editor__card hosp-editor__card--wide">
                        <h4 className="hosp-editor__card-title">
                            <MaterialIcon name="map" variant="app" opticalSize={18} />
                            Localização
                        </h4>
                        <div className="hosp-editor__loc-grid">
                            <label className="hosp-editor__field">
                                <span>Cidade</span>
                                <input
                                    className="viagens-field hosp-field"
                                    value={stay.city ?? ''}
                                    placeholder="Cidade"
                                    onChange={(e) => onPatch({ city: e.target.value })}
                                />
                            </label>
                            <label className="hosp-editor__field">
                                <span>Endereço</span>
                                <input
                                    className="viagens-field hosp-field"
                                    value={stay.address ?? ''}
                                    placeholder="Rua, número, bairro"
                                    onChange={(e) => onPatch({ address: e.target.value })}
                                />
                            </label>
                        </div>
                        <div className={`hosp-editor__callout${hasPin ? ' is-ok' : ''}`}>
                            <MaterialIcon name={hasPin ? 'my_location' : 'touch_app'} variant="app" opticalSize={20} />
                            <div>
                                <strong>{hasPin ? 'Local marcado' : 'Marque no mapa'}</strong>
                                <p>
                                    {hasPin
                                        ? `${stay.latitude?.toFixed(5)}, ${stay.longitude?.toFixed(5)}`
                                        : 'Clique no mapa à direita para fixar o pin.'}
                                </p>
                            </div>
                        </div>
                        {insight.hint ? (
                            <div className="hosp-editor__callout hosp-editor__callout--airport">
                                <MaterialIcon name="flight_land" variant="app" opticalSize={20} />
                                <div>
                                    <strong>Distância ao aeroporto</strong>
                                    <p>{insight.hint}</p>
                                </div>
                            </div>
                        ) : null}
                    </article>
                </div>
            )}

            {!viewing ? (
                <footer className="hosp-editor__actions">
                    <button type="button" className="hosp-board__cta hosp-board__cta--ghost" onClick={onCancel}>
                        Voltar à ficha
                    </button>
                    <button
                        type="button"
                        className="hosp-board__cta"
                        disabled={Boolean(saving)}
                        onClick={() => void onSave()}
                    >
                        <MaterialIcon name="save" variant="app" opticalSize={18} />
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </footer>
            ) : null}
        </section>
    );
}

function Fact({
    icon,
    label,
    value,
    wide,
    accent
}: {
    icon: string;
    label: string;
    value: string;
    wide?: boolean;
    accent?: boolean;
}) {
    return (
        <div
            className={`hosp-fact${wide ? ' hosp-fact--wide' : ''}${accent ? ' hosp-fact--accent' : ''}`}
        >
            <span className="hosp-fact__icon" aria-hidden="true">
                <MaterialIcon name={icon} variant="app" opticalSize={18} />
            </span>
            <div className="hosp-fact__body">
                <p className="hosp-fact__label">{label}</p>
                <p className="hosp-fact__value">{value}</p>
            </div>
        </div>
    );
}