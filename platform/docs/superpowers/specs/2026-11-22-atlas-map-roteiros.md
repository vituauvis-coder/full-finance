# Atlas — mapa/globo com roteiro unificado

**Data:** 2026-11-22  
**Status:** Fase 5 concluída (Fases 1–4 concluídas)  
**Relacionado:** `ViagensMap.tsx`, `ViagemMiniMap.tsx`, `roteiros-map-routes.ts`, `motor/viagens/flight-route-geo.js`

## Problema

- O **atlas** desenha só arcos de voo + destinos em `payload.destinations`.
- O **roteiro** (ficha) já calcula hops, terrestre, caminhada e OSRM em `buildRoteirosMapRoutes` — não reutilizado na home.
- Resultado: globo “simples”, roteiro invisível, duas fontes de verdade.

## Objetivo

1. **Um modelo** (`atlas-map-model.js`) para pins e camadas GeoJSON (voo ida/volta, ground, walk, itinerary).
2. **Paridade progressiva** com o mapa de roteiros (`detail: summary | full`).
3. **Visual** alinhado ao dashboard (`--dash-*`), legenda e toggles (fases 3–4).
4. **Refator** do React em módulos menores (fase 5).

## Contrato do model

```js
buildAtlasMapModel(trips, { now }) → {
  visits,
  pins,           // compat routeMarkerPoints + extras de itinerary
  layers: {
    flightOut,    // FeatureCollection
    flightBack,
    ground,
    walk,
  },
  meta: { tripSummaries[] }
}
```

Propriedades de linha: `tripId`, `layer`, `source` (`flight` | `itinerary` | `destination-hop`), `from`, `to`.

## Fases

| Fase | Entrega |
|------|---------|
| 1 | `atlas-map-model.js` + testes; spec ✅ |
| 2 | `ViagensMap` consome model; camadas ground/walk ✅ |
| 3 | Tema visual + legenda + toggles ✅ |
| 4 | Popover rico + foco viagem ✅ |
| 5 | Split componentes; `ViagemMiniMap` compartilha model ✅ |
| 6 | Cache OSRM / batch API (se necessário) |

## Decisões

- **Várias viagens:** arcos resumidos; roteiro detalhado ao **focar** viagem (sidebar/card).
- **OSRM na home:** sob demanda na viagem focada (não no load inicial).
- **Cores:** por `tripId` (paleta curta) + turquesa para casa.

## Fora de escopo imediato

- Migrar todo `roteiros-map-routes.ts` para motor num único PR (extração incremental).
- Mapbox / tiles alternativos.