# Modal «Nova dívida» — cadastro multi-mês (design)

**Data:** 2026-05-20  
**Status:** Aprovado (brainstorming)  
**Cenário prioritário:** Primeiro cadastro com histórico longo (muitos meses de uma vez)

## Objetivo

Melhorar o modal **Nova dívida** para cadastrar vários meses de saldo sem a lista vertical longa e cansativa, mantendo o modelo de dados atual (`debts` + `debtUpdates`).

## Decisões do usuário

| Tópico | Escolha |
|--------|---------|
| Cenário principal | Histórico longo no primeiro cadastro |
| Maior dor hoje | Lista enorme — rolar e preencher um a um |
| Forma de entrada | Tabela compacta + atalhos + agrupar por ano (expandir/colapsar) |
| Mudar data de início | Manter valores já digitados (merge de meses) |
| Abordagem | 1 — Tabela por ano no mesmo modal |

## Escopo

### Inclui

- Substituir `#debt-monthly-rows` (lista vertical) por **accordion por ano** com **tabela compacta** (Mês | Valor).
- Navegação por teclado: Tab / Shift+Tab entre valores; Enter avança para o próximo mês.
- Atalhos por linha ou por ano: **= anterior** (copia último valor preenchido anterior) e **limpar** (zera célula, não remove linha).
- Regra de save inalterada: **célula vazia = mês não gravado**.
- Remover botão **Remover mês**; todas as linhas do intervalo permanecem visíveis.
- Ao mudar data de início: **preservar valores** em memória; adicionar/remover linhas conforme novo intervalo; reaplicar valores se o mês voltar ao intervalo.
- Truncamento > 120 meses: manter cap atual com nota (últimos 120 meses).
- **Registrar mês** no card: mesmo modal, empresa pré-preenchida/travada, foco no ano/mês atual.
- Banco já existente (mesmo nome): pré-preencher meses já lançados; no save, **atualizar** update existente no mesmo mês ou **criar** se não existir.
- Contador no rodapé: «N meses com valor» antes de Salvar.
- Ajustes de CSS em `#debt-update-modal` (largura, tabela, accordion, tema escuro).

### Não inclui

- Colar de planilha (Ctrl+V) — fase futura.
- Endpoint batch para salvar todos os meses em uma requisição — só se testes mostrarem lentidão inaceitável.
- Mudança no schema Prisma / novas tabelas.
- Substituir fluxo «editar lançamento» na tabela (modal de edição unitário permanece).

## Layout

```
┌─ Nova dívida ─────────────────────────────┐
│ Nome / empresa                             │
│ Data de início (mês)                       │
│                                            │
│ ▼ 2025  (3 meses preenchidos)              │
│   │ Mês    │ Valor        │ = ant │ limpar │
│   │ Jan/25 │ [________]   │  ·    │   ·    │
│   ...                                      │
│ ▶ 2024  (colapsado)                        │
│ ▶ 2023  (colapsado)                        │
│                                            │
│ 12 meses com valor                         │
│ [ Cancelar ]  [ Salvar ]                   │
└────────────────────────────────────────────┘
```

- Ano **atual** expandido por padrão; anos anteriores colapsados.
- Scroll na área de anos (altura máx. ~50vh), rodapé fixo com ações.

## Comportamento da data de início

1. Intervalo: do mês de início até o mês atual (se início no futuro: 12 meses a partir do início — regra atual).
2. Ao alterar início:
   - Calcular diff de meses (adicionados / removidos).
   - Valores digitados ficam em `Map<monthKey, amount>` em memória do formulário.
   - Meses que saem do intervalo permanecem no mapa; se o usuário recolocar uma data que os inclua, valores reaparecem.
3. Nota de truncamento se `months.length > 120` (texto igual ou equivalente ao atual).

## Atalhos

| Ação | Detalhe |
|------|---------|
| Tab / Shift+Tab | Ordem cronológica entre inputs `.debt-month-input` |
| Enter | Foco no input do mês seguinte (preventDefault no form) |
| = anterior | Por linha: copia valor do mês anterior **com valor** no intervalo; no cabeçalho do ano: preenche vazios do ano com último valor do ano anterior global |
| Limpar | `value = ''` na célula |

## Fluxo de save

1. Validar nome + data de início + ≥ 1 mês com valor.
2. `getOrCreateDebtByCompany` (comportamento atual).
3. `initialAmount`: primeiro valor cronológico entre entradas (regra atual).
4. Para cada entrada com valor:
   - Se já existe `debtUpdate` no mesmo `monthKey` para o `debtId`: **PUT** update existente.
   - Senão: **POST** novo update.
5. Toast: «Dívida salva (N meses).»; fechar modal; `onDataRefresh`.

## Arquivos previstos

| Arquivo | Mudança |
|---------|---------|
| `index.html` | Estrutura accordion + tabela; hint atualizado |
| `js/features/debts/debts.js` | Estado do form (`monthValues` Map), render por ano, merge ao mudar data, save com upsert por mês |
| `js/features/debts/debt-form-months.js` | **Novo** (opcional) — build intervalo, labels, agrupamento por ano, se `debts.js` crescer demais |
| `css/pages/debts.css` | Estilos accordion, tabela, foco teclado |

## Critérios de aceite

1. Cadastro de 24+ meses: anos colapsáveis reduzem scroll inicial; tabela cabe mais linhas visíveis que a lista antiga.
2. Mudar data de início não apaga valores já digitados para meses que continuam no intervalo.
3. Tab e Enter navegam entre campos de valor em ordem cronológica.
4. «= anterior» e «limpar» funcionam sem remover linhas do DOM.
5. Salvar grava apenas meses com valor; banco existente atualiza mês duplicado em vez de criar segundo lançamento.
6. «Registrar mês» abre modal com empresa preenchida e ano atual expandido.
7. Tema claro e escuro legíveis.

## Riscos / notas

- **Performance:** N saves sequenciais para N meses — monitorar; batch é melhoria futura.
- **Upsert por mês:** comparar `monthKey(update.date)` com entrada; múltiplos updates no mesmo mês no DB legado — usar o mais recente para pré-preenchimento e sobrescrever no save.
- **Acessibilidade:** accordion com `aria-expanded`; botões de atalho com `aria-label` em português.

## Próximo passo

Após revisão desta spec → skill `writing-plans` para plano de implementação tarefa a tarefa.
