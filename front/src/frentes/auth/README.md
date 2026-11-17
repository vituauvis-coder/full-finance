# Auth (React)

Rotas públicas: `/login`, `/register`.

## Estrutura

| Pasta | Responsabilidade |
|-------|------------------|
| `components/` | UI sem chamadas de API |
| `hooks/` | Sessão (`useAuthGate`) e submissão de formulários |
| `content.ts` | Textos estáticos (marketing) |
| `*Page.tsx` | Composição fina — só monta componentes + hook |

## Convenções

- Material Symbols na landing via `MaterialIcon`.
- CSS legado em `legacy-web/css/auth.css`; React: `auth-react.css` + `auth-modern.css` (classe `auth-container--modern`).
- Não importar `@legacy` neste módulo.