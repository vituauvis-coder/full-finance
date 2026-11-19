# Voos + Casa das milhas

Tela própria ao clicar em **Voos** na ficha: `/viagens/:id/voos`.

## Abas

1. **Simulações** — trechos e opções de voo da **viagem** (paridade Mac).
2. **Casa das milhas** — carteira da **conta** (saldo vale em qualquer viagem). Esfera já vem cadastrada.

## Simulações

- Trechos (`Recife > Madri`), KPIs (menor custo, média, hub, opções).
- Cards Candidata / Escolhida / Descartada, duplicar, apagar, editor (passagem, taxas, ida/volta, conexões, notas).
- Persistência: `trip.payload.flight_segments` + autosave da ficha.

## Casa das milhas

- Programas (Esfera, Smiles, LATAM Pass, Livelo, Azul, outro).
- Saldo e milheiro (R$ / 1.000 pts) informados pela pessoa — não há API pública do banco.
- Motor: comparar trecho em R$ vs pontos (`cash vs award`).
- Persistência: `users.finance_preferences.viagensMiles`.

## APIs públicas (sem chave)

- Busca de aeroporto/cidade: catálogo IATA + Nominatim.
- Sem cotação live de passagem no v1 (Amadeus/Duffel exigem chave paga).
