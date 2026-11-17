# Viagens no Full Finance — design

**Data:** 2026-11-16  
**Status:** Implementação  
**Referência visual:** [prints/](../../prints/) (9 capturas do Meu Mundo desktop)  
**Regras:** [meu-mundo spec](../../../meu-mundo/docs/superpowers/specs/2026-11-08-viagens-design.md), motores `motor/viagens/`

## Escopo

Nova aba **Viagens** no Meu Malote: casa (atlas + trilho), ficha por viagem, seções Voos, Orçamento, Destinos, Hospedagens, Simulador. API `/api/trips`, tabela `trips`, vanilla JS, MapLibre.

## Critérios de aceite (por print)

1. Casa: mapa, intro Recife, trilho, Nova viagem, carimbos de status  
2. Ficha topo: calendário, resumo meta/cofrinho/gastos, checklist, Simulador (N)  
3. Voos: trechos, simulações, candidatas, KPIs  
4–5. Orçamento: metas, barras, categorias, lançamentos  
6. Destinos: busca, chips, mapa, timeline de dias  
7. Hospedagens e terrestre em duas colunas  
8. Simulador overlay: cenários, calendário, férias, trechos  

## Persistência na ficha

- Autosave com debounce ~1,2s (`viagem-persist.js`); **sem** barra sticky no rodapé (no Malote ela cobria os acordeões ao rolar).
- Erro ao salvar → toast (`showToast`), não bloco fixo na página.

## Paridade motor

- `trips-engine.js`: paridade testada  
- `trip-scenario-engine.js`: parcial vs Mac (documentado em meu-mundo `viagens-web-parity.md`)  

## Fora de escopo v1

Link Cofrinhos Malote ↔ meta da viagem; Mapbox; app nativo.