# Checklist — cutover React (Meu Mundo)

Prod default: `MEU_MUNDO_FRONT=react` + `npm run build:front`.

## Regressão manual

- [ ] Login e `/register`
- [ ] Dinheiro: dashboard, entradas, saídas, carteira, cofrinhos, dívidas, planejamento
- [ ] Viagens: atlas + ficha
- [ ] Ferramentas: kanban
- [ ] Notificações (API + computadas no sininho)

## Comandos

```bash
npm test
npm run build:front
npm run dev          # React 5174
npm run dev:legacy   # comparação até apagar legacy-web
```

## Limpeza pendente (pós-regressão)

- `legacy-web/` ainda é dependência do `back/` e de testes do motor — **não remover** até portar `credit-installments`, pending cash-outs e façade do wallet.
- Alias Vite `@legacy` pode permanecer para o motor `@motor` até cópia completa.
- Bridge `front/src/legacy/` reduzida a `bootstrapShell` + `appState` (sem imports `@legacy` no shell principal).