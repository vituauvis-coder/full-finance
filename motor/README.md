# motor — motores de regras de negócio

Código **puro** (sem React, sem Express, sem SQL): fórmulas e decisões do produto usadas pelo **front**, pelo **back** e pelo legado.

```
motor/
  viagens/   # status, totais, roteiro, cenários…
  dinheiro/  # split-net, loan-expense, movement-date…
```

Testes: `platform/tests/motor/viagens/`, `platform/tests/motor/dinheiro/`.

**Não confundir** com `js/shared/` — utilitários de UI (tabela, filtros, gráficos), não regras de domínio.