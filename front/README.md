# front — Meu Mundo (React)

App React (Vite 5174). API via proxy `/api` com cookie de sessão.

## Dev

```bash
npm run dev:back          # terminal 1 (API)
PORT=3001 npm run dev:front   # terminal 2
# ou: npm run dev  (API + front com a mesma PORT)
```

Abra **sempre a mesma URL** no Chrome/Safari e no Cursor: `http://localhost:5174` (não misture com `192.168.x.x` — o login é outro “site”). Depois de deploy local, force atualização: Cmd+Shift+R.

**Erro 504 `Outdated Optimize Dep` no Network:** dois Vites abertos (5173 legado + 5174 React) corrompiam o mesmo cache. Agora cada um usa pasta própria (`.vite-front` / `.vite-legacy`). Feche **todos** os terminais com Vite, rode `npm run dev:front:reset`, abra só `http://localhost:5174`. Se a porta mudar (5175), use a URL que o terminal mostrar.

**Viagens cutover legado:** `localStorage.setItem('meu-mundo:viagens-react','1')`

**Produção:** `npm run build:prod` + `npm start` (já define `MEU_MUNDO_FRONT=react`)

## Qualidade de código

Padrões e checklist: [`docs/CODE_QUALITY.md`](docs/CODE_QUALITY.md) · Dashboard: [`docs/DASHBOARD.md`](docs/DASHBOARD.md).

## Convenções (migração 100% React)

- **Não** importar `@legacy/js` em código novo; brand/tooltip em `src/app/`. Motor visual de cartões ainda via `@motor` → legado.
- Dados: `useFinanceData()` / `FinanceDataProvider`.
- Regras: `@motor/*`.
- Telas: `src/frentes/<domínio>/pages/` + `components/` + hooks.

Plano: `platform/docs/superpowers/plans/2026-11-16-react-full-migration-screen-by-screen.md`