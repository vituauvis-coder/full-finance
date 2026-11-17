# Perfil moderno — plano de evolução (v2)

> **Goal:** Grade bento consistente, hierarquia clara, paridade com legado e mesmo language visual do dashboard (grafite / `--dash-*`).

**Architecture:** Componentes pequenos em `frentes/perfil/`; primitivo `ProfileCard` + CSS em `profile-modern.css` (e opcional `profile-surfaces.css` espelhando `dashboard-surfaces.css`). Um único grid pai em vez de várias `grid` aninhadas com alturas independentes.

**Tech stack:** React, CSS tokens existentes, API `profileApi.ts`, evento `profile-updated`.

---

## Diagnóstico (estado atual)

| Problema | Causa provável |
|--------|----------------|
| Hero ≠ altura do snapshot | Conteúdo assimétrico; falta `align-items: stretch` + corpo flexível (`flex: 1`) nos cards |
| Linha dados ≠ segurança | Senha = 3 campos empilhados; nome = 2 colunas → desbalanceamento |
| Informação repetida | E-mail e moeda no hero, snapshot, formulários e aparência |
| Cabeçalho da página fraco | Só lede; legado tinha `h1` + intro; título duplicado no app-header |
| Aparência “vazia” | Só select de moeda; legado agrupa foto + moeda + sons em grade |
| Paridade funcional baixa | Sem foto, sons, ajuste de saldo, caixa/pagamentos, exclusão de conta |
| Micro-UX | Sem hints de campo, feedback discreto, estados loading/saving por seção, sons |

---

## Fase 1 — Layout e sistema de cartões (quick wins)

**Objetivo:** Mesma altura por linha, ritmo visual uniforme, sem mudar API.

### 1.1 Primitivos de layout

- [x] Criar `components/ProfileCard.tsx` — `title`, `subtitle`, `icon`, `variant?: 'default' | 'identity' | 'snapshot'`, `children`.
- [x] Criar `components/ProfilePageIntro.tsx` — `h1` “Perfil” + lede (alinhado ao legado e ao dashboard intro).
- [x] `ProfilePage.tsx`: uma única `profile-modern__bento` com **subgrid** ou grid de 12 colunas:
  - Row 1: identity (col 7) + snapshot (col 5)
  - Row 2: personal (6) + security (6)
  - Row 3+: full-width tiles
- [x] CSS: stretch na grade; `profile-modern__card-body { flex: 1; … }`; botões com `form-footer` no rodapé do card.

### 1.2 Equilibrar formulários

- [x] Senha em 2 colunas no desktop (atual + nova); confirmar em linha cheia.
- [x] `--profile-gap: 1.25rem`; hints de campo; `form-footer` alinha ações no rodapé.
- [ ] Botões secundários ghost (Fase 2 — remover foto).

### 1.3 Snapshot sem redundância

- [x] Remover e-mail do snapshot; moeda + tema.
- [x] Subtitle “Resumo das preferências atuais”.
- [ ] Membro desde / última atualização (quando API expuser).

### 1.4 Polimento visual

- [x] Variant `identity` com gradiente + radial.
- [x] Hover leve nos cards.
- [x] `ProfileCard` em todos os tiles.
- [x] `LegacyAppShell`: `dashboard-modern` só no dashboard; `profile-modern` só em `/perfil`.

**Verificação:** `npm run build:front`; checklist visual 375px / 860px / 1280px; alturas das duas colunas alinhadas.

---

## Fase 2 — Aparência e personalização (grade wide)

**Objetivo:** Cartão “Aparência e região” com densidade do legado.

### 2.1 Grade interna

- [x] `ProfileAppearanceCard` → subgrid 3 colunas (≥900px): **Foto** | **Moeda** | **Sons**.
- [x] Moeda editável só no card de aparência; snapshot read-only.

### 2.2 Foto de perfil

- [x] PATCH `profilePhotoURL` (data URL / `null`).
- [x] `ProfilePhotoBlock.tsx` — preview, alterar, remover, 2 MB.
- [x] Sidebar sincroniza via `profile-updated`.

### 2.3 Sons da interface

- [x] `front/src/app/uiSounds.ts` — localStorage + `prefers-reduced-motion`.
- [x] `ProfileUiSoundsBlock` + ping ao ativar.

**Verificação:** upload real em dev; sidebar atualiza avatar; moeda única fonte de verdade.

---

## Fase 3 — Finanças e conta (paridade legado)

**Objetivo:** Tiles wide restantes sem reintroduzir CSS legado.

| Tile | Componente |
|------|------------|
| Ajuste de saldo | `ProfileBalanceCard.tsx` |
| Caixa e pagamentos | `ProfileWalletPrefsCard.tsx` |
| Zona de risco | `ProfileDangerZoneCard.tsx` + `ProfileDeleteAccountDialog.tsx` |

- [x] Tipos `ManualCashOutPrefs` + `getFinancePreferences`.
- [x] `useProfilePage` — saldo, caixa, exclusão.
- [x] Feedback por seção; `playPingSound` nos saves.

**Verificação:** comparar fluxos com legado lado a lado; testes manuais de PATCH.

---

## Fase 4 — Qualidade e documentação

- [ ] Extrair constantes de moeda para módulo compartilhado (dashboard + perfil).
- [ ] Testes unitários: labels de moeda/tema, validação senha no hook.
- [ ] Atualizar `PERFIL.md` + diagrama de componentes.
- [ ] `CODE_QUALITY.md`: frente perfil listada com boundaries.

---

## Ordem de execução recomendada

```
Fase 1 (layout) → Fase 2.1–2.2 (aparência + foto) → Fase 2.3 (sons) → Fase 3 (finanças) → Fase 4
```

**Entrega incremental:** após Fase 1 a tela já deve parecer “produto”; Fases 2–3 fecham paridade; Fase 4 sustenta manutenção.

---

## Critérios de aceite (visuais)

1. Em desktop, topo e meio: **bases dos cards da mesma linha alinhadas** (stretch).
2. Nenhum dado crítico repetido mais de uma vez na viewport (e-mail 1×, moeda editável 1×).
3. Título “Perfil” visível no conteúdo; header continua “Meu Perfil”.
4. Todos os cards compartilham padding, raio, ícone-head e tipografia.
5. Tema claro/escuro: contraste inputs/botões igual dashboard.

---

## Arquivos principais

| Arquivo | Mudança |
|---------|---------|
| `pages/ProfilePage.tsx` | Grid único, intro, composição |
| `components/ProfileCard.tsx` | Novo primitivo |
| `styles/profile-modern.css` | Bento 12 col, flex bodies, identity variant |
| `components/Profile*.tsx` | Migrar para `ProfileCard` |
| `hooks/useProfilePage.ts` | Dividir se Fase 3 |
| `api/profileApi.ts` | Upload, saldo, prefs |
| `components/layout/LegacyAppShell.tsx` | Classe profile-only no `/perfil` |