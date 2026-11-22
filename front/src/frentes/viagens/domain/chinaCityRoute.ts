import {
    buildChinaRouteLegs,
    compareChinaLeg,
    readChinaRouteOrder,
    reorderChinaRoute,
    resolveChinaRouteOrder
} from '@motor/viagens/china-city-route.js';
import type { TripDestination, TripPayload } from '../types';

export {
    buildChinaRouteLegs,
    compareChinaLeg,
    readChinaRouteOrder,
    reorderChinaRoute,
    resolveChinaRouteOrder
};

export type ChinaLegCompare = NonNullable<ReturnType<typeof compareChinaLeg>>;

export type ChinaRouteLegMeta = ReturnType<typeof buildChinaRouteLegs>[number];

export type ChinaRouteLegDraw = ChinaRouteLegMeta & {
    coordinates: [number, number][];
    mid: { longitude: number; latitude: number };
};

export function chinaRouteStops(order: string[], destinations: TripDestination[]): TripDestination[] {
  const byId = new Map(destinations.map((d) => [d.id, d]));
  return order.map((id) => byId.get(id)).filter((d): d is TripDestination => Boolean(d));
}

export function writeChinaRouteOrder(payload: TripPayload, order: string[]): TripPayload {
  return {
    ...payload,
    china_city_route_order: order,
    chinaCityRouteOrder: order
  };
}