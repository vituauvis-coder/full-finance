import type { Trip } from '../types';
import {
    tripTicketDates,
    tripTicketRef,
    tripTicketRoute,
    tripTicketStatus,
    tripTicketStatusLabel,
    tripTicketTitle
} from './tripTicketModel';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripTicketArtCandidate } from './tripTicketArt';
import './TripTicketCard.css';

type Props = {
    trip: Trip;
};

/** Bilhete de embarque — link para a ficha da viagem. */
export function TripTicketCard({ trip }: Props) {
    const navigate = useNavigate();
    const status = tripTicketStatus(trip);
    const route = tripTicketRoute(trip);
    const artCandidate = tripTicketArtCandidate(trip);
    const artLabel = tripTicketTitle(trip);
    const [artVisible, setArtVisible] = useState(Boolean(artCandidate));

    useEffect(() => {
        setArtVisible(Boolean(artCandidate));
    }, [trip.id, artCandidate?.url]);

    const showArt = artVisible && artCandidate;

    const title = tripTicketTitle(trip);

    const openTrip = useCallback(() => {
        if (!trip.id) return;
        navigate(`/viagens/${trip.id}`);
    }, [navigate, trip.id]);

    return (
        <button
            type="button"
            className={`trip-ticket${showArt ? ' trip-ticket--has-art' : ''}`}
            data-status={status}
            aria-label={`Abrir viagem ${title}`}
            onClick={openTrip}
        >
            <span className="trip-ticket__perforation" aria-hidden />
            {showArt ? (
                <div className="trip-ticket__art">
                    <img
                        className="trip-ticket__art-img"
                        src={artCandidate.url}
                        alt=""
                        decoding="async"
                        onError={() => setArtVisible(false)}
                    />
                    <span className="trip-ticket__art-caption">{artLabel}</span>
                </div>
            ) : null}
            <div className="trip-ticket__main">
                <div className="trip-ticket__header">
                    <span className="trip-ticket__label">Passagem</span>
                    <span className="trip-ticket__status">{tripTicketStatusLabel(status)}</span>
                </div>
                <h3 className="trip-ticket__destination">{title}</h3>
                <dl className="trip-ticket__fields">
                    <div className="trip-ticket__field">
                        <dt>Datas</dt>
                        <dd>{tripTicketDates(trip)}</dd>
                    </div>
                    {route ? (
                        <div className="trip-ticket__field trip-ticket__field--route">
                            <dt>Rota</dt>
                            <dd>{route}</dd>
                        </div>
                    ) : null}
                </dl>
            </div>
            <div className="trip-ticket__stub" aria-hidden>
                <span className="trip-ticket__stub-label">REF</span>
                <span className="trip-ticket__stub-code">{tripTicketRef(trip)}</span>
                <span className="trip-ticket__barcode" />
            </div>
        </button>
    );
}