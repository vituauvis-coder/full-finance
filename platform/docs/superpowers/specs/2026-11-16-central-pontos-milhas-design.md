# Central de Pontos e Milhas

Substitui a aba **Casa das milhas** em `/viagens/:id/voos`. A aba **Simulações** (voos) não muda.

Este documento substitui a seção “Casa das milhas” de `2026-11-16-voos-casa-milhas-design.md`. O JSON `users.finance_preferences.viagensMiles` deixa de ser a fonte da carteira após a migração.

## Decisões

- Entra no mesmo lugar da Casa das milhas (aba da tela de Voos). Sem item novo no menu.
- Uma carteira e um extrato **da conta**. Cada viagem tem o próprio histórico de simulações de emissão.
- Saldo = soma das movimentações. Editar saldo grava um movimento `ajuste`.
- Bônus de transferência só entra se a pessoa preencher o percentual. Incide sobre os pontos **já convertidos no destino** (160k Esfera, 2:1, 25% → 80k + 20k = 100k Avios).
- Custo-benefício = custo econômico ÷ milheiros emitidos no destino.
- Promoções cadastradas, relatórios longos e catálogo de ofertas de compra ficam para a etapa 2.
- Sem scraping. Sem cotação live de passagem.

## Onde vive

Rotas internas da aba (a viagem só ancora o histórico de emissão):

| Rota | Tela |
|---|---|
| `/viagens/:tripId/voos` | Simulações de voo (já existe) |
| `/viagens/:tripId/voos/pontos` | Visão |
| `/viagens/:tripId/voos/pontos/carteira` | Programas + lançar + extrato |
| `/viagens/:tripId/voos/pontos/calculadora` | Conversão origem → destino |
| `/viagens/:tripId/voos/pontos/emissao` | Lista de simulações desta viagem |
| `/viagens/:tripId/voos/pontos/emissao/:simId` | Opções + comparador |

A segunda aba da tela de Voos chama-se **Central de pontos**. Qualquer rota `/pontos/*` a deixa ativa.

A calculadora `compareCashVsPoints` da Casa antiga continua disponível na emissão (premissa de milheiro), não como hub separado.

## Dados (Postgres)

Tudo filtrado por `user_id` da sessão. Sem RLS extra nesta etapa (o app já isola por sessão, como em `trips`).

### `miles_programs`

Cadastro. **Não** guarda saldo.

- `id` uuid
- `user_id` uuid
- `brand` text (`esfera`, `livelo`, `azul`, `latam`, `smiles`, `iberia`, `tap`, `outro`)
- `name` text
- `issuer` text (Santander, Iberia, …)
- `expires_on` date null
- `notes` text
- `created_at`, `updated_at`

Esfera é criada na migração se a conta ainda não tiver programa `esfera`.

### `miles_movements`

Fonte do saldo e do custo investido.

- `id` uuid
- `user_id` uuid
- `program_id` uuid (programa cujo saldo esta linha altera)
- `type` `acumulo` | `compra` | `transferencia_saida` | `transferencia_entrada` | `bonus` | `emissao` | `expiracao` | `ajuste`
- `points` bigint ≥ 0 (sempre positivo; o tipo define crédito ou débito)
- `points_sign` smallint not null default 1 — só `ajuste` usa `-1` para baixar saldo; nos demais tipos o motor ignora e segue o tipo
- `amount` numeric(14,4) null — valor pago na **moeda da linha**
- `currency` text default `BRL`
- `amount_brl` numeric(14,4) null — BRL gravado na hora do lançamento (se `currency` ≠ BRL, exige `fx_to_brl`)
- `counterpart_program_id` uuid null
- `transfer_group_id` uuid null — amarra saída + entrada + bônus de uma transferência
- `bonus_points` bigint default 0 — só na linha de bônus/entrada
- `conversion_from` int null, `conversion_to` int null — taxa usada na transferência (ex. 2 e 1)
- `bonus_percent` numeric(8,4) null
- `trip_id` uuid null — emissão ou simulação convertida em lançamento
- `emission_sim_id` uuid null
- `occurred_on` date
- `source` text — cartão, clube, compra avulsa, …
- `notes` text
- `created_at`

Débito: `transferencia_saida`, `emissao`, `expiracao`, `ajuste` com `points_sign = -1`.  
Crédito: `acumulo`, `compra`, `transferencia_entrada`, `bonus`, `ajuste` com `points_sign = +1`.

Transferência Esfera → Iberia: três linhas no mesmo `transfer_group_id`:

1. `transferencia_saida` no programa origem, `points` = enviados.
2. `transferencia_entrada` no destino, `points` = convertidos sem bônus.
3. `bonus` no destino, `points` = bônus, se > 0.

### `miles_emission_sims`

Histórico **da viagem**.

- `id` uuid
- `user_id` uuid
- `trip_id` uuid not null
- `title` text — ex. `Recife → Madri — Abril/2027`
- `destination_program_id` uuid — programa em que a passagem é emitida (Avios, etc.)
- `origin_program_id` uuid — de onde saem os pontos
- `conversion_from` int not null, `conversion_to` int not null
- `bonus_percent` numeric(8,4) not null default 0
- `buy_milheiro` numeric(14,6) — preço para comprar a falta (editável; default = milheiro médio de aquisição do destino ou da origem, o que a pessoa escolher no formulário)
- `buy_discount_percent` numeric(8,4) default 0
- `buy_extra_fee` numeric(14,4) default 0, `buy_extra_fee_currency` text default `BRL`
- `fx_rate` numeric(18,8) — unidades de BRL por 1 unidade da moeda das taxas
- `iof_percent` numeric(8,4) default 0
- `spread_percent` numeric(8,4) default 0
- `club_fee_brl` numeric(14,4) default 0 — mensalidades atribuídas a esta emissão
- `status` `rascunho` | `reservada` | `emitida`
- `chosen_option_id` uuid null
- `notes` text
- `created_at`, `updated_at`

`reservada` compromete pontos na Visão. `emitida` gera movimentação de `emissao` (e não conta de novo como comprometido).

### `miles_emission_options`

- `id` uuid
- `sim_id` uuid
- `label` text — A, B, …
- `destination_points` bigint — milhas da emissão no programa destino
- `taxes_amount` numeric(14,4)
- `taxes_currency` text — `EUR`, `USD`, `BRL`, …
- `sort_index` int

Premissas da simulação (câmbio, IOF, spread, taxa, bônus, milheiro de compra) ficam no cabeçalho da sim, visíveis na tela.

## Motor (`motor/milhas/`)

Toda conta usa `decimal.js`. Pontos são inteiros (`BigInt` / number inteiro). Moeda e taxas são `Decimal`. Não arredondar no meio. Arredondar BRL para 2 casas só na exibição e ao gravar movimento de dinheiro (`amount`). Pontos: truncar para baixo na conversão-base, a menos que a pessoa marque “arredondar para cima” naquela simulação (campo `points_round`: `down` default | `up`).

Funções:

### `convertPoints({ originPoints, from, to, bonusPercent, round })`

`from:to` = 2:1 significa destino = origem × (to/from).

- `base = round(originPoints * to / from)`
- `bonus = round(base * bonusPercent / 100)` se `bonusPercent > 0`, senão 0
- `total = base + bonus`

Inverso para emissão: pontos na origem a partir dos pontos no destino, **sem** aplicar bônus no inverso (o bônus só ajuda na ida). Se a pessoa informou bônus, a origem necessária é a que, convertida com bônus, cobre o destino:

`originNeeded = ceil(destinationPoints / ((to/from) * (1 + bonusPercent/100)))` com a regra `points_round`.

### `purchaseCost({ points, milheiro, discountPercent, extraFee })`

- `gross = (points / 1000) * milheiro`
- `afterDiscount = gross * (1 - discountPercent/100)`
- `total = afterDiscount + extraFee`
- `costPerPoint = points > 0 ? total / points : 0`
- `costPerMilheiro = points > 0 ? total / (points/1000) : 0`

### `emissionOptionCost(sim, option, originBalance)`

1. `originNeeded` via inverso da conversão com bônus da sim.
2. `ownPoints = min(originBalance, originNeeded)` — saldo **não** inclui comprometido de outras sims `reservada` (exceto a atual).
3. `pointsToBuy = originNeeded - ownPoints`
4. `buyCost` = `purchaseCost` da falta, com milheiro/desconto/taxa extra da sim.
5. `taxesBrl = taxes_amount * fx_rate * (1 + iof/100) * (1 + spread/100)`
6. `outlay = buyCost.total + taxesBrl + club_fee_brl` — desembolso adicional. Pontos já na carteira **não** entram.
7. `sunk = ownPoints / 1000 * acquisitionMilheiro(originProgram)` — custo econômico atribuído ao estoque.
8. `economic = outlay + sunk`

`acquisitionMilheiro(program)` = soma `amount_brl` de `compra` e de `ajuste` com valor, dividida pelos pontos dessas mesmas linhas (ajustes negativos com valor reduzem o estoque pago). Se o denominador for 0, milheiro 0 e o econômico = desembolso (estoque ainda sem custo de aquisição).

### `programBalance(movements, programId)`

Soma `points * points_sign` com o sinal do tipo (débito negativo). Nunca soma programas diferentes.

### `dashboard(programs, movements, reservedSims)`

Por programa: saldo, investido BRL, milheiro médio, disponível = saldo − comprometido, comprometido = `originNeeded` da opção escolhida (ou da de menor desembolso se ainda não escolheu) em sims `reservada` daquele programa origem.

Últimas 8 movimentações da conta. Sem promoções no MVP.

## API

Prefixo `/api/miles`, `requireAuth`.

- `GET /programs` — programas + saldo derivado
- `POST /programs` `PATCH /programs/:id` — cadastro (não altera saldo)
- `GET /movements?programId&limit`
- `POST /movements` — um lançamento; transferência aceita origem, destino, taxa, bônus e cria o grupo
- `POST /programs/:id/set-balance` — `{ balance }` calcula o delta e grava `ajuste`
- `GET /dashboard`
- `POST /preview/convert` `POST /preview/purchase` `POST /preview/emission` — puro motor, não grava
- `GET /emissions?tripId=` `POST /emissions` `GET|PATCH /emissions/:id` — opções no mesmo payload
- `POST /emissions/:id/reserve` `POST /emissions/:id/emit` — status; `emit` lança `emissao` no programa **origem**, `points` = `originNeeded` da opção escolhida, `trip_id` e `emission_sim_id` preenchidos. Não lança de novo se já `emitida`.

Validação: pontos ≥ 0, taxas ≥ 0, `from` e `to` ≥ 1, percentuais 0–1000 (bônus agressivo permitido, não negativo), saldo após ajuste ≥ 0. 400 com mensagem clara. 404 se o recurso não for do usuário.

Erro de concorrência: saldo no `emit` é recalculado no servidor; se faltar ponto, 409 e a UI pede ajuste.

## Interface

Identidade da ficha de Viagens (`--v-turquesa`, `--v-oceano`, cards, pills). Números grandes, pouco texto. Não parecer planilha.

- **Visão:** um card por programa (saldo, milheiro médio, disponível / comprometido). Não somar pontos de programas distintos. Faixa de BRL investido. Lista curta de lançamentos. Sims reservadas desta viagem.
- **Carteira:** lista de programas (Esfera, Livelo, Azul Fidelidade, LATAM Pass, Smiles, Iberia Club / Avios, TAP Miles&Go, outro). Extrato filtrável. Formulário de lançamento. Campo de saldo editável que confirma “vai gerar ajuste de X pontos”.
- **Calculadora:** origem, destino, `from:to`, bônus %, pontos a converter. Resultado em três linhas (base, bônus, total). Sem bônus = bônus 0.
- **Emissão:** título, programas, premissas (taxa, bônus, milheiro de compra, câmbio, IOF, spread, clube). Tabela/cards de opções (milhas destino + taxas na moeda original). Comparador com desembolso, econômico, diferença vs a mais barata, selos menor desembolso / menor econômico / melhor custo-benefício. Tudo editável depois de salvar.

iPhone: chips de navegação interna, opções empilhadas, comparador em cards, premissas recolhidas.

## Migração

Script na subida da API (idempotente):

1. Ler `finance_preferences.viagensMiles.programs`.
2. Para cada programa, criar `miles_programs` se não existir `brand`+`user` (ou `id` estável `esfera`).
3. Se o saldo informado > 0 e ainda não houver movimento, inserir `ajuste` de abertura com `points` = saldo, `notes` = `Abertura (Casa das milhas)`, `amount` nulo, `occurred_on` = hoje.
4. Não apagar `viagensMiles` nesta etapa (leitura só se a tabela de programas do usuário estiver vazia). Depois da primeira migração bem-sucedida, a Central ignora o JSON.

## Testes

`platform/tests/motor/milhas/`:

- conversão 2:1 + 25% → 160000 → base 80000, bônus 20000, total 100000
- conversão sem bônus → bônus 0
- inverso com bônus: 100000 Avios → origem necessária 160000
- compra: 50000 pts, milheiro 14, desconto 20%, taxa 0 → total e milheiro efetivo em Decimal
- emissão: opção 100000 Avios + €283,16, saldo 160000 Esfera, fx, IOF, spread — desembolso **não** inclui estoque; econômico inclui milheiro de aquisição
- opção que exige compra: falta de pontos entra no desembolso
- saldo: créditos − débitos; programas isolados
- ajuste de set-balance: 90000 → 100000 gera ajuste +10000

Nada de UI sem persistência: telas MVP leem e gravam essas tabelas.

## Fora desta etapa

- Promoções (CRUD, vencimentos na Visão)
- Relatório de evolução, planejado vs realizado
- Comparar várias ofertas de compra salvas
- Item de menu próprio
- Integrar automaticamente uma simulação de **voo** (preço da passagem) numa opção de emissão — pode copiar o valor à mão; atalho fica para depois

## Integração com Voos

Simulações de voo continuam sendo opções de itinerário (datas, conexões, preço cash). A Central responde “como pago com pontos”. São motores distintos; compartilham a viagem só pelo `trip_id` das emissões.
