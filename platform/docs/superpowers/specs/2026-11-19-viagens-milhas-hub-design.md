# Milhas — hub global (layout A)

Decisão de produto e UI para a **Central de milhas** fora do fluxo de uma viagem específica. Complementa `2026-11-16-central-pontos-milhas-design.md` (dados e motor permanecem; **navegação** muda).

## Decisões aprovadas

| Tema | Decisão |
|------|---------|
| Menu | **Opção A:** grupo expansível **Viagens** na sidebar, com **Viagens** (`/viagens`) e **Milhas** (`/viagens/milhas`). |
| Layout da tela | **Opção A (hub):** KPI no topo; coluna esquerda = rail de carteiras; coluna direita = carteira ativa + lançar/transferir + extrato + calculadoras na mesma página (sem abas). Mockup: `docs/mockups/milhas-tela-opcoes.html`. |
| Calculadoras v1 | **As duas:** dinheiro vs pontos + simulação de emissão (blocos já existentes no front). |
| Escopo da conta | Carteiras, movimentos, transferências, taxas salvas — fonte **`/api/miles`** (não `finance_preferences.viagensMiles`). |
| Escopo da viagem | Emissões por `trip_id`, necessidade de saldo por trechos escolhidos, comparador ligado a simulação de voo — permanecem em **Voos** (`/viagens/:tripId/voos`). |

## Objetivo da rota `/viagens/milhas`

Responder, sem abrir uma viagem:

1. Quanto tenho em cada programa (livre vs reservado)?
2. Qual o milheiro médio e o investido?
3. Como lanço compra, acúmulo, transferência?
4. Vale a pena emissão vs dinheiro (calculadora avulsa)?

## Layout (layout A)

```
┌─────────────────────────────────────────────────────────┐
│  KPIs globais (total, reservado, milheiro médio, gap)   │
├──────────┬──────────────────────────────────────────────┤
│ Rail     │  Hero da carteira selecionada + benefícios  │
│ carteiras│  [ Lançar | Transferir ]                    │
│          │  Extrato                                    │
│          │  Calculadoras: cash vs pts | emissão        │
└──────────┴──────────────────────────────────────────────┘
```

Reutilizar estilos `pontos-central.css` e componentes em `front/src/frentes/viagens/pages/pontos/*` e calculadora em `components/voos/MilesCalculatorPop` / `FlightMilesBlock` (modo página, sem popup).

## KPIs (v1)

Derivados de `GET /api/miles/dashboard` **sem** `tripId` (ou `tripId` omitido):

- Soma de saldos por programa (agrupar por `unit` só na UI, sem misturar unidades num único total sem rótulo).
- Soma de `committed` / `reserved` quando o dashboard expuser por programa.
- Milheiro médio ponderado quando disponível no dashboard.
- Alerta “falta para voos” apenas se o backend agregar gap global; senão omitir o quarto KPI no v1.

## O que não entra nesta tela (v1)

- Lista de `miles_emission_sims` da viagem.
- Criação de simulação de emissão amarrada a `trip_id`.
- Promoções, relatórios, scraping (etapa 2 do spec anterior).
- Lançamento automático em Dinheiro ao comprar milhas.

## Voos após o hub

- Manter resumo compacto (`CarteiraResumo`) e calculadora contextual ao trecho.
- Adicionar link “Abrir central de milhas” → `/viagens/milhas` (v1).
- `CarteiraSheet` pode permanecer como atalho rápido na viagem; gestão pesada fica no hub (reduzir duplicação é opcional pós-v1).

## Sidebar — implementação

- Estender `sidebarNav.ts`: tipo de grupo com `id: 'dinheiro' | 'viagens'`.
- Substituir `SIDEBAR_VIAGENS` leaf único por grupo com itens:
  - `to: '/viagens'`, `label: 'Viagens'`, `end: true` no link (só atlas ativo na raiz).
  - `to: '/viagens/milhas'`, `label: 'Milhas'`.
- `useSidebarNavState`: estado inicial `viagens: true`; auto-abrir grupo quando `pageId` ou pathname sob `/viagens/milhas`.
- `legacy/routeMap.ts`: mapear `/viagens/milhas` para `page: 'viagens-milhas'` (ou manter header de viagens com título “Milhas”).

## Página React

- Nova rota irmã de `index` em `viagensRoutes`: `path="milhas" element={<MilhasHubPage />}`.
- `MilhasHubPage`: extrair/adaptar `PontosHubPage` removendo bloco “Nesta viagem · Emissões” e `tripId` obrigatório; incluir seção calculadora inline.
- Redirects antigos `/viagens/:tripId/voos/pontos/*` podem continuar redirecionando para voos ou apontar para `/viagens/milhas` (preferência: **hub global** para carteira/calc; emissão continua em voos).

## Critérios de aceite

1. Sidebar mostra Viagens expandível com dois subitens; Milhas destaca em `/viagens/milhas`.
2. Hub exibe rail, hero, lançar, transferir, extrato conectados à API.
3. Calculadoras funcionam sem `tripId`.
4. Voos ainda mostra necessidade por trecho; emissões só na viagem.
5. Nenhuma regressão nos testes de motor em `platform/tests/motor/milhas/*`.

## Referências

- UI mockup: `docs/mockups/milhas-tela-opcoes.html`
- Implementação existente não roteada: `PontosHubPage.tsx`
- Spec de dados: `platform/docs/superpowers/specs/2026-11-16-central-pontos-milhas-design.md`