import { Marker } from 'react-map-gl/maplibre';
import { VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import type { MapVisit, Trip } from '../../types';
import type { AtlasRenderPin } from '../../utils/map-markers';
import { mapAirportBadgeLabel } from '../../utils/map-utils';
import { atlasPinPopoverFromTrip, atlasPinPopoverFromVisit } from '../../utils/atlas-pin-context';
import { AtlasMapClusterPopover } from '../AtlasMapClusterPopover';
import { AtlasMapPinPopover } from '../AtlasMapPinPopover';
import { ViagensPin } from '../ViagensPin';
import { ViagensPlaceBadge } from '../ViagensPlaceBadge';

type HoverState = {
    pinKey: string;
    visit: MapVisit | null;
    tripId: string;
};

type Props = {
    clusters: Array<{ visits: MapVisit[]; latitude: number; longitude: number } | null>;
    hoveredCluster: number | null;
    onClusterHover: (index: number | null) => void;
    onZoomCluster: (lat: number, lng: number) => void;
    pins: AtlasRenderPin[];
    hovered: HoverState | null;
    tripsById: Map<string, Trip>;
    focusedTripId: string | null;
    onOpenTrip: (tripId: string) => void;
    onActivatePin: (pinKey: string, tripId: string, visit: MapVisit | null) => void;
    onDeactivatePin: (pinKey: string) => void;
};

export function ViagensMapMarkers({
    clusters,
    hoveredCluster,
    onClusterHover,
    onZoomCluster,
    pins,
    hovered,
    tripsById,
    focusedTripId,
    onOpenTrip,
    onActivatePin,
    onDeactivatePin
}: Props) {
    return (
        <>
            <Marker longitude={VIAGENS_HOME.longitude} latitude={VIAGENS_HOME.latitude} anchor="bottom">
                <div className="viagens-pin-marker viagens-pin-marker--home" aria-label="Saída: Recife">
                    <ViagensPin variant="home" status="em_curso" />
                    <ViagensPlaceBadge name={VIAGENS_HOME.name} />
                </div>
            </Marker>
            {clusters.map((c, ci) => {
                if (!c || c.visits.length === 1) return null;
                const clusterHot = hoveredCluster === ci;
                return (
                    <Marker key={`cluster-${ci}`} longitude={c.longitude} latitude={c.latitude} anchor="center">
                        <div
                            className="viagens-cluster-host"
                            onMouseEnter={() => onClusterHover(ci)}
                            onMouseLeave={() => onClusterHover(null)}
                            onFocus={() => onClusterHover(ci)}
                            onBlur={() => onClusterHover(null)}
                        >
                            {clusterHot ? (
                                <AtlasMapClusterPopover visits={c.visits} onOpenTrip={onOpenTrip} />
                            ) : null}
                            <button
                                type="button"
                                className={`viagens-cluster-badge${clusterHot ? ' viagens-cluster-badge--hot' : ''}`}
                                onClick={() => onZoomCluster(c.latitude, c.longitude)}
                                aria-label={`${c.visits.length} visitas no mesmo lugar`}
                                aria-expanded={clusterHot}
                            >
                                {c.visits.length}
                            </button>
                        </div>
                    </Marker>
                );
            })}
            {pins.map((pin) => {
                const visit = pin.visit;
                const pinKey = pin.id;
                const isHov = hovered?.pinKey === pinKey;
                const cityName = visit
                    ? mapAirportBadgeLabel(visit.destination.name, visit.hover.placeName)
                    : mapAirportBadgeLabel(pin.label);
                const awaiting = pin.status === 'planejada';
                const ariaTrip = visit?.tripTitle ?? tripsById.get(pin.tripId)?.title ?? 'viagem';
                const dimmed =
                    focusedTripId != null && focusedTripId.length > 0 && focusedTripId !== pin.tripId;
                const descId = `atlas-pin-desc-${pinKey}`;
                const trip = tripsById.get(pin.tripId);
                const popoverModel = visit
                    ? atlasPinPopoverFromVisit(visit, trip)
                    : trip
                      ? atlasPinPopoverFromTrip(trip, pin.label)
                      : null;

                return (
                    <Marker key={pin.id} longitude={pin.lng} latitude={pin.lat} anchor="bottom">
                        <div
                            className={`viagens-pin-marker viagens-pin-marker--dock${isHov ? ' viagens-pin-marker--hot' : ''}`}
                            onMouseEnter={() => onActivatePin(pinKey, pin.tripId, visit)}
                            onMouseLeave={() => onDeactivatePin(pinKey)}
                        >
                            {isHov && popoverModel ? (
                                <AtlasMapPinPopover
                                    id={descId}
                                    placeName={popoverModel.placeName}
                                    tripTitle={popoverModel.tripTitle}
                                    status={popoverModel.status}
                                    monthYear={popoverModel.monthYear}
                                    itineraryDay={popoverModel.itineraryDay}
                                    activity={popoverModel.activity}
                                    citySpent={popoverModel.citySpent}
                                    tripTotal={popoverModel.tripTotal}
                                    onOpenTrip={() => onOpenTrip(popoverModel.tripId)}
                                />
                            ) : null}
                            <button
                                type="button"
                                className={`viagens-place-marker viagens-place-marker--interactive${
                                    awaiting ? ' viagens-place-marker--awaiting' : ''
                                }${dimmed ? ' viagens-place-marker--dimmed' : ''}`}
                                onFocus={() => onActivatePin(pinKey, pin.tripId, visit)}
                                onBlur={(e) => {
                                    const next = e.relatedTarget as Node | null;
                                    if (next && e.currentTarget.parentElement?.contains(next)) return;
                                    onDeactivatePin(pinKey);
                                }}
                                onClick={() => onOpenTrip(pin.tripId)}
                                aria-label={`${cityName}, ${ariaTrip}`}
                                aria-describedby={isHov ? descId : undefined}
                            >
                                <ViagensPin
                                    status={pin.status}
                                    hovering={isHov}
                                    isPrincipal={pin.isPrincipal}
                                />
                                <ViagensPlaceBadge name={cityName} />
                            </button>
                        </div>
                    </Marker>
                );
            })}
        </>
    );
}