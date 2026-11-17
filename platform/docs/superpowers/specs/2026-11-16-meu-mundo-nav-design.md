# Meu Mundo — navegação e marca

**Data:** 2026-11-16  
**Status:** Implementado  

## Marca

- Nome exibido: **Meu Mundo** (`AppBrand` em `js/core/app-brand.js`).
- Tagline: vida pessoal além do dinheiro (financeiro permanece como módulo).
- `localStorage` migra prefixo `meumalote` → `meumundo`.

## Sidebar

```
Dinheiro (grupo)
  Dashboard, Entradas, Saídas, Planejamento, Carteira, Cofrinhos, Dívidas
Viagens (grupo)
  Atlas  → data-page viagens (ficha continua em #viagens/trip/:id)
Ferramentas
Painel Admin (admin)
```

Grupos expansíveis; o grupo do item ativo abre automaticamente ao navegar.