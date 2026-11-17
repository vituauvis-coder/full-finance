# Shell React — menu lateral

Ponto de entrada: `frentes/shell/components/AppSidebar.tsx` (reexportado como `LegacySidebar`).

## Camadas

| Pasta | Conteúdo |
|-------|-----------|
| `config/sidebarNav.ts` | Rotas, ícones Material, ids de página legado |
| `hooks/useSidebarNavState.ts` | Grupos abertos + sync com rota atual |
| `components/` | Profile, links, grupos, footer, colapso (`SidebarCollapseToggle`) |
| `hooks/useSidebarCollapsed.ts` | Estado + `localStorage` do menu recolhido |
| `hooks/useSidebarProfileLabel.ts` | Nome/foto no bloco perfil (`lib/profileHttp`, `profileEvents`) |
| `styles/` | Tokens e chrome (`sidebar--modern`) |

## Contratos legado

Mantidos para `bootstrapShell`, mobile e colapso: `#app-sidebar`, `#user-info`, `#logout-btn`, `#sidebar-theme-toggle`, `#sidebar-overlay`, classes `.sidebar-menu`, `.nav-link`, `.sidebar-collapsed` em `#main-content`.

## CSS

Tokens em `sidebar-tokens.css`; overrides escopados a `.sidebar.sidebar--modern` (não alteram o legado Vite puro).